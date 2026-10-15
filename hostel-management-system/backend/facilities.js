const express = require("express");
const db = require("./db");

const router = express.Router();

const VALID_CATEGORIES = [
  "Warden",
  "Mess & Kitchen",
  "Cleaning",
  "Ground & Sports",
  "Charges & Billing",
  "Safety & Rules",
  "General",
];
const VALID_STATUS = ["Active", "Inactive"];

const FACILITY_SELECT = `id, category, title, details,
  contact_name AS contactName, contact_phone AS contactPhone,
  status, created_at AS createdAt`;

/* GET /api/facilities?search=&category= */
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();

    let sql = `SELECT ${FACILITY_SELECT} FROM facilities`;
    const params = [];
    const where = [];

    if (search) {
      where.push(`(title LIKE ? OR details LIKE ? OR contact_name LIKE ? OR category LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (VALID_CATEGORIES.includes(category)) {
      where.push(`category = ?`);
      params.push(category);
    }

    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY
      CASE category
        WHEN 'Warden' THEN 0
        WHEN 'Mess & Kitchen' THEN 1
        WHEN 'Cleaning' THEN 2
        WHEN 'Ground & Sports' THEN 3
        WHEN 'Charges & Billing' THEN 4
        WHEN 'Safety & Rules' THEN 5
        ELSE 6
      END, title ASC LIMIT 500`;

    const [rows] = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Facilities list error:", error);
    res.status(500).json({ success: false, message: "Failed to load facilities" });
  }
});

/* POST /api/facilities */
router.post("/", async (req, res) => {
  try {
    const { category, title, details, contactName, contactPhone, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await db.query(
      `INSERT INTO facilities (category, title, details, contact_name, contact_phone, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        VALID_CATEGORIES.includes(category) ? category : "General",
        title.trim(),
        details && details.trim() ? details.trim() : null,
        contactName && contactName.trim() ? contactName.trim() : null,
        contactPhone && contactPhone.trim() ? contactPhone.trim() : null,
        VALID_STATUS.includes(status) ? status : "Active",
      ]
    );

    const [rows] = await db.query(
      `SELECT ${FACILITY_SELECT} FROM facilities WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Facility added", data: rows[0] });
  } catch (error) {
    console.error("Facility create error:", error);
    res.status(500).json({ success: false, message: "Failed to add facility" });
  }
});

/* PUT /api/facilities/:id */
router.put("/:id", async (req, res) => {
  try {
    const { category, title, details, contactName, contactPhone, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await db.query(
      `UPDATE facilities SET category = ?, title = ?, details = ?,
        contact_name = ?, contact_phone = ?, status = ? WHERE id = ?`,
      [
        VALID_CATEGORIES.includes(category) ? category : "General",
        title.trim(),
        details && details.trim() ? details.trim() : null,
        contactName && contactName.trim() ? contactName.trim() : null,
        contactPhone && contactPhone.trim() ? contactPhone.trim() : null,
        VALID_STATUS.includes(status) ? status : "Active",
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Facility not found" });
    }

    const [rows] = await db.query(
      `SELECT ${FACILITY_SELECT} FROM facilities WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true, message: "Facility updated", data: rows[0] });
  } catch (error) {
    console.error("Facility update error:", error);
    res.status(500).json({ success: false, message: "Failed to update facility" });
  }
});

/* DELETE /api/facilities/:id */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM facilities WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Facility not found" });
    }

    res.json({ success: true, message: "Facility removed" });
  } catch (error) {
    console.error("Facility delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove facility" });
  }
});

module.exports = router;
