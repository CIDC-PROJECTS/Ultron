const express = require("express");

const {
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderItems,
  deleteOrder,
} = require("../controllers/order.controller");

const router = express.Router();

router.get("/", listOrders);
router.post("/", createOrder);
router.get("/:id", getOrderById);
router.patch("/:id", updateOrder);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/payment-status", updatePaymentStatus);
router.get("/:id/items", getOrderItems);
router.delete("/:id", deleteOrder);

module.exports = router;
