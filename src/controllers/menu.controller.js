const path = require("path");

const { getSupabaseClient } = require("../config/supabase");
const { generatePrefixedId } = require("../utils/ids");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

const escapePostgrestOr = (value) => String(value).replaceAll(",", " ");

const parseBooleanQuery = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).toLowerCase().trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return null;
};

const isMissingColumnError = (error, columnName) => {
  if (!error) return false;
  const message = String(error.message || "");
  return message.includes(`Could not find the '${columnName}' column`);
};

const validatePayload = (payload, isCreate = false) => {
  const { name, category, price, description, image, image_path, stock } =
    payload;

  if (
    isCreate &&
    (name === undefined || category === undefined || price === undefined)
  ) {
    return "name, category, and price are required.";
  }

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return "name must be a non-empty string.";
  }

  if (
    category !== undefined &&
    (typeof category !== "string" || !category.trim())
  ) {
    return "category must be a non-empty string.";
  }

  if (price !== undefined && (typeof price !== "number" || price < 0)) {
    return "price must be a non-negative number.";
  }

  if (description !== undefined && typeof description !== "string") {
    return "description must be a string.";
  }

  if (image !== undefined && typeof image !== "string") {
    return "image must be a string.";
  }

  if (image_path !== undefined && typeof image_path !== "string") {
    return "image_path must be a string.";
  }

  if (stock !== undefined && typeof stock !== "boolean") {
    return "stock must be a boolean.";
  }

  return null;
};

const createMenuItem = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body, true);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const supabase = getSupabaseClient();
    const { name, category, price, description, image, image_path, stock } =
      req.body;

    const now = new Date().toISOString();
    const payload = {
      id: generatePrefixedId("MENU"),
      name: name.trim(),
      category: category.trim(),
      price: roundMoney(price),
      description: description ? description.trim() : "",
      image: image ? image.trim() : "",
      image_path: image_path ? image_path.trim() : "",
      stock: stock !== undefined ? stock : true,
      created_at: now,
      updated_at: now,
    };

    let createdItem = null;

    const { data: insertedWithPath, error: insertWithPathError } =
      await supabase.from("menu_items").insert(payload).select("*").single();

    if (insertWithPathError) {
      if (isMissingColumnError(insertWithPathError, "image_path")) {
        const { image_path: _ignore, ...payloadWithoutPath } = payload;
        const { data: insertedWithoutPath, error: insertWithoutPathError } =
          await supabase
            .from("menu_items")
            .insert(payloadWithoutPath)
            .select("*")
            .single();

        if (insertWithoutPathError) throw insertWithoutPathError;
        createdItem = insertedWithoutPath;
      } else {
        throw insertWithPathError;
      }
    } else {
      createdItem = insertedWithPath;
    }

    return res.status(201).json({
      message: "Menu item created successfully.",
      data: createdItem,
    });
  } catch (error) {
    return next(error);
  }
};

const listMenuItems = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { search, category, stock, page, limit, sort_by, sort_order } =
      req.query;

    const parsedStock = parseBooleanQuery(stock);
    if (stock !== undefined && parsedStock === null) {
      return res
        .status(400)
        .json({ message: "stock must be either true or false." });
    }

    let query = supabase.from("menu_items").select("*", { count: "exact" });

    if (search && String(search).trim()) {
      const needle = `%${escapePostgrestOr(String(search).trim())}%`;
      query = query.or(
        `name.ilike.${needle},description.ilike.${needle},category.ilike.${needle}`,
      );
    }

    if (category && String(category).trim()) {
      query = query.ilike("category", String(category).trim());
    }

    if (parsedStock !== undefined) {
      query = query.eq("stock", parsedStock);
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT))),
    );

    const skip = (safePage - 1) * safeLimit;

    const allowedSortFields = ["name", "price", "created_at", "updated_at"];
    const sortField = allowedSortFields.includes(String(sort_by))
      ? String(sort_by)
      : "created_at";
    const sortDirection = sort_order === "asc" ? 1 : -1;

    const rangeFrom = skip;
    const rangeTo = skip + safeLimit - 1;

    const {
      data: items,
      count: totalCount,
      error,
    } = await query
      .order(sortField, { ascending: sortDirection === 1 })
      .range(rangeFrom, rangeTo);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      data: (items || []).map((item) => item),
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

