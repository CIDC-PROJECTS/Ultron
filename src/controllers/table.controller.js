const { TABLE_STATUSES } = require("../models/Table");

const { getSupabaseClient } = require("../config/supabase");
const { generatePrefixedId } = require("../utils/ids");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTableNumber = (value) => String(value).trim().toUpperCase();

const sanitizeTableForResponse = (table) => {
  if (!table) return table;
  const { number_key, ...rest } = table;
  void number_key;
  return rest;
};

const createTable = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { number, status } = req.body;

    if (!number || typeof number !== "string" || !number.trim()) {
      return res
        .status(400)
        .json({
          message: "number is required and must be a non-empty string.",
        });
    }

    if (status !== undefined && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    const normalizedNumber = normalizeTableNumber(number);

    const { data: existingTable, error: existingError } = await supabase
      .from("tables")
      .select("id")
      .eq("number_key", normalizedNumber.toLowerCase())
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    if (existingTable) {
      return res
        .status(409)
        .json({ message: "A table with this number already exists." });
    }

    const now = new Date().toISOString();
    const { data: createdTable, error } = await supabase
      .from("tables")
      .insert({
        id: generatePrefixedId("TABLE"),
        number: normalizedNumber,
        number_key: normalizedNumber.toLowerCase(),
        status: status || "Active",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      message: "Table created successfully.",
      data: sanitizeTableForResponse(createdTable),
    });
  } catch (error) {
    return next(error);
  }
};

const listTables = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { search, status, page, limit, sort_by, sort_order } = req.query;

    if (status && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    let query = supabase.from("tables").select("*", { count: "exact" });

    if (search && String(search).trim()) {
      query = query.ilike("number", `%${String(search).trim()}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT))),
    );

    const skip = (safePage - 1) * safeLimit;

    const allowedSortFields = ["number", "status", "created_at", "updated_at"];
    const sortField = allowedSortFields.includes(String(sort_by))
      ? String(sort_by)
      : "number";
    const sortDirection = sort_order === "desc" ? -1 : 1;

    const rangeFrom = skip;
    const rangeTo = skip + safeLimit - 1;

    const {
      data: tables,
      count: totalCount,
      error,
    } = await query
      .order(sortField, { ascending: sortDirection !== -1 })
      .range(rangeFrom, rangeTo);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      data: (tables || []).map((table) => sanitizeTableForResponse(table)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / safeLimit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { number, status } = req.body;

    if (number === undefined && status === undefined) {
      return res.status(400).json({
        message: "At least one of number or status must be provided.",
      });
    }

    if (
      number !== undefined &&
      (typeof number !== "string" || !number.trim())
    ) {
      return res
        .status(400)
        .json({ message: "number must be a non-empty string." });
    }

    if (status !== undefined && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    const { data: existingTable, error: existingError } = await supabase
      .from("tables")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    if (!existingTable) {
      return res.status(404).json({ message: "Table not found." });
    }

    const updates = {};

    if (number !== undefined) {
      const normalizedNumber = normalizeTableNumber(number);

      const { data: conflictingTable, error: conflictError } = await supabase
        .from("tables")
        .select("id")
        .eq("number_key", normalizedNumber.toLowerCase())
        .neq("id", id)
        .maybeSingle();

      if (conflictError) {
        throw conflictError;
      }

      if (conflictingTable) {
        return res
          .status(409)
          .json({ message: "A table with this number already exists." });
      }

      updates.number = normalizedNumber;
      updates.number_key = normalizedNumber.toLowerCase();
    }

    if (status !== undefined) {
      updates.status = status;
    }

    const { data: updatedTable, error } = await supabase
      .from("tables")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      message: "Table updated successfully.",
      data: sanitizeTableForResponse(updatedTable),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteTable = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data: deletedTable, error } = await supabase
      .from("tables")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!deletedTable) {
      return res.status(404).json({ message: "Table not found." });
    }

    return res.status(200).json({
      message: "Table deleted successfully.",
      deleted_table_id: id,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createTable,
  listTables,
  updateTable,
  deleteTable,
  TABLE_STATUSES,
};
