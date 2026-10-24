/* ============================================================
   CAMPUS GALLERY — /api/campus-gallery
   Published campus photographs managed by administrators.
   Images are stored as base64 data URLs (same pattern as the
   maintenance/mess photo tables) or as external image URLs.
   ============================================================ */
const express = require("express");
const db = require("./db");

const router = express.Router();

const IMAGE_DATA_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGE_CHARS = 400000;
const CATEGORIES = [
  "Hostel Building", "Gardens", "Rooms", "Mess", "Study Room",
  "Gym", "Recreation", "Grounds", "General",
];

function isAdminUser(userId, email) {
  return db.query(
    `SELECT id FROM users WHERE id = ? AND LOWER(email) = LOWER(?) AND role = 'Admin' LIMIT 1`,
    [userId, email]
  ).then(([rows]) => rows.length > 0);
}

function getUserIdEmail(req) {
  const userId = req.headers["x-user-id"]
    ? parseInt(req.headers["x-user-id"], 10)
    : req.body.userId ? parseInt(req.body.userId, 10) : NaN;
  const email = req.headers["x-user-email"]
    ? String(req.headers["x-user-email"]).trim()
    : String(req.body.email || "").trim();
  return { userId, email };
}

/* GET /api/campus-gallery/public — published items only (anyone) */
router.get("/public", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, description, category, image_url AS imageUrl,
              image_data AS imageData, display_order, is_published, is_cover, created_at
       FROM campus_gallery
       WHERE is_published = 1
       ORDER BY is_cover DESC, display_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Gallery public error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load gallery" });
  }
});

