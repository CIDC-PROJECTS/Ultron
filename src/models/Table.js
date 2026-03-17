const { randomUUID } = require("crypto");
const { Schema, model } = require("mongoose");

const TABLE_STATUSES = ["Active", "Inactive", "Needs Cleaning"];

const generateTableId = () => `TABLE-${randomUUID().split("-")[0].toUpperCase()}`;

const tableSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateTableId,
      trim: true,
    },
    number: {
      type: String,
      required: true,
      trim: true,
    },
    number_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: TABLE_STATUSES,
      default: "Active",
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

tableSchema.pre("validate", function applyNumberKey(next) {
  if (typeof this.number === "string") {
    const normalizedNumber = this.number.trim().toUpperCase();
    this.number = normalizedNumber;
    this.number_key = normalizedNumber.toLowerCase();
  }

  next();
});

tableSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.number_key;
    return ret;
  },
});

const Table = model("Table", tableSchema);

module.exports = {
  Table,
  TABLE_STATUSES,
};
