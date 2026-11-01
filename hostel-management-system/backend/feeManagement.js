const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
const adminOnly = [authMiddleware, requireRole("Admin")];

function audit(actor, action, entity, entityId, details) {
  db.query(
    `INSERT INTO fee_audit_logs (actor_id, actor_role, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)`,
    [actor?.id || null, actor?.role || null, action, entity || null, entityId || null, details ? JSON.stringify(details) : null]
  ).catch(() => {});
}

// SETTINGS
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM fee_payment_settings ORDER BY id DESC LIMIT 1`);
    const s = rows && rows[0] ? rows[0] : {};
    res.json({ success: true, data: { accountHolder: s.account_holder || null, bankName: s.bank_name || null, accountNumber: s.account_number || null, ifsc: s.ifsc || null, branch: s.branch || null, accountType: s.account_type || null, upiId: s.upi_id || null, qrImagePath: s.qr_image_path || null, beneficiaryName: s.beneficiary_name || null, instructions: s.instructions || null } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load settings" }); }
});

router.put("/settings", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    const [rows] = await db.query(`SELECT id FROM fee_payment_settings ORDER BY id DESC LIMIT 1`);
    if (rows && rows.length) {
      await db.query(`UPDATE fee_payment_settings SET account_holder=?, bank_name=?, account_number=?, ifsc=?, branch=?, account_type=?, upi_id=?, qr_image_path=?, beneficiary_name=?, instructions=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [b.accountHolder || null, b.bankName || null, b.accountNumber || null, b.ifsc || null, b.branch || null, b.accountType || null, b.upiId || null, b.qrImagePath || null, b.beneficiaryName || null, b.instructions || null, rows[0].id]);
    } else {
      await db.query(`INSERT INTO fee_payment_settings (account_holder, bank_name, account_number, ifsc, branch, account_type, upi_id, qr_image_path, beneficiary_name, instructions) VALUES (?,?,?,?,?,?,?,?,?,?)`, [b.accountHolder || null, b.bankName || null, b.accountNumber || null, b.ifsc || null, b.branch || null, b.accountType || null, b.upiId || null, b.qrImagePath || null, b.beneficiaryName || null, b.instructions || null]);
    }
    audit(req.user, "UPDATE_PAYMENT_SETTINGS", "fee_payment_settings", null, b);
    res.json({ success: true, message: "Settings saved" });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to save settings" }); }
});

// CATEGORIES
router.get("/categories", adminOnly, async (req, res) => {
  try { const [rows] = await db.query(`SELECT * FROM fee_categories ORDER BY id DESC`); res.json({ success: true, data: rows || [] }); }
  catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.post("/categories", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ success: false, message: "Name required" });
    const [r] = await db.query(`INSERT INTO fee_categories (name, description, amount, frequency, due_day, late_fee, active) VALUES (?,?,?,?,?,?,?)`, [b.name, b.description || null, Number(b.amount) || 0, b.frequency || "Monthly", b.dueDay || null, Number(b.lateFee) || 0, b.active === false ? 0 : 1]);
    audit(req.user, "CREATE_FEE_CATEGORY", "fee_category", r.insertId, b);
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

// MY FEES
router.get("/my/fees", authMiddleware, async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();
    const [rows] = await db.query(`SELECT * FROM student_fees WHERE LOWER(student_email)=? OR user_id=? ORDER BY due_date ASC`, [email, req.user.id]);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load fees" }); }
});

router.get("/my/overview", authMiddleware, async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();
    const [rows] = await db.query(`SELECT * FROM student_fees WHERE LOWER(student_email)=? OR user_id=?`, [email, req.user.id]);
    let total = 0, paid = 0, pending = 0, overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    (rows || []).forEach((r) => {
      const amt = Number(r.amount || 0) - Number(r.discount || 0) + Number(r.late_fee || 0);
      total += amt;
      const p = Number(r.paid_amount || 0);
      paid += p;
      const rem = amt - p;
      if (rem > 0) { pending += rem; if (r.due_date && r.due_date < today) overdue += rem; }
    });
    const nextDue = (rows || []).filter((r) => Number(r.amount) - Number(r.paid_amount || 0) > 0).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0];
    res.json({ success: true, data: { total, paid, pending, overdue, nextDueDate: nextDue ? nextDue.due_date : null, count: (rows || []).length } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load overview" }); }
});

