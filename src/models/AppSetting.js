const { Schema, model } = require("mongoose");

const DEFAULT_SETTINGS = {
  canteen_name: "Main Campus Canteen",
  contact_number: "+1 (555) 123-4567",
  address: "Student Center Building, Floor 1",
  opening_time: "08:00",
  closing_time: "20:00",
  two_factor_enabled: false,
  stripe_secret_key: "",
  stripe_public_key: "",
  cod_enabled: true,
  tax_name: "GST / VAT",
  tax_percentage: 5,
  tax_included: false,
  admin_email: "admin@canteen.edu",
  admin_password: "admin123",
};

const appSettingSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: "default",
      trim: true,
    },
    canteen_name: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.canteen_name,
      trim: true,
    },
    contact_number: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.contact_number,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.address,
      trim: true,
    },
    opening_time: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.opening_time,
      trim: true,
    },
    closing_time: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.closing_time,
      trim: true,
    },
    two_factor_enabled: {
      type: Boolean,
      required: true,
      default: DEFAULT_SETTINGS.two_factor_enabled,
    },
    stripe_secret_key: {
      type: String,
      required: false,
      default: DEFAULT_SETTINGS.stripe_secret_key,
      trim: true,
    },
    stripe_public_key: {
      type: String,
      required: false,
      default: DEFAULT_SETTINGS.stripe_public_key,
      trim: true,
    },
    cod_enabled: {
      type: Boolean,
      required: true,
      default: DEFAULT_SETTINGS.cod_enabled,
    },
    tax_name: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.tax_name,
      trim: true,
    },
    tax_percentage: {
      type: Number,
      required: true,
      default: DEFAULT_SETTINGS.tax_percentage,
      min: 0,
      max: 100,
    },
    tax_included: {
      type: Boolean,
      required: true,
      default: DEFAULT_SETTINGS.tax_included,
    },
    admin_email: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.admin_email,
      trim: true,
    },
    admin_password: {
      type: String,
      required: true,
      default: DEFAULT_SETTINGS.admin_password,
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

appSettingSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const AppSetting = model("AppSetting", appSettingSchema);

module.exports = {
  AppSetting,
  DEFAULT_SETTINGS,
};
