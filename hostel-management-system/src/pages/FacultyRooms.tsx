import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Assignment = { id: number; faculty_name: string; faculty_email: string | null; room_number: string | null; wing: string | null; assigned_at: string };

export default function FacultyRooms() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ facultyName: "", facultyEmail: "", roomNumber: "", wing: "Boys" });

  const load = async () => {
    try { const d = await api<Assignment[]>("/faculty-rooms"); setItems(d || []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api("/faculty-rooms", { method: "POST", body: form }); setForm({ facultyName: "", facultyEmail: "", roomNumber: "", wing: "Boys" }); load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove assignment?")) return;
    try { await api(`/faculty-rooms/${id}`, { method: "DELETE" }); load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  return (
    <section className="content premium-page">
      <div className="content-header"><h2>Faculty–Room Assignment</h2><p>Assign faculty members to hostel rooms.</p></div>
      <form onSubmit={submit} className="form-card" style={{ marginBottom: 16, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <input placeholder="Faculty name" value={form.facultyName} onChange={(e) => setForm({ ...form, facultyName: e.target.value })} required />
        <input placeholder="Faculty email" value={form.facultyEmail} onChange={(e) => setForm({ ...form, facultyEmail: e.target.value })} />
        <input placeholder="Room number" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
        <select value={form.wing} onChange={(e) => setForm({ ...form, wing: e.target.value })}>
          <option>Boys</option><option>Girls</option>
        </select>
        <button type="submit" className="btn btn-primary">Assign</button>
      </form>
      {loading ? <p>Loading…</p> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Faculty</th><th>Email</th><th>Room</th><th>Wing</th><th>Assigned</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6}>No assignments yet.</td></tr> :
                items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.faculty_name}</td><td>{a.faculty_email || "—"}</td><td>{a.room_number || "—"}</td><td>{a.wing || "—"}</td><td>{a.assigned_at}</td>
                    <td><button className="btn btn-sm" onClick={() => remove(a.id)}>Remove</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
