const { randomUUID } = require("crypto");
const { Schema, model } = require("mongoose");

const generateOrderItemId = () => `ITEM-${randomUUID().split("-")[0].toUpperCase()}`;

const orderItemSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateOrderItemId,
      trim: true,
    },
    order_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    menu_id: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    versionKey: false,
  }
);

orderItemSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const OrderItem = model("OrderItem", orderItemSchema);

module.exports = {
  OrderItem,
};
