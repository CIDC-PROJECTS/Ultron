const { AppSetting, DEFAULT_SETTINGS } = require("../models/AppSetting");

const SETTINGS_ID = "default";

const SETTINGS_FIELDS = [
  "canteen_name",
  "contact_number",
  "address",
  "opening_time",
  "closing_time",
  "two_factor_enabled",
  "stripe_secret_key",
  "stripe_public_key",
  "cod_enabled",
  "tax_name",
  "tax_percentage",
  "tax_included",
  "admin_email",
];

const isTimeString = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const sanitizeSettingsForResponse = (settingsDoc) => {
  const data = settingsDoc.toJSON();
  delete data.admin_password;
  return data;
};

const ensureSettingsDocument = async () => {
  let settings = await AppSetting.findOne({ id: SETTINGS_ID });

  if (!settings) {
    settings = await AppSetting.create({
      id: SETTINGS_ID,
      ...DEFAULT_SETTINGS,
      admin_email: process.env.ADMIN_EMAIL || DEFAULT_SETTINGS.admin_email,
      admin_password: process.env.ADMIN_PASSWORD || DEFAULT_SETTINGS.admin_password,
    });
  }

  return settings;
};

const getSettings = async (_req, res, next) => {
  try {
    const settings = await ensureSettingsDocument();

    return res.status(200).json({
      data: sanitizeSettingsForResponse(settings),
    });
  } catch (error) {
    return next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const updates = {};

    for (const field of SETTINGS_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: `At least one setting must be provided. Allowed fields: ${SETTINGS_FIELDS.join(", ")}.`,
      });
    }

    if (updates.canteen_name !== undefined && (typeof updates.canteen_name !== "string" || !updates.canteen_name.trim())) {
      return res.status(400).json({ message: "canteen_name must be a non-empty string." });
    }

    if (updates.contact_number !== undefined && typeof updates.contact_number !== "string") {
      return res.status(400).json({ message: "contact_number must be a string." });
    }

    if (updates.address !== undefined && typeof updates.address !== "string") {
      return res.status(400).json({ message: "address must be a string." });
    }

    if (updates.opening_time !== undefined && (typeof updates.opening_time !== "string" || !isTimeString(updates.opening_time))) {
      return res.status(400).json({ message: "opening_time must be in HH:mm format." });
    }

    if (updates.closing_time !== undefined && (typeof updates.closing_time !== "string" || !isTimeString(updates.closing_time))) {
      return res.status(400).json({ message: "closing_time must be in HH:mm format." });
    }

    if (updates.two_factor_enabled !== undefined && typeof updates.two_factor_enabled !== "boolean") {
      return res.status(400).json({ message: "two_factor_enabled must be a boolean." });
    }

    if (updates.stripe_secret_key !== undefined && typeof updates.stripe_secret_key !== "string") {
      return res.status(400).json({ message: "stripe_secret_key must be a string." });
    }

    if (updates.stripe_public_key !== undefined && typeof updates.stripe_public_key !== "string") {
      return res.status(400).json({ message: "stripe_public_key must be a string." });
    }

    if (updates.cod_enabled !== undefined && typeof updates.cod_enabled !== "boolean") {
      return res.status(400).json({ message: "cod_enabled must be a boolean." });
    }

    if (updates.tax_name !== undefined && (typeof updates.tax_name !== "string" || !updates.tax_name.trim())) {
      return res.status(400).json({ message: "tax_name must be a non-empty string." });
    }

    if (
      updates.tax_percentage !== undefined &&
      (typeof updates.tax_percentage !== "number" || updates.tax_percentage < 0 || updates.tax_percentage > 100)
    ) {
      return res.status(400).json({ message: "tax_percentage must be a number between 0 and 100." });
    }

    if (updates.tax_included !== undefined && typeof updates.tax_included !== "boolean") {
      return res.status(400).json({ message: "tax_included must be a boolean." });
    }

    if (updates.admin_email !== undefined && (typeof updates.admin_email !== "string" || !updates.admin_email.trim())) {
      return res.status(400).json({ message: "admin_email must be a non-empty string." });
    }

    const normalizedUpdates = {
      ...updates,
      ...(updates.canteen_name !== undefined && { canteen_name: updates.canteen_name.trim() }),
      ...(updates.contact_number !== undefined && { contact_number: updates.contact_number.trim() }),
      ...(updates.address !== undefined && { address: updates.address.trim() }),
      ...(updates.opening_time !== undefined && { opening_time: updates.opening_time.trim() }),
      ...(updates.closing_time !== undefined && { closing_time: updates.closing_time.trim() }),
      ...(updates.stripe_secret_key !== undefined && { stripe_secret_key: updates.stripe_secret_key.trim() }),
      ...(updates.stripe_public_key !== undefined && { stripe_public_key: updates.stripe_public_key.trim() }),
      ...(updates.tax_name !== undefined && { tax_name: updates.tax_name.trim() }),
      ...(updates.admin_email !== undefined && { admin_email: updates.admin_email.trim() }),
    };

    await ensureSettingsDocument();

    const updatedSettings = await AppSetting.findOneAndUpdate(
      { id: SETTINGS_ID },
      { $set: normalizedUpdates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Settings updated successfully.",
      data: sanitizeSettingsForResponse(updatedSettings),
    });
  } catch (error) {
    return next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || typeof current_password !== "string") {
      return res.status(400).json({ message: "current_password is required." });
    }

    if (!new_password || typeof new_password !== "string" || new_password.trim().length < 4) {
      return res.status(400).json({ message: "new_password must be at least 4 characters long." });
    }

    const settings = await ensureSettingsDocument();

    if (settings.admin_password !== current_password) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    settings.admin_password = new_password.trim();
    await settings.save();

    return res.status(200).json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updatePassword,
};
