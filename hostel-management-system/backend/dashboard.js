const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[dashboard] ${label} failed:`, error && error.code, error && error.message);
    return fallback;
  }
}

router.get("/", requireRole("Admin", "Student", "Faculty"), async (req, res) => {
  try {
    const students = await safe("students", async () => {
      const [rows] = await db.query(`SELECT COUNT(*) AS total, SUM(status = 'Active') AS active FROM students`);
      const r = (rows && rows[0]) || { total: 0, active: 0 };
      return { total: Number(r.total) || 0, active: Number(r.active) || 0 };
    }, { total: 0, active: 0, unavailable: true });

    const rooms = await safe("rooms", async () => {
      const [rows] = await db.query(`SELECT COUNT(*) AS total, SUM(status = 'Occupied') AS occupied, SUM(status = 'Available') AS available, SUM(status = 'Maintenance') AS maintenance, SUM(wing = 'Boys') AS boys, SUM(wing = 'Girls') AS girls, COALESCE(SUM(capacity),0) AS beds, COALESCE(SUM(occupied),0) AS bedsFilled FROM rooms`);
      const r = (rows && rows[0]) || {};
      const out = {
        total: Number(r.total) || 0,
        occupied: Number(r.occupied) || 0,
        available: Number(r.available) || 0,
        maintenance: Number(r.maintenance) || 0,
        boys: Number(r.boys) || 0,
        girls: Number(r.girls) || 0,
        beds: Number(r.beds) || 0,
        bedsFilled: Number(r.bedsFilled) || 0,
      };
      out.occupancyRate = out.beds > 0 ? Math.round((out.bedsFilled / out.beds) * 100) : 0;
      return out;
    }, { total: 0, occupied: 0, available: 0, maintenance: 0, boys: 0, girls: 0, beds: 0, bedsFilled: 0, occupancyRate: 0, unavailable: true });

    const fees = await safe("fees", async () => {
      const [rows] = await db.query(`SELECT COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END),0) AS paid, COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END),0) AS pending, SUM(status = 'Paid') AS paidCount, SUM(status = 'Pending') AS pendingCount FROM fees`);
      const r = (rows && rows[0]) || {};
      return { paid: Number(r.paid) || 0, pending: Number(r.pending) || 0, paidCount: Number(r.paidCount) || 0, pendingCount: Number(r.pendingCount) || 0 };
    }, { paid: 0, pending: 0, paidCount: 0, pendingCount: 0, unavailable: true });

    const complaints = await safe("complaints", async () => {
      const [rows] = await db.query(`SELECT COUNT(*) AS total, SUM(status = 'Pending') AS pending, SUM(status = 'In Progress') AS inProgress, SUM(status = 'Resolved') AS resolved FROM complaints`);
      const r = (rows && rows[0]) || {};
      return { total: Number(r.total) || 0, pending: Number(r.pending) || 0, inProgress: Number(r.inProgress) || 0, resolved: Number(r.resolved) || 0 };
    }, { total: 0, pending: 0, inProgress: 0, resolved: 0, unavailable: true });

    const monthlyFees = await safe("monthlyFees", async () => {
      const [rows] = await db.query(`SELECT DATE_FORMAT(payment_date, '%b') AS month, SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS amount FROM fees WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(payment_date, '%Y-%m'), DATE_FORMAT(payment_date, '%b') ORDER BY MIN(payment_date) ASC`);
      return (rows || []).map((row) => ({ month: row.month, amount: Number(row.amount) || 0 }));
    }, []);

    const recentComplaints = await safe("recentComplaints", async () => {
      const [rows] = await db.query(`SELECT complaint_code AS code, student_name AS student, subject, status FROM complaints ORDER BY created_at DESC LIMIT 5`);
      return rows || [];
    }, []);

    // recentFees contains individual student names and amounts — Admin only
    let recentFees = [];
    if (req.user.role === "Admin") {
      recentFees = await safe("recentFees", async () => {
      const [rows] = await db.query(`SELECT payment_code AS code, student_name AS student, amount, status FROM fees ORDER BY created_at DESC LIMIT 5`);
      return rows || [];
      }, []);
    }

    const notices = await safe("notices", async () => {
      const [rows] = await db.query(`SELECT id, title, message, DATE_FORMAT(created_at, '%d %b %Y') AS date FROM notices ORDER BY created_at DESC LIMIT 5`);
      return rows || [];
    }, []);

    res.json({
      success: true,
      data: {
        students,
        rooms,
        fees,
        complaints,
        monthlyFees,
        recentComplaints,
        recentFees,
        notices,
      },
    });
  } catch (error) {
    console.error("[dashboard] Fatal error:", error && error.code, error && error.message);
    res.status(500).json({ success: false, message: "Failed to load dashboard data" });
  }
});

module.exports = router;

