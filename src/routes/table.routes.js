const express = require("express");

const {
  createTable,
  listTables,
  updateTable,
  deleteTable,
} = require("../controllers/table.controller");

const router = express.Router();

router.get("/", listTables);
router.post("/", createTable);
router.patch("/:id", updateTable);
router.delete("/:id", deleteTable);

module.exports = router;
