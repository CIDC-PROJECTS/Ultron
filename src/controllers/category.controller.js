const { Category } = require("../models/Category");
const { MenuItem } = require("../models/MenuItem");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeNameKey = (name) => String(name).trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getItemCountByCategoryKeyMap = async () => {
  const groupedItems = await MenuItem.aggregate([
    {
      $project: {
        category_key: { $toLower: "$category" },
      },
    },
    {
      $group: {
        _id: "$category_key",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(groupedItems.map((entry) => [entry._id, entry.count]));
};

const withItemCount = (category, countMap) => ({
  ...category.toJSON(),
  item_count: countMap.get(category.name_key) || 0,
});

const validateCreatePayload = ({ name, description }) => {
  if (!name || typeof name !== "string" || !name.trim()) {
    return "name is required and must be a non-empty string.";
  }

  if (description !== undefined && typeof description !== "string") {
    return "description must be a string.";
  }

  return null;
};

const validateUpdatePayload = ({ name, description }) => {
  if (name === undefined && description === undefined) {
    return "At least one of name or description must be provided.";
  }

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return "name must be a non-empty string.";
  }

  if (description !== undefined && typeof description !== "string") {
    return "description must be a string.";
  }

  return null;
};

const createCategory = async (req, res, next) => {
  try {
    const validationError = validateCreatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { name, description } = req.body;
    const nameKey = normalizeNameKey(name);

    const existingCategory = await Category.findOne({ name_key: nameKey });
    if (existingCategory) {
      return res.status(409).json({ message: "A category with this name already exists." });
    }

    const createdCategory = await Category.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      name_key: nameKey,
    });

    return res.status(201).json({
      message: "Category created successfully.",
      data: {
        ...createdCategory.toJSON(),
        item_count: 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const { search, page, limit, sort_by, sort_order } = req.query;

    const filters = {};

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      filters.$or = [{ name: regex }, { description: regex }];
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT)))
    );

    const skip = (safePage - 1) * safeLimit;

    const allowedSortFields = ["name", "created_at", "updated_at"];
    const sortField = allowedSortFields.includes(String(sort_by))
      ? String(sort_by)
      : "name";
    const sortDirection = sort_order === "desc" ? -1 : 1;

    const [categories, totalCount, itemCountsByCategoryKey] = await Promise.all([
      Category.find(filters)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit),
      Category.countDocuments(filters),
      getItemCountByCategoryKeyMap(),
    ]);

    return res.status(200).json({
      data: categories.map((category) => withItemCount(category, itemCountsByCategoryKey)),
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

const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({ id });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const linkedItemsCount = await MenuItem.countDocuments({
      category: new RegExp(`^${escapeRegex(category.name)}$`, "i"),
    });

    return res.status(200).json({
      data: {
        ...category.toJSON(),
        item_count: linkedItemsCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validationError = validateUpdatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingCategory = await Category.findOne({ id });
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found." });
    }

    const updates = {};
    let nextName = null;

    if (req.body.name !== undefined) {
      nextName = req.body.name.trim();
      const nextNameKey = normalizeNameKey(nextName);

      const categoryWithSameName = await Category.findOne({
        name_key: nextNameKey,
        id: { $ne: id },
      });

      if (categoryWithSameName) {
        return res.status(409).json({ message: "A category with this name already exists." });
      }

      updates.name = nextName;
      updates.name_key = nextNameKey;
    }

    if (req.body.description !== undefined) {
      updates.description = req.body.description.trim();
    }

    const updatedCategory = await Category.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (nextName && nextName !== existingCategory.name) {
      await MenuItem.updateMany(
        { category: new RegExp(`^${escapeRegex(existingCategory.name)}$`, "i") },
        { $set: { category: nextName } }
      );
    }

    const linkedItemsCount = await MenuItem.countDocuments({
      category: new RegExp(`^${escapeRegex(updatedCategory.name)}$`, "i"),
    });

    return res.status(200).json({
      message: "Category updated successfully.",
      data: {
        ...updatedCategory.toJSON(),
        item_count: linkedItemsCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({ id });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const linkedItemsCount = await MenuItem.countDocuments({
      category: new RegExp(`^${escapeRegex(category.name)}$`, "i"),
    });

    if (linkedItemsCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete a category that is used by menu items. Move items to another category first.",
      });
    }

    await Category.deleteOne({ id });

    return res.status(200).json({
      message: "Category deleted successfully.",
      deleted_category_id: id,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
