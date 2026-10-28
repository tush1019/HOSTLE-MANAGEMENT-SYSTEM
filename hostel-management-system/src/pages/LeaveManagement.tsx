import { useEffect, useState } from "react";
import { MapPin, Search, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

type Leave = {
  id: number; leaveCode: string | null; studentName: string; roomNumber: string | null;
  reason: string; startDate: string; endDate: string;
  status: "Pending" | "Approved" | "Rejected"; adminRemarks: string | null; createdAt: string;
};

const EMPTY = { studentName: "", roomNumber: "", reason: "", startDate: "", endDate: "" };

function statusClass(s: string) {
  if (s === "Approved") return "complaint-status complaint-resolved";
  if (s === "Rejected") return "complaint-status complaint-pending";
  return "complaint-status complaint-progress";
}

function LeaveManagement({ role }: { role: "Admin" | "Student" | null }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<Leave[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [adminRemarks, setAdminRemarks] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<Leave[]>("/leave");
      setRows(data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.studentName.trim()) { notify("Your name is required", "error"); return; }
    if (!form.reason.trim()) { notify("Reason is required", "error"); return; }
    if (!form.startDate || !form.endDate) { notify("Start and end dates are required", "error"); return; }
    setSaving(true);
    try {
      await api("/leave", { method: "POST", body: form });
      notify("Leave application submitted");
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, next: "Approved" | "Rejected", remarks: string) => {
    try {
      await api(`/leave/${id}/status`, { method: "PATCH", body: { status: next, adminRemarks: remarks } });
      notify(`Leave ${next.toLowerCase()}`);
      setDecidingId(null);
      setAdminRemarks("");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  const combined = q.toLowerCase().trim();
  const filtered = combined
    ? rows.filter((l) => [l.studentName, l.reason, l.leaveCode || "", l.roomNumber || ""].join(" ").toLowerCase().includes(combined))
    : rows;

  const isStudent = role === "Student";

  return (
    <section className="content premium-page">
      <div className="page-heading leave-heading">
        <div>
          <MapPin size={24} className="page-heading-icon" />
          <div>
            <h2>Leave Management</h2>
            <p>{isStudent ? "Apply for leave and track your application status." : "Review and approve or reject student leave applications."}</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search leave requests..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="leave-summary-grid">
        <div className="leave-summary-card"><div className="summary-icon"><MapPin size={20} /></div><div><span>Total</span><h3>{rows.length}</h3><p>Applications</p></div></div>
        <div className="leave-summary-card"><div className="summary-icon"><Clock size={20} /></div><div><span>Pending</span><h3>{rows.filter((l) => l.status === "Pending").length}</h3><p>Awaiting decision</p></div></div>
        <div className="leave-summary-card"><div className="summary-icon"><CheckCircle2 size={20} /></div><div><span>Approved</span><h3>{rows.filter((l) => l.status === "Approved").length}</h3><p>Approved</p></div></div>
        <div className="leave-summary-card"><div className="summary-icon"><XCircle size={20} /></div><div><span>Rejected</span><h3>{rows.filter((l) => l.status === "Rejected").length}</h3><p>Rejected</p></div></div>
      </div>

      {err ? (
        <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "50%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><MapPin size={32} /><strong>No leave requests</strong></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Leave Code</th><th>Student</th><th>Room</th><th>Reason</th><th>Dates</th><th>Status</th>{role === "Admin" && <th style={{ textAlign: "right" }}>Action</th>}</tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td><div className="maint-code"><strong>{l.leaveCode || `#${l.id}`}</strong><br /><small>{l.createdAt}</small></div></td>
                  <td><strong>{l.studentName}</strong></td>
                  <td>{l.roomNumber || "—"}</td>
                  <td>{l.reason}</td>
                  <td>{l.startDate} → {l.endDate}</td>
                  <td><button type="button" className={statusClass(l.status)} disabled={role !== "Admin"} style={role === "Admin" ? { cursor: "pointer" } : undefined}>{l.status}</button></td>
                  {role === "Admin" && (
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="action-btn" onClick={() => { setForm({ studentName: l.studentName, roomNumber: l.roomNumber || "", reason: l.reason, startDate: l.startDate, endDate: l.endDate }); setDecidingId(l.id); setAdminRemarks(""); setShowModal(true); }} aria-label="Decide">
                        {l.status === "Pending" ? "Decide" : "View"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isStudent && (
        <button type="button" className="primary-btn" onClick={() => { setShowModal(true); setForm(EMPTY); setDecidingId(null); setAdminRemarks(""); }} style={{ marginTop: 16 }}>
          <Plus size={17} /> Apply for Leave
        </button>
      )}

      {showModal && (
        <Modal title={isStudent ? "Apply for Leave" : "Decide Leave Application"} subtitle={isStudent ? "Submit your hostel leave application" : decidingId === null ? "Select a request to approve or reject" : "Approve or reject the selected request"} onClose={() => { setShowModal(false); setDecidingId(null); setAdminRemarks(""); }}>
          <div className="hub-form">
            <div className="hub-field"><label>Student name *</label><input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Your full name" /></div>
            <div className="hub-field"><label>Room number</label><input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. 101" /></div>
            <div className="hub-field"><label>Reason *</label><textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why do you need leave..." /></div>
            <div className="hub-form-grid">
              <div className="hub-field"><label>Start date *</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="hub-field"><label>End date *</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            {role === "Admin" && decidingId !== null && (
              <>
                <div className="hub-field"><label>Admin remarks</label><textarea rows={2} value={adminRemarks} onChange={(e) => setAdminRemarks(e.target.value)} placeholder="Remarks for the student" /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="primary-btn" onClick={() => updateStatus(decidingId!, "Approved", adminRemarks)} disabled={saving}>{saving ? "Saving..." : "Approve"}</button>
                  <button type="button" className="btn-ghost" onClick={() => updateStatus(decidingId!, "Rejected", adminRemarks)} disabled={saving}>{saving ? "Saving..." : "Reject"}</button>
                </div>
              </>
            )}
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setDecidingId(null); setAdminRemarks(""); }}>Cancel</button>
              {isStudent ? (
                <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Submitting..." : "Apply for Leave"}</button>
              ) : decidingId === null ? (
                <span className="muted">Select a pending request from the table to approve or reject.</span>
              ) : null}
            </div>
          </div>
        </Modal>
      )}

    </section>
  );
}

export default LeaveManagement;
