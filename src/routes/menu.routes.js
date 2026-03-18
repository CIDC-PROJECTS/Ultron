const express = require("express");
const multer = require("multer");

const {
  createMenuItem,
  listMenuItems,
  getMenuItemById,
  updateMenuItem,
  updateMenuItemStock,
  deleteMenuItem,
  uploadMenuImage,
} = require("../controllers/menu.controller");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]);

    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Only PNG, JPG, and WEBP images are allowed."));
    }

    return cb(null, true);
  },
});

router.get("/", listMenuItems);
router.post("/", createMenuItem);
router.post("/upload-image", upload.single("file"), uploadMenuImage);
router.get("/:id", getMenuItemById);
router.patch("/:id", updateMenuItem);
router.patch("/:id/stock", updateMenuItemStock);
router.delete("/:id", deleteMenuItem);

module.exports = router;
