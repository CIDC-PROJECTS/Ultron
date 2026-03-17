const { randomUUID } = require("crypto");
const { Schema, model } = require("mongoose");

const generateMenuItemId = () => `MENU-${randomUUID().split("-")[0].toUpperCase()}`;

const menuItemSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateMenuItemId,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    stock: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

menuItemSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const MenuItem = model("MenuItem", menuItemSchema);

module.exports = {
  MenuItem,
};
