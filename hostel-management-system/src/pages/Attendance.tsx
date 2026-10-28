import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

type Student = { id: number; name: string; studentCode?: string | null; room?: string | null };
type Session = { id: number; subject: string; className: string; sessionDate: string; startTime?: string | null; endTime?: string | null; room?: string | null; status: string };

export default function Attendance() {
  const { notify } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: "", className: "", sessionDate: "", startTime: "", endTime: "", room: "" });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  const loadStudents = async () => {
    try { setStudents(await api<Student[]>("/students")); } catch (e) { notify(e instanceof Error ? e.message : "Failed to load students", "error"); }
  };
  const loadSessions = async () => {
    setLoading(true);
    try { setSessions(await api<Session[]>("/attendance/sessions")); } catch (e) { notify(e instanceof Error ? e.message : "Failed to load sessions", "error"); } finally { setLoading(false); }
  };
  useEffect(() => { loadStudents(); loadSessions(); }, []);

  const createSession = async () => {
    if (!form.subject.trim() || !form.className.trim() || !form.sessionDate) { notify("Subject, class, and date are required", "error"); return; }
    setSaving(true);
    try {
      await api("/attendance/sessions", { method: "POST", body: form });
      notify("Session created");
      setForm({ subject: "", className: "", sessionDate: "", startTime: "", endTime: "", room: "" });
      loadSessions();
    } catch (e) { notify(e instanceof Error ? e.message : "Create failed", "error"); } finally { setSaving(false); }
  };

  const openSession = async (s: Session) => {
    setSelected(s);
    setMarks({});
    try {
      const recs = await api<{ studentId: number; status: string }[]>(`/attendance/sessions/${s.id}/records`);
      const m: Record<number, string> = {};
      recs.forEach((r) => { m[r.studentId] = r.status; });
      students.forEach((st) => { if (!m[st.id]) m[st.id] = "Present"; });
      setMarks(m);
    } catch (e) { notify(e instanceof Error ? e.message : "Failed to load records", "error"); }
  };

  const saveMarks = async () => {
    if (!selected) return;
    setSavingMarks(true);
    try {
      const records = students.map((s) => ({ student_id: s.id, status: marks[s.id] || "Present" }));
      await api(`/attendance/sessions/${selected.id}/records`, { method: "PUT", body: { records } });
      notify("Attendance saved");
    } catch (e) { notify(e instanceof Error ? e.message : "Save failed", "error"); } finally { setSavingMarks(false); }
  };

  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>Attendance</h2><p>Create sessions and mark students present, absent, or late.</p></div></div>
      <div className="hub-card" style={{ marginBottom: 16 }}>
        <h3>Create Session</h3>
        <div className="hub-form-grid">
          <div className="hub-field"><label>Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="hub-field"><label>Class</label><input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} /></div>
          <div className="hub-field"><label>Date</label><input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} /></div>
          <div className="hub-field"><label>Start</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div className="hub-field"><label>End</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          <div className="hub-field"><label>Room</label><input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
        </div>
        <button className="primary-btn" onClick={createSession} disabled={saving}>{saving ? "Creating..." : "Create Session"}</button>
      </div>
      <div className="hub-card" style={{ marginBottom: 16 }}>
        <h3>Sessions</h3>
        {loading ? <p>Loading...</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Class</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.subject}</td><td>{s.className}</td><td>{s.sessionDate}</td><td>{s.startTime || "—"} - {s.endTime || "—"}</td><td>{s.status}</td>
                    <td><button className="action-btn" onClick={() => openSession(s)}>Mark</button></td>
                  </tr>
                ))}
                {!sessions.length && <tr><td colSpan={6}>No sessions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="hub-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Mark Attendance: {selected.subject} ({selected.sessionDate})</h3>
            <button className="primary-btn" onClick={saveMarks} disabled={savingMarks}>{savingMarks ? "Saving..." : "Save"}</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Room</th><th>Status</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name} <small>{s.studentCode}</small></td>
                    <td>{s.room || "—"}</td>
                    <td>
                      <select value={marks[s.id] || "Present"} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}>
                        <option>Present</option><option>Absent</option><option>Late</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

