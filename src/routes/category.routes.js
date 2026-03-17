const express = require("express");

const {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const router = express.Router();

router.get("/", listCategories);
router.post("/", createCategory);
router.get("/:id", getCategoryById);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
