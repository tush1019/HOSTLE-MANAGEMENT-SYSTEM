import { useEffect, useState } from "react";
import { Search, Phone, MapPin, Building, Wifi, Droplets, ShieldAlert, LayoutList, Plus, Pencil, Trash2, X } from "lucide-react";
import { api, getStoredUser } from "../lib/api";

type Service = {
  id: number; category: string; title: string; details: string | null;
  contactName: string | null; contactPhone: string | null; photo: string | null;
  status: string; createdAt: string;
};

const ICON_BY_CATEGORY: Record<string, any> = {
  "Emergency Contact": ShieldAlert,
  "Medical Facilities": Building,
  "WiFi Information": Wifi,
  "Laundry Services": LayoutList,
  "Study Room": LayoutList,
  "Water & Electricity": Droplets,
  Housekeeping: LayoutList,
  "Entry & Exit Rules": ShieldAlert,
};

function ServiceList({ category, role }: { category: string; role?: "Admin" | "Student" | null }) {
  const isAdmin = (role ?? (getStoredUser()?.role as "Admin" | "Student" | null)) === "Admin";
  const [rows, setRows] = useState<Service[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", details: "", contactName: "", contactPhone: "", status: "Active" as "Active" | "Inactive" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api<Service[]>(`/services?category=${encodeURIComponent(category)}`);
      setRows(data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [category]);

  const openAdd = () => { setEditingId(null); setForm({ title: "", details: "", contactName: "", contactPhone: "", status: "Active" }); setShowForm(true); };
  const openEdit = (s: Service) => { setEditingId(s.id); setForm({ title: s.title, details: s.details || "", contactName: s.contactName || "", contactPhone: s.contactPhone || "", status: s.status === "Inactive" ? "Inactive" : "Active" }); setShowForm(true); };
  const resetForm = () => { setShowForm(false); setEditingId(null); setForm({ title: "", details: "", contactName: "", contactPhone: "", status: "Active" }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { category, title: form.title, details: form.details, contactName: form.contactName, contactPhone: form.contactPhone, status: form.status };
      if (editingId) await api(`/services/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(`/services`, { method: "POST", body: JSON.stringify(payload) });
      resetForm();
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to save service"); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await api(`/services/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed to delete service"); }
  };

  const Icon = ICON_BY_CATEGORY[category] || Building;
  const filtered = q
    ? rows.filter((s) => [s.title, s.details || "", s.contactName || "", s.contactPhone || ""].join(" ").toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <section className="content">
      <div className="page-heading service-heading">
        <div>
          <Icon size={24} className="page-heading-icon" />
          <div>
            <h2>{category}</h2>
            <p>Hostel service information for students.</p>
          </div>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder={`Search ${category}...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {isAdmin && (
          <button type="button" className="btn-add" onClick={openAdd}>
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form className="facility-form" onSubmit={submit}>
          <div className="facility-form-row">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <textarea placeholder="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          <div className="facility-form-row">
            <input placeholder="Contact Name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <input placeholder="Contact Phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          </div>
          <div className="facility-form-actions">
            <button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Add"}</button>
            <button type="button" className="btn-cancel" onClick={resetForm}><X size={14} /> Cancel</button>
          </div>
        </form>
      )}

      {err ? (
        <div className="error-state">{err}<button type="button" onClick={load}>Retry</button></div>
      ) : loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "60%" }} /><div className="skeleton-line" style={{ width: "40%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Icon size={32} /><strong>No {category} information available.</strong></div>
      ) : (
        <div className="service-grid">
          {filtered.map((s) => (
            <div key={s.id} className="service-card">
              <div className="service-icon"><Icon size={20} /></div>
              <div className="service-body">
                <h3>{s.title}</h3>
                {s.details && <p>{s.details}</p>}
                <div className="service-contact">
                  {s.contactName && (<span><Phone size={14} /> {s.contactName}</span>)}
                  {s.contactPhone && (<span><MapPin size={14} /> {s.contactPhone}</span>)}
                </div>
                {s.photo && <img src={s.photo} alt={s.title} className="service-photo" />}
                <span className={`service-status ${s.status === "Active" ? "status-active" : "status-inactive"}`}>{s.status}</span>
                {isAdmin && (
                  <div className="facility-admin-actions">
                    <button type="button" className="btn-edit" onClick={() => openEdit(s)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" className="btn-delete" onClick={() => remove(s.id)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ServiceList;
