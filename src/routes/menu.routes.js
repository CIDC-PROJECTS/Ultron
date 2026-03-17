const express = require("express");

const {
  createMenuItem,
  listMenuItems,
  getMenuItemById,
  updateMenuItem,
  updateMenuItemStock,
  deleteMenuItem,
} = require("../controllers/menu.controller");

const router = express.Router();

router.get("/", listMenuItems);
router.post("/", createMenuItem);
router.get("/:id", getMenuItemById);
router.patch("/:id", updateMenuItem);
router.patch("/:id/stock", updateMenuItemStock);
router.delete("/:id", deleteMenuItem);

module.exports = router;
