import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AttendanceRow = {
  id: number; sessionId: number; status: string; markedAt: string;
  subject: string; className: string; sessionDate: string;
};

export default function StudentAttendance({ role }: { role?: "Admin" | "Student" | "Faculty" | null }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const data = await api<AttendanceRow[]>("/attendance/mine");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (role !== "Student") {
    return <section className="content premium-page"><div className="error-state">Access restricted to students.</div></section>;
  }

  const total = rows.length;
  const present = rows.filter((r) => r.status === "Present").length;
  const late = rows.filter((r) => r.status === "Late").length;
  const absent = rows.filter((r) => r.status === "Absent").length;
  const excused = rows.filter((r) => r.status === "Excused").length;
  const pct = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;

  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>My Attendance</h2><p>Your class attendance history and percentage</p></div></div>

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <div className="dashboard-card"><h3>Total Sessions</h3><p>{total}</p></div>
        <div className="dashboard-card"><h3>Present</h3><p>{present}</p></div>
        <div className="dashboard-card"><h3>Late</h3><p>{late}</p></div>
        <div className="dashboard-card"><h3>Absent</h3><p>{absent}</p></div>
        <div className="dashboard-card"><h3>Attendance %</h3><p>{pct}%</p></div>
      </div>

      {err && <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>}
      {loading ? <div className="skeleton-card" /> : (
        <div className="hub-card">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Subject</th><th>Class</th><th>Status</th><th>Marked At</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sessionDate}</td><td>{r.subject}</td><td>{r.className}</td>
                  <td><span className={`service-status ${r.status === "Present" ? "status-active" : "status-inactive"}`}>{r.status}</span></td>
                  <td>{r.markedAt}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5}>No attendance records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}