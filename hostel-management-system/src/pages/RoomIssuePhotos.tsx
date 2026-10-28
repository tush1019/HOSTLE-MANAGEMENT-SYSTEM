import { useEffect, useState } from "react";
import { Image as ImageIcon, Search, Plus, Wrench } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import { compressImage } from "../lib/images";

type RoomIssue = {
  id: number; roomNumber: string | null; title: string; photo: string | null;
  description: string | null; status: string; createdAt: string;
};

function RoomIssuePhotos() {
  const { notify } = useToast();
  const [rows, setRows] = useState<RoomIssue[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ roomNumber: "", title: "", photo: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<RoomIssue[]>("/room-issues");
      setRows(data || []);
    } catch {
      setRows([]);
      setErr("Room issue photo endpoint is being set up by the admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setForm({ ...form, photo: dataUrl });
      setPreview(dataUrl);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to read image", "error");
    }
  };

  const save = async () => {
    if (!form.roomNumber.trim()) { notify("Room number is required", "error"); return; }
    if (!form.title.trim()) { notify("Issue title is required", "error"); return; }
    if (!form.photo) { notify("Photo is required", "error"); return; }
    setSaving(true);
    try {
      await api("/room-issues", { method: "POST", body: form });
      notify("Room issue reported");
      setShowModal(false);
      setForm({ roomNumber: "", title: "", photo: "", description: "" });
      setPreview("");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const combined = q.toLowerCase().trim();
  const filtered = combined
    ? rows.filter((p) => [p.roomNumber || "", p.title, p.description || ""].join(" ").toLowerCase().includes(combined))
    : rows;

  return (
    <section className="content premium-page">
      <div className="page-heading roomissue-heading">
        <div>
          <Wrench size={24} className="page-heading-icon" />
          <div>
            <h2>Room Issue Photos</h2>
            <p>Click a photo of anything broken in your room (fan, tap, light, furniture) and report it.</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search room issues..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {err ? (
        <div className="error-state">{err}</div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "50%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><ImageIcon size={32} /><strong>No room issue photos</strong></div>
      ) : (
        <div className="roomissue-grid">
          {filtered.map((p) => (
            <div key={p.id} className="roomissue-card">
              <div className="roomissue-image">
                {p.photo && <img src={p.photo} alt={p.title} />}
              </div>
              <div className="roomissue-body">
                <h3>{p.title}</h3>
                {p.roomNumber && <p><strong>Room:</strong> {p.roomNumber}</p>}
                {p.description && <p className="muted">{p.description}</p>}
                <span className={`service-status ${p.status === "Resolved" ? "status-active" : "status-inactive"}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="primary-btn" onClick={() => { setShowModal(true); setForm({ roomNumber: "", title: "", photo: "", description: "" }); setPreview(""); }} style={{ marginTop: 16 }}>
        <Plus size={17} /> Report Room Issue with Photo
      </button>

      {showModal && (
        <Modal title="Room Issue Photo" subtitle="Attach a photo of the broken item" onClose={() => { setShowModal(false); setPreview(""); }}>
          <div className="hub-form">
            <div className="hub-field"><label>Room number *</label><input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. 101" /></div>
            <div className="hub-field"><label>Issue title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Ceiling fan not working" /></div>
            <div className="hub-field"><label>Photo *</label><input type="file" accept="image/*" onChange={handlePhoto} /><br />
              {preview && (<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}><img src={preview} alt="preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /><button type="button" className="btn-ghost" onClick={() => { setForm({ ...form, photo: "" }); setPreview(""); }} style={{ padding: 4, fontSize: 12 }}>Remove</button></div>)}</div>
            <div className="hub-field"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is broken or damaged..." /></div>
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Saving..." : "Report Issue"}</button>
            </div>
          </div>
        </Modal>
      )}

    </section>
  );
}

export default RoomIssuePhotos;