router.post("/my/payments", authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be positive" });
    if (!b.transactionRef) return res.status(400).json({ success: false, message: "Transaction reference required" });
    const normalizedRef = String(b.transactionRef).trim().toUpperCase();
    const [dup] = await db.query(`SELECT id FROM fee_payments WHERE UPPER(TRIM(transaction_ref))=?`, [normalizedRef]);
    if (dup && dup.length) return res.status(409).json({ success: false, message: "Duplicate transaction reference" });
    let studentFeeId = b.studentFeeId || null;
    if (studentFeeId) {
      const [sf] = await db.query(`SELECT * FROM student_fees WHERE id=?`, [studentFeeId]);
      if (!sf || !sf.length) return res.status(404).json({ success: false, message: "Fee record not found" });
      const fee = sf[0];
      const email = (req.user.email || "").toLowerCase();
      if (fee.user_id && fee.user_id !== req.user.id && (fee.student_email || "").toLowerCase() !== email) return res.status(403).json({ success: false, message: "Not your fee record" });
    }
    const [r] = await db.query(`INSERT INTO fee_payments (student_fee_id, user_id, student_name, student_email, amount, method, transaction_ref, payment_date, bank_reference, proof_path, remarks, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [studentFeeId, req.user.id, req.user.name || req.user.email, req.user.email, amount, b.method || "UPI", normalizedRef, b.paymentDate || new Date().toISOString().slice(0,10), b.bankReference || null, b.proofPath || null, b.remarks || null, "Pending Verification"]);
    audit(req.user, "SUBMIT_PAYMENT", "fee_payment", r.insertId, { amount, method: b.method });
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to submit payment" }); }
});

router.get("/my/payments", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM fee_payments WHERE user_id=? OR LOWER(student_email)=? ORDER BY created_at DESC`, [req.user.id, (req.user.email || "").toLowerCase()]);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load payments" }); }
});

// STUDENT FEE OVERVIEW — total assigned, paid, pending, overdue
router.get("/my/overview", authMiddleware, async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();
    const [fees] = await db.query(`SELECT * FROM student_fees WHERE LOWER(student_email) = ? OR user_id = ?`, [email, req.user.id]);
    const [payments] = await db.query(`SELECT * FROM fee_payments WHERE user_id = ? OR LOWER(student_email) = ?`, [req.user.id, email]);
    let totalAssigned = 0, pending = 0, overdue = 0, paid = 0;
    const today = new Date().toISOString().slice(0, 10);
    (fees || []).forEach((f) => {
      const amt = Number(f.amount || 0) - Number(f.discount || 0) + Number(f.late_fee || 0);
      totalAssigned += amt;
      const rem = amt - Number(f.paid_amount || 0);
      if (rem > 0) { pending += rem; if (f.due_date && f.due_date < today) overdue += rem; }
      if (f.status === "Paid") paid += amt;
    });
    let verifiedCollection = 0;
    (payments || []).forEach((p) => { if (p.status === "Verified") verifiedCollection += Number(p.amount || 0); });
    res.json({ success: true, data: { totalAssigned, verifiedCollection, pending, overdue, paid, pendingSubmissions: (payments || []).filter((p) => p.status === "Pending Verification").length, rejectedPayments: (payments || []).filter((p) => p.status === "Rejected").length } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load fee overview" }); }
});

// STUDENT FEE RECORDS — assigned fees for this student
router.get("/my/fees", authMiddleware, async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();
    const [rows] = await db.query(`SELECT * FROM student_fees WHERE LOWER(student_email) = ? OR user_id = ? ORDER BY created_at DESC LIMIT 500`, [email, req.user.id]);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load student fees" }); }
});

// ADMIN FEES
router.get("/admin/fees", adminOnly, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    let sql = `SELECT * FROM student_fees`;
    const params = [];
    if (search) { sql += ` WHERE student_name LIKE ? OR student_email LIKE ? OR room_number LIKE ?`; const like = `%${search}%`; params.push(like, like, like); }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load fees" }); }
});

