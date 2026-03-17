const { Table, TABLE_STATUSES } = require("../models/Table");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTableNumber = (value) => String(value).trim().toUpperCase();

const createTable = async (req, res, next) => {
  try {
    const { number, status } = req.body;

    if (!number || typeof number !== "string" || !number.trim()) {
      return res.status(400).json({ message: "number is required and must be a non-empty string." });
    }

    if (status !== undefined && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    const normalizedNumber = normalizeTableNumber(number);

    const existingTable = await Table.findOne({ number_key: normalizedNumber.toLowerCase() });
    if (existingTable) {
      return res.status(409).json({ message: "A table with this number already exists." });
    }

    const createdTable = await Table.create({
      number: normalizedNumber,
      status: status || "Active",
    });

    return res.status(201).json({
      message: "Table created successfully.",
      data: createdTable.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

const listTables = async (req, res, next) => {
  try {
    const { search, status, page, limit, sort_by, sort_order } = req.query;

    if (status && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    const filters = {};

    if (search && String(search).trim()) {
      filters.number = new RegExp(String(search).trim(), "i");
    }

    if (status) {
      filters.status = status;
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT)))
    );

    const skip = (safePage - 1) * safeLimit;

    const allowedSortFields = ["number", "status", "created_at", "updated_at"];
    const sortField = allowedSortFields.includes(String(sort_by))
      ? String(sort_by)
      : "number";
    const sortDirection = sort_order === "desc" ? -1 : 1;

    const [tables, totalCount] = await Promise.all([
      Table.find(filters)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit),
      Table.countDocuments(filters),
    ]);

    return res.status(200).json({
      data: tables.map((table) => table.toJSON()),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { number, status } = req.body;

    if (number === undefined && status === undefined) {
      return res.status(400).json({
        message: "At least one of number or status must be provided.",
      });
    }

    if (number !== undefined && (typeof number !== "string" || !number.trim())) {
      return res.status(400).json({ message: "number must be a non-empty string." });
    }

    if (status !== undefined && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${TABLE_STATUSES.join(", ")}.`,
      });
    }

    const existingTable = await Table.findOne({ id });
    if (!existingTable) {
      return res.status(404).json({ message: "Table not found." });
    }

    const updates = {};

    if (number !== undefined) {
      const normalizedNumber = normalizeTableNumber(number);

      const conflictingTable = await Table.findOne({
        number_key: normalizedNumber.toLowerCase(),
        id: { $ne: id },
      });

      if (conflictingTable) {
        return res.status(409).json({ message: "A table with this number already exists." });
      }

      updates.number = normalizedNumber;
      updates.number_key = normalizedNumber.toLowerCase();
    }

    if (status !== undefined) {
      updates.status = status;
    }

    const updatedTable = await Table.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Table updated successfully.",
      data: updatedTable.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteTable = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedTable = await Table.findOneAndDelete({ id });
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
