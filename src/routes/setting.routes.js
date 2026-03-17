const express = require("express");

const {
  getSettings,
  updateSettings,
  updatePassword,
} = require("../controllers/setting.controller");

const router = express.Router();

router.get("/", getSettings);
router.patch("/", updateSettings);
router.patch("/password", updatePassword);

module.exports = router;