router.post("/admin/assign", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    const students = Array.isArray(b.students) ? b.students : (b.student ? [b.student] : []);
    if (!students.length) return res.status(400).json({ success: false, message: "No students" });
    const amount = Number(b.amount) || 0;
    const ids = [];
    for (const s of students) {
      const [r] = await db.query(`INSERT INTO student_fees (user_id, student_name, student_email, room_number, category_id, category_name, amount, due_date, billing_period, status, discount, late_fee) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [s.userId || null, s.name || "Unknown", s.email || null, s.room || null, b.categoryId || null, b.categoryName || null, amount, b.dueDate || null, b.billingPeriod || null, "Pending", Number(b.discount) || 0, Number(b.lateFee) || 0]);
      ids.push(r.insertId);
    }
    audit(req.user, "ASSIGN_FEES", "student_fee", null, { count: ids.length });
    res.status(201).json({ success: true, data: { ids } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to assign fees" }); }
});

router.get("/admin/payments", adminOnly, async (req, res) => {
  try {
    const status = req.query.status;
    let sql = `SELECT p.*, r.receipt_number FROM fee_payments p LEFT JOIN fee_receipts r ON r.payment_id=p.id`;
    const params = [];
    if (status) { sql += ` WHERE p.status=?`; params.push(status); }
    sql += ` ORDER BY p.created_at DESC LIMIT 500`;
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed to load payments" }); }
});

// ADMIN VERIFY
router.post("/admin/payments/:id/verify", adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query(`SELECT * FROM fee_payments WHERE id=?`, [id]);
    if (!rows || !rows.length) return res.status(404).json({ success: false, message: "Payment not found" });
    const p = rows[0];
    if (p.status === "Verified") {
      const [rr] = await db.query(`SELECT * FROM fee_receipts WHERE payment_id=?`, [id]);
      return res.json({ success: true, message: "Already verified", data: { receiptNumber: rr && rr.length ? rr[0].receipt_number : null } });
    }
    await db.query(`UPDATE fee_payments SET status='Verified', verified_by=?, verified_at=CURRENT_TIMESTAMP WHERE id=?`, [req.user.id, id]);
    if (p.student_fee_id) {
      await db.query(`UPDATE student_fees SET paid_amount = paid_amount + ? WHERE id=?`, [p.amount, p.student_fee_id]);
      const [sf] = await db.query(`SELECT * FROM student_fees WHERE id=?`, [p.student_fee_id]);
      if (sf && sf.length) {
        const f = sf[0];
        const total = Number(f.amount || 0) - Number(f.discount || 0) + Number(f.late_fee || 0);
        const paid = Number(f.paid_amount || 0);
        const newStatus = paid >= total ? "Paid" : "Partial";
        await db.query(`UPDATE student_fees SET status=? WHERE id=?`, [newStatus, p.student_fee_id]);
      }
    }
    const [existing] = await db.query(`SELECT * FROM fee_receipts WHERE payment_id=?`, [id]);
    let receiptNumber = existing && existing.length ? existing[0].receipt_number : null;
    if (!receiptNumber) { receiptNumber = `RCPT-${Date.now()}-${id}`; await db.query(`INSERT INTO fee_receipts (receipt_number, payment_id) VALUES (?,?)`, [receiptNumber, id]); }
    audit(req.user, "VERIFY_PAYMENT", "fee_payment", id, { receiptNumber });
    // notify student
    db.query(`SELECT user_id, student_email FROM fee_payments WHERE id=?`, [id]).then(([r]) => {
      const p = r && r[0];
      if (p && p.user_id) {
        db.query(`INSERT INTO notifications (user_id, type, title, message, related_type, related_id) VALUES (?,?,?,?,?,?)`, [p.user_id, "fee", "Payment Verified", "Your payment has been verified. Receipt: " + receiptNumber, "fee_payment", id]).catch(()=>{});
      }
    }).catch(()=>{});
    res.json({ success: true, message: "Verified", data: { receiptNumber } });
  } catch (e) { res.status(500).json({ success: false, message: "Verification failed" }); }
});

router.post("/admin/payments/:id/reject", adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    const reason = (req.body && req.body.reason) || "Rejected";
    await db.query(`UPDATE fee_payments SET status='Rejected', rejection_reason=? WHERE id=?`, [reason, id]);
    audit(req.user, "REJECT_PAYMENT", "fee_payment", id, { reason });
    db.query(`SELECT user_id FROM fee_payments WHERE id=?`, [id]).then(([r]) => { if (r && r[0] && r[0].user_id) db.query(`INSERT INTO notifications (user_id, type, title, message, related_type, related_id) VALUES (?,?,?,?,?,?)`, [r[0].user_id, "fee", "Payment Rejected", reason, "fee_payment", id]).catch(()=>{}); }).catch(()=>{});
    res.json({ success: true, message: "Rejected" });
  } catch (e) { res.status(500).json({ success: false, message: "Reject failed" }); }
});

router.post("/admin/payments/:id/request-info", adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    const msg = (req.body && req.body.message) || "Additional information required";
    await db.query(`UPDATE fee_payments SET status='Additional Information Required', rejection_reason=? WHERE id=?`, [msg, id]);
    db.query(`SELECT user_id FROM fee_payments WHERE id=?`, [id]).then(([r]) => { if (r && r[0] && r[0].user_id) db.query(`INSERT INTO notifications (user_id, type, title, message, related_type, related_id) VALUES (?,?,?,?,?,?)`, [r[0].user_id, "fee", "Additional Information Requested", msg, "fee_payment", id]).catch(()=>{}); }).catch(()=>{});
    res.json({ success: true, message: "Requested" });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.get("/admin/overview", adminOnly, async (req, res) => {
  try {
    const [fees] = await db.query(`SELECT * FROM student_fees`);
    const [payments] = await db.query(`SELECT * FROM fee_payments`);
    let totalAssigned = 0, pending = 0, overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    (fees || []).forEach((f) => {
      const amt = Number(f.amount || 0) - Number(f.discount || 0) + Number(f.late_fee || 0);
      totalAssigned += amt;
      const rem = amt - Number(f.paid_amount || 0);
      if (rem > 0) { pending += rem; if (f.due_date && f.due_date < today) overdue += rem; }
    });
    let verifiedCollection = 0;
    (payments || []).forEach((p) => { if (p.status === "Verified") verifiedCollection += Number(p.amount || 0); });
    const pendingSubs = (payments || []).filter((p) => p.status === "Pending Verification").length;
    const rejected = (payments || []).filter((p) => p.status === "Rejected").length;
    res.json({ success: true, data: { totalAssigned, verifiedCollection, pending, overdue, pendingSubmissions: pendingSubs, rejectedPayments: rejected } });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

router.get("/admin/students/search", adminOnly, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    let sql = `SELECT id, name, email, room_number FROM students`;
    const params = [];
    if (q) { sql += ` WHERE name LIKE ? OR email LIKE ? OR student_code LIKE ? OR room_number LIKE ?`; const like = `%${q}%`; params.push(like, like, like, like); }
    sql += ` ORDER BY name LIMIT 50`;
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (e) { res.status(500).json({ success: false, message: "Failed" }); }
});

// PROOF UPLOAD (base64 data URL) - student only, own pending payment
router.post("/my/payments/:id/proof", authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query(`SELECT * FROM fee_payments WHERE id=?`, [id]);
    if (!rows || !rows.length) return res.status(404).json({ success: false, message: "Payment not found" });
    const p = rows[0];
    const email = (req.user.email || "").toLowerCase();
    if (p.user_id && p.user_id !== req.user.id && (p.student_email || "").toLowerCase() !== email) return res.status(403).json({ success: false, message: "Not your payment" });
    if (!["Pending Verification", "Additional Information Required"].includes(p.status)) return res.status(400).json({ success: false, message: "Proof upload not allowed for this status" });
    const data = req.body && req.body.proofData;
    if (!data || typeof data !== "string") return res.status(400).json({ success: false, message: "proofData required" });
    const m = data.match(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/);
    if (!m) return res.status(400).json({ success: false, message: "Invalid file type" });
    const base64 = data.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ success: false, message: "File too large (max 5MB)" });
    // basic signature check
    await db.query(`UPDATE fee_payments SET proof_path=? WHERE id=?`, [data, id]);
    res.json({ success: true, message: "Proof uploaded" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

module.exports = router;
