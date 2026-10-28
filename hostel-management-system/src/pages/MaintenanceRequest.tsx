import { useEffect, useState } from "react";
import { Wrench, Search, Plus, Image as ImageIcon } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

type Maint = {
  id: number; requestCode: string | null; studentName: string; roomNumber: string | null;
  title: string; description: string | null; photo: string | null;
  priority: "Low" | "Medium" | "High"; status: "Pending" | "In Progress" | "Resolved";
  createdAt: string;
};

const EMPTY = { studentName: "", roomNumber: "", title: "", description: "", priority: "Medium" as "Low" | "Medium" | "High", photo: "" as string };

function statusClass(s: string) {
  if (s === "Resolved") return "complaint-status complaint-resolved";
  if (s === "In Progress") return "complaint-status complaint-progress";
  return "complaint-status complaint-pending";
}

function prioClass(p: string) {
  if (p === "High") return "priority priority-high";
  if (p === "Low") return "priority priority-low";
  return "priority priority-medium";
}

function MaintenanceRequest({ role }: { role: "Admin" | "Student" | null }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<Maint[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [preview, setPreview] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<Maint[]>("/maintenance");
      setRows(data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load maintenance requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Please select an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { notify("Image must be under 5 MB", "error"); return; }
    try {
    const dataUrl = await readFileAsDataURL(file);
    setForm({ ...form, photo: dataUrl });
    setPhotoPreview(dataUrl);
    notify("Photo attached", "error");
    } catch { notify("Failed to read image", "error"); }
  };

  const save = async () => {
    if (!form.studentName.trim()) { notify("Your name is required", "error"); return; }
    if (!form.title.trim()) { notify("Issue title is required", "error"); return; }
    setSaving(true);
    try {
      await api("/maintenance", { method: "POST", body: form });
      notify("Maintenance request submitted");
      setShowModal(false);
      setForm(EMPTY);
      setPreview("");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const cycleStatus = async (m: Maint) => {
    const order: Maint["status"][] = ["Pending", "In Progress", "Resolved"];
    const next = order[(order.indexOf(m.status) + 1) % order.length];
    try {
      await api(`/maintenance/${m.id}/status`, { method: "PATCH", body: { status: next } });
      notify(`Marked as ${next}`);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  const combined = q.toLowerCase().trim();
  const filtered = combined
    ? rows.filter((m) => [m.studentName, m.title, m.description || "", m.roomNumber || ""].join(" ").toLowerCase().includes(combined))
    : rows;

  return (
    <section className="content premium-page">
      <div className="page-heading maint-heading">
        <div>
          <Wrench size={24} className="page-heading-icon" />
          <div>
            <h2>Maintenance Request</h2>
            <p>Report broken lights, taps, fans, AC, furniture — attach a photo if something is damaged.</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search requests..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="maint-summary-grid">
        <div className="maint-summary-card"><div className="summary-icon"><Wrench size={20} /></div><div><span>Total</span><h3>{rows.length}</h3><p>Requests</p></div></div>
        <div className="maint-summary-card"><div className="summary-icon"><Wrench size={20} /></div><div><span>Pending</span><h3>{rows.filter((m) => m.status === "Pending").length}</h3><p>Awaiting action</p></div></div>
        <div className="maint-summary-card"><div className="summary-icon"><Wrench size={20} /></div><div><span>Resolved</span><h3>{rows.filter((m) => m.status === "Resolved").length}</h3><p>Fixed & closed</p></div></div>
      </div>

      {err ? (
        <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "50%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Wrench size={32} /><strong>No maintenance requests</strong></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Request</th><th>Student</th><th>Room</th><th>Issue</th><th>Photo</th><th>Priority</th><th>Status</th>{role === "Admin" && <th style={{ textAlign: "right" }}>Actions</th>}</tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td><div className="maint-code"><strong>{m.requestCode || `#${m.id}`}</strong><br /><small>{m.createdAt}</small></div></td>
                  <td><strong>{m.studentName}</strong></td>
                  <td>{m.roomNumber || "—"}</td>
                  <td>{m.title}</td>
                  <td>
                    {m.photo ? (
                      <button type="button" className="photo-btn" onClick={() => setPreview(m.photo || "")} aria-label="View photo">
                        <ImageIcon size={14} /> View
                      </button>
                    ) : (<span className="muted">—</span>)}
                  </td>
                  <td><span className={prioClass(m.priority)}>{m.priority}</span></td>
                  <td>
                    <button type="button" className={statusClass(m.status)} onClick={() => role === "Admin" && cycleStatus(m)} style={role === "Admin" ? { cursor: "pointer" } : undefined}>{m.status}</button>
                  </td>
                  {role === "Admin" && (<td style={{ textAlign: "right" }}><button type="button" className="action-btn" onClick={() => setPreview(m.photo || "")} aria-label="View photo"><ImageIcon size={16} /></button></td>)}
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="primary-btn" onClick={() => { setShowModal(true); setForm(EMPTY); setPreview(""); }} style={{ marginTop: 16 }}>
        <Plus size={17} /> {role === "Student" ? "Report a Maintenance Issue" : "Add Maintenance Request"}
      </button>

      {showModal && (
        <Modal title="New Maintenance Request" subtitle="Describe the issue and attach a photo" onClose={() => { setShowModal(false); setPhotoPreview(""); }}>
          <div className="hub-form">
            <div className="hub-field"><label>Your name *</label><input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Your full name" /></div>
            <div className="hub-field"><label>Room number</label><input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. 101" /></div>
            <div className="hub-field"><label>Issue title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Tap leaking in washroom" /></div>
            <div className="hub-field"><label>Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is broken or not working..." /></div>
            <div className="hub-form-grid">
              <div className="hub-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as "Low" | "Medium" | "High" })}><option>Low</option><option>Medium</option><option>High</option></select></div>
            </div>
            <div className="hub-field"><label>Attach photo (broken item)</label><input type="file" accept="image/*" onChange={handlePhoto} /><br />
              {photoPreview && (<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}><img src={photoPreview} alt="preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /><button type="button" className="btn-ghost" onClick={() => { setForm({ ...form, photo: "" }); setPhotoPreview(""); }} style={{ padding: 4, fontSize: 12 }}>Remove</button></div>)}</div>
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</button>
            </div>
          </div>
        </Modal>
      )}

      {photoPreview && (
        <Modal title="Attached Photo" subtitle="Photo of the issue" onClose={() => setPhotoPreview("")}>
          <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><img src={photoPreview} alt="issue photo" style={{ maxWidth: "100%", maxHeight: 600, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }} /></div>
        </Modal>
      )}

      {preview && (
        <Modal title="Issue Photo" subtitle="Photo of the reported issue" onClose={() => setPreview("")}>
          <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><img src={preview} alt="issue photo" style={{ maxWidth: "100%", maxHeight: 600, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }} /></div>
        </Modal>
      )}

    </section>
  );
}

export default MaintenanceRequest;

