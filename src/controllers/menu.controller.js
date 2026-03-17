const { MenuItem } = require("../models/MenuItem");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

const parseBooleanQuery = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).toLowerCase().trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return null;
};

const validatePayload = (payload, isCreate = false) => {
  const {
    name,
    category,
    price,
    description,
    image,
    stock,
  } = payload;

  if (isCreate && (name === undefined || category === undefined || price === undefined)) {
    return "name, category, and price are required.";
  }

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return "name must be a non-empty string.";
  }

  if (category !== undefined && (typeof category !== "string" || !category.trim())) {
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

    const { name, category, price, description, image, stock } = req.body;

    const createdItem = await MenuItem.create({
      name: name.trim(),
      category: category.trim(),
      price: roundMoney(price),
      description: description ? description.trim() : "",
      image: image ? image.trim() : "",
      ...(stock !== undefined && { stock }),
    });

    return res.status(201).json({
      message: "Menu item created successfully.",
      data: createdItem.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

const listMenuItems = async (req, res, next) => {
  try {
    const {
      search,
      category,
      stock,
      page,
      limit,
      sort_by,
      sort_order,
    } = req.query;

    const parsedStock = parseBooleanQuery(stock);
    if (stock !== undefined && parsedStock === null) {
      return res.status(400).json({ message: "stock must be either true or false." });
    }

    const filters = {};

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      filters.$or = [{ name: regex }, { description: regex }, { category: regex }];
    }

    if (category && String(category).trim()) {
      filters.category = new RegExp(`^${String(category).trim()}$`, "i");
    }

    if (parsedStock !== undefined) {
      filters.stock = parsedStock;
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT)))
    );

    const skip = (safePage - 1) * safeLimit;

    const allowedSortFields = ["name", "price", "created_at", "updated_at"];
    const sortField = allowedSortFields.includes(String(sort_by))
      ? String(sort_by)
      : "created_at";
    const sortDirection = sort_order === "asc" ? 1 : -1;

    const [items, totalCount] = await Promise.all([
      MenuItem.find(filters)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit),
      MenuItem.countDocuments(filters),
    ]);

    return res.status(200).json({
      data: items.map((item) => item.toJSON()),
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

const getMenuItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await MenuItem.findOne({ id });
    if (!item) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({ data: item.toJSON() });
  } catch (error) {
    return next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hasUpdatableField =
      req.body.name !== undefined ||
      req.body.category !== undefined ||
      req.body.price !== undefined ||
      req.body.description !== undefined ||
      req.body.image !== undefined ||
      req.body.stock !== undefined;

    if (!hasUpdatableField) {
      return res.status(400).json({
        message:
          "At least one of name, category, price, description, image, or stock must be provided.",
      });
    }

    const validationError = validatePayload(req.body, false);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.category !== undefined) updates.category = req.body.category.trim();
    if (req.body.price !== undefined) updates.price = roundMoney(req.body.price);
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    if (req.body.image !== undefined) updates.image = req.body.image.trim();
    if (req.body.stock !== undefined) updates.stock = req.body.stock;

    const updatedItem = await MenuItem.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({
      message: "Menu item updated successfully.",
      data: updatedItem.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

const updateMenuItemStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (typeof stock !== "boolean") {
      return res.status(400).json({ message: "stock is required and must be a boolean." });
    }

    const updatedItem = await MenuItem.findOneAndUpdate(
      { id },
      { $set: { stock } },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({
      message: "Menu item stock updated successfully.",
      data: updatedItem.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedItem = await MenuItem.findOneAndDelete({ id });
    if (!deletedItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    return res.status(200).json({
      message: "Menu item deleted successfully.",
      deleted_menu_item_id: id,
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
};