const getMenuItemById = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!item) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({ data: item });
  } catch (error) {
    return next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const hasUpdatableField =
      req.body.name !== undefined ||
      req.body.category !== undefined ||
      req.body.price !== undefined ||
      req.body.description !== undefined ||
      req.body.image !== undefined ||
      req.body.image_path !== undefined ||
      req.body.stock !== undefined;

    if (!hasUpdatableField) {
      return res.status(400).json({
        message:
          "At least one of name, category, price, description, image, image_path, or stock must be provided.",
      });
    }

    const validationError = validatePayload(req.body, false);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    let existingItem = null;
    if (req.body.image_path !== undefined) {
      const { data: current, error: existingError } = await supabase
        .from("menu_items")
        .select("id, image_path")
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        if (isMissingColumnError(existingError, "image_path")) {
          const { data: fallbackCurrent, error: fallbackError } = await supabase
            .from("menu_items")
            .select("id")
            .eq("id", id)
            .maybeSingle();

          if (fallbackError) throw fallbackError;
          existingItem = fallbackCurrent;
        } else {
          throw existingError;
        }
      } else {
        existingItem = current;
      }

      if (!existingItem) {
        return res.status(404).json({ message: "Menu item not found." });
      }
    }

    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.category !== undefined)
      updates.category = req.body.category.trim();
    if (req.body.price !== undefined)
      updates.price = roundMoney(req.body.price);
    if (req.body.description !== undefined)
      updates.description = req.body.description.trim();
    if (req.body.image !== undefined) updates.image = req.body.image.trim();
    if (req.body.image_path !== undefined)
      updates.image_path = req.body.image_path.trim();
    if (req.body.stock !== undefined) updates.stock = req.body.stock;

    updates.updated_at = new Date().toISOString();

    let updatedItem = null;
    const { data: updatedWithPath, error: updateWithPathError } = await supabase
      .from("menu_items")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateWithPathError) {
      if (
        isMissingColumnError(updateWithPathError, "image_path") &&
        updates.image_path !== undefined
      ) {
        const { image_path: _ignore, ...updatesWithoutPath } = updates;
        const { data: updatedWithoutPath, error: updateWithoutPathError } =
          await supabase
            .from("menu_items")
            .update(updatesWithoutPath)
            .eq("id", id)
            .select("*")
            .maybeSingle();

        if (updateWithoutPathError) throw updateWithoutPathError;
        updatedItem = updatedWithoutPath;
      } else {
        throw updateWithPathError;
      }
    } else {
      updatedItem = updatedWithPath;
    }

    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    if (
      existingItem &&
      existingItem.image_path &&
      updates.image_path &&
      existingItem.image_path !== updates.image_path
    ) {
      const bucket = process.env.SUPABASE_MENU_IMAGES_BUCKET || "menu-images";
      await supabase.storage.from(bucket).remove([existingItem.image_path]);
    }

    return res.status(200).json({
      message: "Menu item updated successfully.",
      data: updatedItem,
    });
  } catch (error) {
    return next(error);
  }
};

const updateMenuItemStock = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { stock } = req.body;

    if (typeof stock !== "boolean") {
      return res
        .status(400)
        .json({ message: "stock is required and must be a boolean." });
    }

    const { data: updatedItem, error } = await supabase
      .from("menu_items")
      .update({ stock, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({
      message: "Menu item stock updated successfully.",
      data: updatedItem,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    let existingItem = null;
    const { data: withPath, error: existingError } = await supabase
      .from("menu_items")
      .select("id, image_path")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      if (isMissingColumnError(existingError, "image_path")) {
        const { data: fallback, error: fallbackError } = await supabase
          .from("menu_items")
          .select("id")
          .eq("id", id)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        existingItem = fallback;
      } else {
        throw existingError;
      }
    } else {
      existingItem = withPath;
    }

    if (!existingItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    const { data: deletedItem, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!deletedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    if (existingItem.image_path) {
      const bucket = process.env.SUPABASE_MENU_IMAGES_BUCKET || "menu-images";
      await supabase.storage.from(bucket).remove([existingItem.image_path]);
    }

    return res.status(200).json({
      message: "Menu item deleted successfully.",
      deleted_menu_item_id: id,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadMenuImage = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();

    if (!req.file) {
      return res.status(400).json({ message: "file is required." });
    }

    const bucket = process.env.SUPABASE_MENU_IMAGES_BUCKET || "menu-images";

    const originalExt = path.extname(req.file.originalname || "").toLowerCase();
    const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    const ext = allowedExts.has(originalExt) ? originalExt : ".jpg";

    const fileName = `${Date.now()}-${generatePrefixedId("IMG")}${ext}`;
    const objectPath = `menu/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    return res.status(201).json({
      message: "Image uploaded successfully.",
      data: {
        url: data.publicUrl,
        path: objectPath,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createMenuItem,
  listMenuItems,
  getMenuItemById,
  updateMenuItem,
  updateMenuItemStock,
  deleteMenuItem,
  uploadMenuImage,
};
