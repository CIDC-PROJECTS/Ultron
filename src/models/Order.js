const { randomUUID } = require("crypto");
const { Schema, model } = require("mongoose");

const ORDER_STATUSES = ["Pending", "Preparing", "Delivered", "Cancelled"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];

const generateOrderId = () => `ORD-${randomUUID().split("-")[0].toUpperCase()}`;

const orderSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateOrderId,
      trim: true,
    },
    user_id: {
      type: String,
      required: true,
      trim: true,
    },
    table_id: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "Pending",
      required: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

orderSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const Order = model("Order", orderSchema);

module.exports = {
  Order,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
};
