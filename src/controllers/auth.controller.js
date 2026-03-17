const { AppSetting, DEFAULT_SETTINGS } = require("../models/AppSetting");

const SETTINGS_ID = "default";

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "email is required and must be a non-empty string." });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "password is required and must be a string." });
    }

    const settings = await AppSetting.findOne({ id: SETTINGS_ID });

    const storedEmail =
      settings?.admin_email || process.env.ADMIN_EMAIL || DEFAULT_SETTINGS.admin_email;
    const storedPassword =
      settings?.admin_password || process.env.ADMIN_PASSWORD || DEFAULT_SETTINGS.admin_password;

    const normalizedInputEmail = email.trim().toLowerCase();
    const normalizedStoredEmail = String(storedEmail).trim().toLowerCase();

    if (normalizedInputEmail !== normalizedStoredEmail || password !== storedPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({
      message: "Login successful.",
      data: {
        email: storedEmail,
        two_factor_enabled: settings?.two_factor_enabled || false,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
};
