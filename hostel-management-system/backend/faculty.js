const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole("Faculty", "Admin"));

/* GET /api/faculty/dashboard */
router.get("/dashboard", async (req, res) => {
  try {
    const [studentsRows] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(status = 'Active') AS active,
             SUM(status = 'Pending') AS pending
      FROM students
    `);
    const students = studentsRows[0] || { total: 0, active: 0, pending: 0 };

    const [roomsRows] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(status = 'Occupied') AS occupied,
             SUM(status = 'Available') AS available
      FROM rooms
    `);
    const rooms = roomsRows[0] || { total: 0, occupied: 0, available: 0 };

    const [complaintsRows] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(status = 'Pending') AS pending,
             SUM(status = 'In Progress') AS inProgress,
             SUM(status = 'Resolved') AS resolved
      FROM complaints
    `);
    const complaints = complaintsRows[0] || { total: 0, pending: 0, inProgress: 0, resolved: 0 };

    const [notices] = await db.query(`
      SELECT id, title, message, audience,
             DATE_FORMAT(created_at, '%d %b %Y') AS date
      FROM notices
      WHERE audience IN ('All', 'Students', 'Faculty')
      ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        students: {
          total: Number(students.total || 0),
          active: Number(students.active || 0),
          pending: Number(students.pending || 0),
        },
        rooms: {
          total: Number(rooms.total || 0),
          occupied: Number(rooms.occupied || 0),
          available: Number(rooms.available || 0),
        },
        complaints: {
          total: Number(complaints.total || 0),
          pending: Number(complaints.pending || 0),
          inProgress: Number(complaints.inProgress || 0),
          resolved: Number(complaints.resolved || 0),
        },
        notices,
      },
    });
  } catch (error) {
    console.error("Faculty dashboard error:", error);
    res.status(500).json({ success: false, message: "Failed to load faculty dashboard" });
  }
});

module.exports = router;