/* GET /api/campus-gallery — all items with optional search/filter (admin) */
router.get("/", async (req, res) => {
  try {
    const { userId, email } = getUserIdEmail(req);
    if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const { search, category, published } = req.query;
    let sql = `SELECT id, title, description, category, image_url AS imageUrl,
                      image_data AS imageData, display_order, is_published, is_cover,
                      created_by, created_at
               FROM campus_gallery`;
    const params = [];
    const clauses = [];
    if (search) {
      clauses.push(`(title LIKE ? OR description LIKE ? OR category LIKE ?)`);
      const like = `%${String(search)}%`;
      params.push(like, like, like);
    }
    if (category) {
      clauses.push(`category = ?`);
      params.push(String(category));
    }
    if (published !== undefined && published !== "") {
      clauses.push(`is_published = ?`);
      params.push(String(published) === "1" || String(published) === "true" ? 1 : 0);
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += ` ORDER BY is_cover DESC, display_order ASC, id ASC`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Gallery list error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load gallery items" });
  }
});

/* POST /api/campus-gallery — create item (admin) */
router.post("/", async (req, res) => {
  try {
    const { userId, email } = getUserIdEmail(req);
    if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const { title, description, category, imageUrl, imageData, displayOrder, isPublished, isCover } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!imageUrl && !imageData) {
      return res.status(400).json({ success: false, message: "Image (upload or URL) is required" });
    }
    if (imageData && !IMAGE_DATA_RE.test(String(imageData))) {
      return res.status(400).json({ success: false, message: "Image must be a valid image data URL" });
    }
    if (imageData && String(imageData).length > MAX_IMAGE_CHARS) {
      return res.status(400).json({ success: false, message: "Image is too large" });
    }
    if (imageUrl && !/^https?:\/\/.+/.test(String(imageUrl))) {
      return res.status(400).json({ success: false, message: "Provide a valid image URL" });
    }

    const order = Number(displayOrder || 0);
    const published = isPublished === false || isPublished === 0 || isPublished === "0" ? 0 : 1;
    const cover = isCover === true || isCover === 1 || isCover === "1" ? 1 : 0;

    if (cover) {
      await db.query(`UPDATE campus_gallery SET is_cover = 0 WHERE is_cover = 1`);
    }

    const [result] = await db.query(
      `INSERT INTO campus_gallery (title, description, category, image_url, image_data,
               display_order, is_published, is_cover, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [String(title).trim(), description ? String(description).trim() : null,
       category && CATEGORIES.includes(category) ? category : "General",
       imageUrl || null, imageData || null, order, published, cover, userId]
    );

    const [rows] = await db.query("SELECT * FROM campus_gallery WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, message: "Gallery item added", data: rows[0] });
  } catch (error) {
    console.error("Gallery create error:", error.message);
    res.status(500).json({ success: false, message: "Failed to add gallery item" });
  }
});

/* PUT /api/campus-gallery/:id — update item (admin) */
router.put("/:id", async (req, res) => {
  try {
    const { userId, email } = getUserIdEmail(req);
    if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const galleryId = parseInt(req.params.id, 10);
    if (!Number.isFinite(galleryId)) {
      return res.status(400).json({ success: false, message: "Invalid gallery item" });
    }
    const { title, description, category, imageUrl, imageData, displayOrder, isPublished, isCover } = req.body;

    const [existing] = await db.query("SELECT id FROM campus_gallery WHERE id = ? LIMIT 1", [galleryId]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: "Gallery item not found" });
    }

    const updates = [];
    const params = [];
    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ success: false, message: "Title is required" });
      updates.push(`title = ?`); params.push(String(title).trim());
    }
    if (description !== undefined) { updates.push(`description = ?`); params.push(String(description).trim() || null); }
    if (category !== undefined) { updates.push(`category = ?`); params.push(CATEGORIES.includes(category) ? category : "General"); }
    if (imageUrl !== undefined || imageData !== undefined) {
      if (imageData && !IMAGE_DATA_RE.test(String(imageData))) {
        return res.status(400).json({ success: false, message: "Image must be a valid image data URL" });
      }
      if (imageData && String(imageData).length > MAX_IMAGE_CHARS) {
        return res.status(400).json({ success: false, message: "Image is too large" });
      }
      if (imageUrl !== undefined && imageUrl && !/^https?:\/\/.+/.test(String(imageUrl))) {
        return res.status(400).json({ success: false, message: "Provide a valid image URL" });
      }
      updates.push(`image_url = ?`, `image_data = ?`);
      params.push(imageUrl || null, imageData || null);
    }
    if (displayOrder !== undefined) { updates.push(`display_order = ?`); params.push(Number(displayOrder || 0)); }
    if (isPublished !== undefined) { updates.push(`is_published = ?`); params.push(isPublished === false || isPublished === 0 || isPublished === "0" ? 0 : 1); }
    if (isCover !== undefined) {
      if (isCover === true || isCover === 1 || isCover === "1") {
        await db.query(`UPDATE campus_gallery SET is_cover = 0 WHERE is_cover = 1`);
      }
      updates.push(`is_cover = ?`);
      params.push(isCover === true || isCover === 1 || isCover === "1" ? 1 : 0);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(galleryId);

    await db.query(`UPDATE campus_gallery SET ${updates.join(", ")} WHERE id = ?`, params);

    const [rows] = await db.query("SELECT * FROM campus_gallery WHERE id = ?", [galleryId]);
    res.json({ success: true, message: "Gallery item updated", data: rows[0] });
  } catch (error) {
    console.error("Gallery update error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update gallery item" });
  }
});

/* PATCH /api/campus-gallery/:id/publish — publish or unpublish (admin) */
router.patch("/:id/publish", async (req, res) => {
  try {
    const { userId, email } = getUserIdEmail(req);
    if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const galleryId = parseInt(req.params.id, 10);
    const { isPublished } = req.body;
    if (!Number.isFinite(galleryId)) {
      return res.status(400).json({ success: false, message: "Invalid gallery item" });
    }
    const published = isPublished === false || isPublished === 0 || isPublished === "0" ? 0 : 1;
    const [result] = await db.query(
      `UPDATE campus_gallery SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [published, galleryId]
    );
    if ((result && result.affectedRows) === 0) {
      return res.status(404).json({ success: false, message: "Gallery item not found" });
    }
    res.json({ success: true, message: published ? "Gallery item published" : "Gallery item unpublished" });
  } catch (error) {
    console.error("Gallery publish error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update publication status" });
  }
});

/* DELETE /api/campus-gallery/:id — delete item (admin) */
router.delete("/:id", async (req, res) => {
  try {
    const { userId, email } = getUserIdEmail(req);
    if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }
    const galleryId = parseInt(req.params.id, 10);
    if (!Number.isFinite(galleryId)) {
      return res.status(400).json({ success: false, message: "Invalid gallery item" });
    }
    const [result] = await db.query("DELETE FROM campus_gallery WHERE id = ?", [galleryId]);
    if ((result && result.affectedRows) === 0) {
      return res.status(404).json({ success: false, message: "Gallery item not found" });
    }
    res.json({ success: true, message: "Gallery item deleted" });
  } catch (error) {
    console.error("Gallery delete error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete gallery item" });
  }
});

module.exports = router;