const express = require("express");
const db = require("./db");

const router = express.Router();

const VALID_CATEGORIES = [
  "Emergency Contact",
  "Medical Facilities",
  "WiFi Information",
  "Laundry Services",
  "Study Room",
  "Water & Electricity",
  "Housekeeping",
  "Entry & Exit Rules",
];
const VALID_STATUS = ["Active", "Inactive"];

const SERVICE_SELECT = `id, category, title, details,
  contact_name AS contactName, contact_phone AS contactPhone,
  photo, status, created_at AS createdAt`;

/* GET /api/services?category=&search= */
router.get("/", async (req, res) => {
  try {
    const category = (req.query.category || "").trim();
    const search = (req.query.search || "").trim();

    let sql = `SELECT ${SERVICE_SELECT} FROM hostel_services`;
    const params = [];
    const where = [];

    if (search) {
      where.push(`(title LIKE ? OR details LIKE ? OR contact_name LIKE ? OR category LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      where.push("category = ?");
      params.push(category);
    }

    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY category ASC, title ASC LIMIT 500`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Services list error:", error);
    res.status(500).json({ success: false, message: "Failed to load services" });
  }
});

/* GET /api/services/:id */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${SERVICE_SELECT} FROM hostel_services WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Service get error:", error);
    res.status(500).json({ success: false, message: "Failed to load service" });
  }
});

/* POST /api/services  (Admin only) */
router.post("/", async (req, res) => {
  try {
    const { category, title, details, contactName, contactPhone, photo, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await db.query(
      `INSERT INTO hostel_services (category, title, details, contact_name, contact_phone, photo, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        VALID_CATEGORIES.includes(category) ? category : "General",
        title.trim(),
        details && details.trim() ? details.trim() : null,
        contactName && contactName.trim() ? contactName.trim() : null,
        contactPhone && contactPhone.trim() ? contactPhone.trim() : null,
        photo && photo.trim() ? photo.trim() : null,
        VALID_STATUS.includes(status) ? status : "Active",
      ]
    );

    const [rows] = await db.query(
      `SELECT ${SERVICE_SELECT} FROM hostel_services WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Service added", data: rows[0] });
  } catch (error) {
    console.error("Service create error:", error);
    res.status(500).json({ success: false, message: "Failed to add service" });
  }
});

/* PUT /api/services/:id  (Admin only) */
router.put("/:id", async (req, res) => {
  try {
    const { category, title, details, contactName, contactPhone, photo, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await db.query(
      `UPDATE hostel_services SET category = ?, title = ?, details = ?,
        contact_name = ?, contact_phone = ?, photo = ?, status = ? WHERE id = ?`,
      [
        VALID_CATEGORIES.includes(category) ? category : "General",
        title.trim(),
        details && details.trim() ? details.trim() : null,
        contactName && contactName.trim() ? contactName.trim() : null,
        contactPhone && contactPhone.trim() ? contactPhone.trim() : null,
        photo && photo.trim() ? photo.trim() : null,
        VALID_STATUS.includes(status) ? status : "Active",
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    const [rows] = await db.query(
      `SELECT ${SERVICE_SELECT} FROM hostel_services WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true, message: "Service updated", data: rows[0] });
  } catch (error) {
    console.error("Service update error:", error);
    res.status(500).json({ success: false, message: "Failed to update service" });
  }
});

/* DELETE /api/services/:id  (Admin only) */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM hostel_services WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service removed" });
  } catch (error) {
    console.error("Service delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove service" });
  }
});

module.exports = router;
