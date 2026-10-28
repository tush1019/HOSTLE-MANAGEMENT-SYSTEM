import { useEffect, useState } from "react";
import {
  Building2,
  Wrench,
  Utensils,
  Users,
  CreditCard,
  ShieldCheck,
  MapPin,
  Clock,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { api, getStoredUser } from "../lib/api";

type Facility = {
  id: number;
  category: string;
  title: string;
  details: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: "Active" | "Inactive";
  createdAt: string | null;
};

type CategoryFilter = "All" | "Warden" | "Mess & Kitchen" | "Cleaning" | "Ground & Sports" | "Charges & Billing" | "Safety & Rules" | "General";

const CATEGORY_OPTIONS: CategoryFilter[] = [
  "All",
  "Warden",
  "Mess & Kitchen",
  "Cleaning",
  "Ground & Sports",
  "Charges & Billing",
  "Safety & Rules",
  "General",
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Warden": Building2,
  "Mess & Kitchen": Utensils,
  "Cleaning": Wrench,
  "Ground & Sports": Users,
  "Charges & Billing": CreditCard,
  "Safety & Rules": ShieldCheck,
  "General": MapPin,
};

function statusBadge(status: string) {
  const isOk = status === "Active";
  return (
    <span className={`facility-status ${isOk ? "facility-status-active" : "facility-status-inactive"}`}>
      {isOk ? "Active" : "Inactive"}
    </span>
  );
}

function contactRow(value: string | null) {
  if (!value) return null;
  return (
    <div className="facility-contact">
      <MapPin size={14} className="facility-contact-icon" />
      <span>{value}</span>
    </div>
  );
}

function FacilityCard({ facility, isAdmin, onEdit, onDelete }: { facility: Facility; isAdmin: boolean; onEdit: (f: Facility) => void; onDelete: (id: number) => void }) {
  const Icon = CATEGORY_ICONS[facility.category] || MapPin;
  return (
    <div className="facility-card">
      <div className="facility-card-head">
        <span className="facility-category">{facility.category}</span>
        {statusBadge(facility.status)}
      </div>
      <div className="facility-card-icon">
        <Icon size={22} />
      </div>
      <h3 className="facility-title">{facility.title}</h3>
      {facility.details && (
        <p className="facility-details">{facility.details}</p>
      )}
      <div className="facility-contact-row">
        {contactRow(facility.contactPhone)}
        {contactRow(facility.contactName)}
      </div>
      <span className="facility-updated">
        <Clock size={12} />{" "}
        {facility.createdAt ? new Date(facility.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : ""}
      </span>
        {isAdmin && (
          <div className="facility-admin-actions">
            <button type="button" className="btn-edit" onClick={() => onEdit(facility)}>
              <Pencil size={14} /> Edit
            </button>
            <button type="button" className="btn-delete" onClick={() => onDelete(facility.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
    </div>
  );
}

export default function Facilities({ role }: { role?: "Admin" | "Student" | null }) {
  const isAdmin = (role ?? (getStoredUser()?.role as "Admin" | "Student" | null)) === "Admin";
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "General",
    title: "",
    details: "",
    contactName: "",
    contactPhone: "",
    status: "Active",
  });

  const load = async (cat?: CategoryFilter) => {
    setLoading(true);
    setErr("");
    try {
      const suffix = cat && cat !== "All" ? `?category=${cat}` : "";
      const data = await api<Facility[]>(`/facilities${suffix}`);
      setFacilities(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load("All"); }, []);

  const filtered = facilities.filter((f) => category === "All" || f.category === category);

  const CATEGORIES = CATEGORY_OPTIONS.filter((c) => c !== "All");

  const resetForm = () => {
    setForm({ category: "General", title: "", details: "", contactName: "", contactPhone: "", status: "Active" });
    setEditingId(null);
    setShowForm(false);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (f: Facility) => {
    setForm({
      category: f.category,
      title: f.title,
      details: f.details || "",
      contactName: f.contactName || "",
      contactPhone: f.contactPhone || "",
      status: f.status,
    });
    setEditingId(f.id);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        category: form.category,
        title: form.title.trim(),
        details: form.details.trim() || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        status: form.status,
      };
      if (editingId) {
        await api(`/facilities/${editingId}`, { method: "PUT", body });
      } else {
        await api("/facilities", { method: "POST", body });
      }
      resetForm();
      await load(category);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save facility");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this facility?")) return;
    try {
      await api(`/facilities/${id}`, { method: "DELETE" });
      await load(category);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete facility");
    }
  };

  return (
    <section className="content premium-page">
      <div className="page-heading facility-heading">
        <div>
          <h2>Facility Directory</h2>
          <p>Contact all campus departments and key offices in one place.</p>
        </div>
        <div className="facility-filters">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`facility-filter ${category === opt ? "active" : ""}`}
              onClick={() => setCategory(opt)}
            >
              {opt === "All" ? "All Facilities" : opt}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button type="button" className="btn-add" onClick={openAdd}>
            <Plus size={16} /> Add Facility
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form className="facility-form" onSubmit={submit}>
          <div className="facility-form-row">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
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
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </button>
            <button type="button" className="btn-cancel" onClick={resetForm}>
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="facility-loading">
          <Loader2 size={24} className="facility-loading-spinner" />
          <p>Loading facilities...</p>
        </div>
      )}

      {err && !loading && (
        <div className="error-state">
          {err}
          <button type="button" onClick={() => load("All")}>Retry</button>
        </div>
      )}

      {!loading && !err && filtered.length === 0 && (
        <div className="empty-state">
          <Building2 size={28} />
          <strong>No facilities found</strong>
          <p>Try a different filter or add a new facility.</p>
        </div>
      )}

      {!loading && !err && filtered.length > 0 && (
        <div className="facility-grid">
          {filtered.map((f) => (
            <FacilityCard key={f.id} facility={f} isAdmin={isAdmin} onEdit={openEdit} onDelete={remove} />
          ))}
        </div>
      )}
    </section>
  );
}

