import { useEffect, useState } from "react";
import { Dumbbell, Search, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import { compressImage } from "../lib/images";

type GymPhoto = {
  id: number; title: string; photo: string | null; description: string | null;
  equipmentType: string | null; status: string; createdAt: string;
};

function GymPhotos() {
  const { notify } = useToast();
  const [rows, setRows] = useState<GymPhoto[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", photo: "", description: "", equipmentType: "", status: "Active" as string });
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<GymPhoto[]>("/gym/photos");
      setRows(data || []);
    } catch (e) {
      setRows([]);
      setErr(e instanceof Error ? e.message : "Gym photo gallery is being set up by the admin.");
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
    if (!form.title.trim()) { notify("Title is required", "error"); return; }
    if (!form.photo) { notify("Photo is required", "error"); return; }
    setSaving(true);
    try {
      await api("/gym/photos", { method: "POST", body: form });
      notify("Gym photo added");
      setShowModal(false);
      setForm({ title: "", photo: "", description: "", equipmentType: "", status: "Active" });
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
    ? rows.filter((p) => [p.title, p.description || "", p.equipmentType || ""].join(" ").toLowerCase().includes(combined))
    : rows;

  return (
    <section className="content">
      <div className="page-heading gym-heading">
        <div>
          <Dumbbell size={24} className="page-heading-icon" />
          <div>
            <h2>Gym Room Photos</h2>
            <p>Photos of gym equipment and facilities.</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search gym photos..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {err ? (
        <div className="error-state">{err}</div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "50%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Dumbbell size={32} /><strong>No gym photos yet</strong></div>
      ) : (
        <div className="gymphoto-grid">
          {filtered.map((p) => (
            <div key={p.id} className="gymphoto-card">
              <div className="gymphoto-image">
                {p.photo && <img src={p.photo} alt={p.title} />}
              </div>
              <div className="gymphoto-body">
                <h3>{p.title}</h3>
                {p.equipmentType && <p><strong>Equipment:</strong> {p.equipmentType}</p>}
                {p.description && <p className="muted">{p.description}</p>}
                <span className={`service-status ${p.status === "Active" ? "status-active" : "status-inactive"}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="primary-btn" onClick={() => { setShowModal(true); setForm({ title: "", photo: "", description: "", equipmentType: "", status: "Active" }); setPreview(""); }} style={{ marginTop: 16 }}>
        <Plus size={17} /> Add Gym Photo
      </button>

      {showModal && (
        <Modal title="Add Gym Photo" subtitle="Upload a photo of gym equipment" onClose={() => { setShowModal(false); setPreview(""); }}>
          <div className="hub-form">
            <div className="hub-field"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Treadmill" /></div>
            <div className="hub-field"><label>Photo *</label><input type="file" accept="image/*" onChange={handlePhoto} /><br />
              {preview && (<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}><img src={preview} alt="preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /><button type="button" className="btn-ghost" onClick={() => { setForm({ ...form, photo: "" }); setPreview(""); }} style={{ padding: 4, fontSize: 12 }}>Remove</button></div>)}</div>
            <div className="hub-field"><label>Equipment type</label><input value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })} placeholder="e.g. Cardio, Weights" /></div>
            <div className="hub-field"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the equipment..." /></div>
            <div className="hub-field"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Maintenance</option></select></div>
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Photo"}</button>
            </div>
          </div>
        </Modal>
      )}

    </section>
  );
}

export default GymPhotos;