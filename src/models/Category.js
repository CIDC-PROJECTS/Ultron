const { randomUUID } = require("crypto");
const { Schema, model } = require("mongoose");

const generateCategoryId = () => `CAT-${randomUUID().split("-")[0].toUpperCase()}`;

const categorySchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateCategoryId,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    name_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
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

categorySchema.pre("validate", function applyNameKey(next) {
  if (typeof this.name === "string") {
    const normalizedName = this.name.trim();
    this.name = normalizedName;
    this.name_key = normalizedName.toLowerCase();
  }

  next();
});

categorySchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.name_key;
    return ret;
  },
});

const Category = model("Category", categorySchema);

module.exports = {
  Category,
};
