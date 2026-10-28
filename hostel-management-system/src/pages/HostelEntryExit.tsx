import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

type Log = {
  id: number; studentId: number | null; studentName: string; roomNumber: string | null;
  eventType: string; eventTime: string; recordedBy: string | null; recordedByRole: string | null;
  leaveId: number | null; remarks: string | null; createdAt: string;
};

export default function HostelEntryExit({ role }: { role?: "Admin" | "Student" | "Faculty" | null }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ studentName: "", roomNumber: "", eventType: "Entry", remarks: "" });
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "Admin";
  const isStaff = ["Staff", "Warden", "Housekeeping", "Maintenance", "Admin Support"].includes(role || "");
  const canRecord = isAdmin || isStaff;

  const load = async () => {
    setLoading(true); setErr("");
    try { setRows(await api<Log[]>("/hostel-gate-logs")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentName.trim()) { notify("Student name required", "error"); return; }
    setSaving(true);
    try {
      await api("/hostel-gate-logs", { method: "POST", body: { studentName: form.studentName.trim(), roomNumber: form.roomNumber.trim() || null, eventType: form.eventType, remarks: form.remarks.trim() || null } });
      notify("Gate event recorded");
      setForm({ studentName: "", roomNumber: "", eventType: "Entry", remarks: "" });
      await load();
    } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Remove this log entry?")) return;
    try { await api(`/hostel-gate-logs/${id}`, { method: "DELETE" }); notify("Removed"); await load(); }
    catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };

  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>Hostel Entry / Exit</h2><p>Verified gate movement logs</p></div></div>
      {canRecord && (
        <form className="hub-form" onSubmit={submit} style={{ marginBottom: 16 }}>
          <div className="hub-form-grid">
            <div className="hub-field"><label>Student Name *</label><input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} required /></div>
            <div className="hub-field"><label>Room Number</label><input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} /></div>
            <div className="hub-field"><label>Event Type</label><select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}><option>Entry</option><option>Exit</option></select></div>
            <div className="hub-field" style={{ gridColumn: "1 / -1" }}><label>Remarks</label><input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="hub-form-actions"><button type="submit" className="primary-btn" disabled={saving}>{saving ? "Saving..." : "Record Event"}</button></div>
        </form>
      )}
      {err && <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>}
      {loading ? <div className="skeleton-card" /> : (
        <div className="hub-card">
          <table className="data-table">
            <thead><tr><th>Student</th><th>Room</th><th>Event</th><th>Time</th><th>Recorded By</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.studentName}</td><td>{r.roomNumber || "—"}</td><td>{r.eventType}</td><td>{r.eventTime}</td><td>{r.recordedBy || "—"}</td>
                  {isAdmin && <td><button type="button" className="action-btn" onClick={() => remove(r.id)}>Delete</button></td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={isAdmin ? 6 : 5}>No gate logs.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}