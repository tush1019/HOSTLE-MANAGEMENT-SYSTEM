/* ============================================================
   SETTINGS — /api/settings
   Application-wide settings (administrators only) and
   per-user display preferences (owners only).
   ============================================================ */
const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const APP_SETTING_KEYS = [
  "app_name", "app_tagline", "hostel_name", "hostel_contact",
  "hostel_address", "accent_color", "theme", "hostel_rules",
];

function getUserIdEmail(req) {
  const userId = req.headers["x-user-id"]
    ? parseInt(req.headers["x-user-id"], 10)
    : req.body.userId ? parseInt(req.body.userId, 10) : NaN;
  const email = req.headers["x-user-email"]
    ? String(req.headers["x-user-email"]).trim()
    : String(req.body.email || "").trim();
  return { userId, email };
}

async function isAdminUser(userId, email) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE id = ? AND LOWER(email) = LOWER(?) AND role = 'Admin' LIMIT 1`,
    [userId, email]
  );
  return rows.length > 0;
}

/* GET /api/settings — all app settings (admin) */
router.get("/", async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const [rows] = await db.query("SELECT setting_key, setting_value, updated_by, updated_at FROM app_settings");
    const settings = {};
    (rows || []).forEach((r) => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Settings get error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load settings" });
  }
});

router.put("/:key", async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const key = String(req.params.key);
    if (!APP_SETTING_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: "Unsupported setting key" });
    }
    const { value } = req.body;
    const settingValue = value === undefined || value === null ? null : String(value);
    const userId = req.user.id;

    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
      [key, settingValue, userId]
    );
    res.json({ success: true, message: "Setting updated", data: { [key]: settingValue } });
  } catch (error) {
    console.error("Settings update error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update setting" });
  }
});

/* GET /api/settings/me — current user's display preferences (owner) */
router.get("/me", async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT theme, accent_color, layout, notifications FROM user_preferences WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.json({ success: true, data: { theme: "light", accent_color: "emerald", layout: "default", notifications: 1 } });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Preferences get error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load preferences" });
  }
});

/* PUT /api/settings/me — update current user's display preferences (owner) */
router.put("/me", async (req, res) => {
  try {
    const userId = req.user.id;
    const [owned] = await db.query(
      `SELECT id FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!owned.length) {
      return res.status(403).json({ success: false, message: "Session does not match any account" });
    }

    const { theme, accent_color, layout, notifications } = req.body;
    const updates = [];
    const params = [];
    if (theme !== undefined) { updates.push(`theme = ?`); params.push(String(theme)); }
    if (accent_color !== undefined) { updates.push(`accent_color = ?`); params.push(String(accent_color)); }
    if (layout !== undefined) { updates.push(`layout = ?`); params.push(String(layout)); }
    if (notifications !== undefined) { updates.push(`notifications = ?`); params.push(notifications === false || notifications === 0 || notifications === "0" ? 0 : 1); }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No preferences to update" });
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    await db.query(
      `INSERT INTO user_preferences (user_id, theme, accent_color, layout, notifications, updated_at)
       VALUES (?, 'light', 'emerald', 'default', 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
      [userId, ...params]
    );
    res.json({ success: true, message: "Preferences saved" });
  } catch (error) {
    console.error("Preferences update error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save preferences" });
  }
});

module.exports = router;