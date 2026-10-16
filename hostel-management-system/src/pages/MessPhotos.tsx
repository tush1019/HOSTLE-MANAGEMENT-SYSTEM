import { useEffect, useState } from "react";
import { Utensils, Search, Plus, Image as ImageIcon, Star } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

type MessPhoto = {
  id: number; title: string; photo: string | null; foodQuality: number | null; comment: string | null; createdAt: string;
};

const EMPTY = { title: "", photo: "", foodQuality: 5 as number, comment: "" };

function starClass(filled: boolean) {
  return filled ? "star star-filled" : "star star-empty";
}

function MessPhotos({ role }: { role: "Admin" | "Student" | null }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<MessPhoto[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<MessPhoto[]>("/mess/photos");
      setRows(data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load mess photos");
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
      setPreview(dataUrl);
    } catch { notify("Failed to read image", "error"); }
  };

  const save = async () => {
    if (!form.title.trim()) { notify("Title is required", "error"); return; }
    if (!form.photo) { notify("Photo is required", "error"); return; }
    setSaving(true);
    try {
      await api("/mess/photos", { method: "POST", body: { ...form, foodQuality: form.foodQuality } });
      notify("Mess photo uploaded");
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

  const avgQuality = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + (r.foodQuality || 0), 0) / rows.length) * 10) / 10 : 0;

  const combined = q.toLowerCase().trim();
  const filtered = combined
    ? rows.filter((p) => [p.title, p.comment || ""].join(" ").toLowerCase().includes(combined))
    : rows;

  return (
    <section className="content">
      <div className="page-heading messphoto-heading">
        <div>
          <Utensils size={24} className="page-heading-icon" />
          <div>
            <h2>Mess Photos & Food Quality</h2>
            <p>Share photos of mess food and rate its quality (1–5 stars).</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search photos..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="messphoto-summary-grid">
        <div className="messphoto-summary-card"><div className="summary-icon"><Utensils size={20} /></div><div><span>Photos shared</span><h3>{rows.length}</h3><p>By students</p></div></div>
        <div className="messphoto-summary-card"><div className="summary-icon"><Star size={20} /></div><div><span>Avg food quality</span><h3>{avgQuality ? avgQuality : "—"}/5</h3><p>{rows.length} ratings</p></div></div>
      </div>

      {err ? (
        <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "50%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><ImageIcon size={32} /><strong>No mess photos yet</strong></div>
      ) : (
        <div className="messphoto-grid">
          {filtered.map((p) => (
            <div key={p.id} className="messphoto-card">
              <div className="messphoto-image">
                {p.photo && <img src={p.photo} alt={p.title} onClick={() => { setPreview(p.photo); setShowModal(true); }} style={{ cursor: "pointer" }} />}
              </div>
              <div className="messphoto-body">
                <h3>{p.title}</h3>
                <div className="food-rating">
                  <span>Food quality:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={starClass(n <= (p.foodQuality || 0))} onClick={() => { setPreview(p.photo); setShowModal(true); }}>{n <= (p.foodQuality || 0) ? "★" : "☆"}</span>
                  ))}
                </div>
                {p.comment && <p className="muted">{p.comment}</p>}
                <small>{p.createdAt}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {role === "Student" && (
        <button type="button" className="primary-btn" onClick={() => { setShowModal(true); setForm(EMPTY); setPreview(""); }} style={{ marginTop: 16 }}>
          <Plus size={17} /> Upload Mess Photo
        </button>
      )}

      {showModal && (
        <Modal title="Upload Mess Photo" subtitle="Share a photo of today's meal and rate it" onClose={() => { setShowModal(false); setPreview(""); }}>
          <div className="hub-form">
            <div className="hub-field"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Today's thali" /></div>
            <div className="hub-field"><label>Photo *</label><input type="file" accept="image/*" onChange={handlePhoto} /><br />
              {preview && (<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}><img src={preview} alt="preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /><button type="button" className="btn-ghost" onClick={() => { setForm({ ...form, photo: "" }); setPreview(""); }} style={{ padding: 4, fontSize: 12 }}>Remove</button></div>)}</div>
            <div className="hub-field"><label>Food quality *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={starClass(n <= form.foodQuality)} onClick={() => setForm({ ...form, foodQuality: n })}>{n <= form.foodQuality ? "★" : "☆"}</span>
                ))}
                <span className="muted">({form.foodQuality}/5)</span>
              </div>
            </div>
            <div className="hub-field"><label>Comment</label><textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="How was the taste, portion, hygiene..." /></div>
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Uploading..." : "Upload Photo"}</button>
            </div>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title="Mess Photo" subtitle={preview ? "Shared meal photo" : ""} onClose={() => setPreview("")}>
          <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><img src={preview} alt="mess photo" style={{ maxWidth: "100%", maxHeight: 600, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }} /></div>
        </Modal>
      )}

    </section>
  );
}

export default MessPhotos;
