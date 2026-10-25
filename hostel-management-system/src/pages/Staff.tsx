import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

type Staff = {
  id: number;
  staffCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: string;
  responsibilities: string | null;
  status: "Active" | "Inactive" | "On Leave";
  createdAt: string;
};

const EMPTY = {
  staffCode: "", name: "", email: "", phone: "", department: "",
  designation: "", role: "Staff", responsibilities: "", status: "Active",
};

const STATUSES = ["Active", "Inactive", "On Leave"];
const ROLES = ["Staff", "Faculty", "Warden", "Maintenance", "Housekeeping", "Admin Support"];

function Staff({ search, role }: { search: string; role: "Admin" | "Student" | null }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<Staff[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const load = async (query?: string) => {
    setLoading(true);
    setErr("");
    try {
      const term = query ?? search;
      const params = new URLSearchParams();
      if (term) params.set("search", term);
      if (statusFilter) params.set("status", statusFilter);
      if (deptFilter) params.set("department", deptFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      setRows(await api<Staff[]>(`/staff${suffix}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);
  useEffect(() => {
    const t = window.setTimeout(() => load(search), 300);
    return () => window.clearTimeout(t);
  }, [search, statusFilter, deptFilter]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      staffCode: s.staffCode || "",
      name: s.name,
      email: s.email || "",
      phone: s.phone || "",
      department: s.department || "",
      designation: s.designation || "",
      role: s.role || "Staff",
      responsibilities: s.responsibilities || "",
      status: s.status,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { notify("Staff name is required", "error"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      notify("Invalid email address", "error"); return;
    }
    setSaving(true);
    try {
      const body = {
        staffCode: form.staffCode.trim() || undefined,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        role: form.role,
        responsibilities: form.responsibilities.trim() || null,
        status: form.status,
      };
      if (editing) {
        await api(`/staff/${editing.id}`, { method: "PUT", body });
        notify("Staff member updated");
      } else {
        await api("/staff", { method: "POST", body });
        notify("Staff member added");
      }
      setShowModal(false);
      load(search);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Staff) => {
    if (!window.confirm(`Remove ${s.name}? This cannot be undone.`)) return;
    try {
      await api(`/staff/${s.id}`, { method: "DELETE" });
      notify("Staff member removed");
      load(search);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const term = q.toLowerCase();
  const filtered = term
    ? rows.filter((s) =>
        [s.name, s.staffCode || "", s.email || "", s.department || "", s.designation || ""]
          .join(" ").toLowerCase().includes(term))
    : rows;

  const departments = Array.from(new Set(rows.map((r) => r.department).filter(Boolean))) as string[];

  return (
    <section className="content">
      <div className="page-heading students-heading">
        <div>
          <h2>Staff Management</h2>
          <p>Add, edit and manage hostel faculty &amp; staff members.</p>
        </div>
        {role === "Admin" && (
          <button type="button" className="primary-btn" onClick={openAdd}>
            <Plus size={16} /> Add Staff
          </button>
        )}
      </div>
      <div className="students-toolbar" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff..." />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={16} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}

      {loading ? (
        <div className="skeleton-card"><div className="skeleton-line" style={{ width: "40%" }} /><div className="skeleton-line" style={{ width: "70%" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>No staff members found.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Staff ID</th>
                <th>Department / Designation</th>
                <th>Role</th>
                <th>Status</th>
                {role === "Admin" && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="student-avatar">{s.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong>{s.name}</strong><br />
                        <small>{s.staffCode || `#${s.id}`}{s.email ? ` • ${s.email}` : ""}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.staffCode || "—"}</td>
                  <td>{[s.department, s.designation].filter(Boolean).join(" / ") || "—"}</td>
                  <td>{s.role}</td>
                  <td>
                    <span className={`status ${s.status === "Active" ? "status-active" : "status-pending"}`}>
                      {s.status}
                    </span>
                  </td>
                  {role === "Admin" && (
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="action-btn" onClick={() => openEdit(s)} aria-label="Edit">
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="action-btn" onClick={() => remove(s)} aria-label="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? "Edit Staff Member" : "Add Staff Member"}
          subtitle={editing ? `Updating ${editing.name}` : "Register a new staff member"}
          onClose={() => setShowModal(false)}
        >
          <div className="hub-form">
            <div className="hub-form-grid">
              <div className="hub-field"><label>Staff ID</label>
                <input value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} placeholder="Auto-generated if blank" />
              </div>
              <div className="hub-field"><label>Full name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
              </div>
              <div className="hub-field"><label>Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@mail.com" />
              </div>
              <div className="hub-field"><label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" />
              </div>
              <div className="hub-field"><label>Department</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Maintenance" />
              </div>
              <div className="hub-field"><label>Designation</label>
                <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Supervisor" />
              </div>
              <div className="hub-field"><label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="hub-field"><label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="hub-field" style={{ gridColumn: "1 / -1" }}><label>Responsibilities</label>
                <textarea value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} placeholder="Assigned duties..." rows={3} />
              </div>
            </div>
            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Staff"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default Staff;

