import { useEffect, useState } from "react";
import { BedDouble, Plus, Pencil, Trash2, Search } from "lucide-react";
import { api, getStoredUser } from "../lib/api";
import { formatINR } from "../lib/format";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";

type Room = {
  id: number; room: string; floor: string; type: string;
  capacity: number; occupied: number;
  status: "Available" | "Occupied" | "Maintenance";
  wing: "Boys" | "Girls";
  category: "Standard" | "Premium" | "Deluxe";
  washroom: "Attached" | "Common";
  amenities: string | null;
  monthlyRent: number | string;
  photo: string | null;
  photoGallery: string | null;
  toiletCondition: string | null;
  cleaningStatus: string | null;
  groundSportsStatus: string | null;
  shaftsStatus: string | null;
  safetyNotes: string | null;
};

const EMPTY = {
  room: "", floor: "Ground Floor", type: "2 Seater", capacity: "2", occupied: "0",
  status: "Available", wing: "Boys", category: "Standard", washroom: "Common",
  amenities: "", monthlyRent: "", photo: "",
  photoGallery: "", toiletCondition: "", cleaningStatus: "",
  groundSportsStatus: "", shaftsStatus: "", safetyNotes: "",
};

const WINGS = ["All", "Boys", "Girls"] as const;
const CATEGORIES = ["All", "Standard", "Premium", "Deluxe"] as const;

function wingClass(w: string) {
  return w === "Girls" ? "room-wing room-wing-girls" : "room-wing room-wing-boys";
}

function categoryClass(c: string) {
  if (c === "Deluxe") return "room-category room-category-deluxe";
  if (c === "Premium") return "room-category room-category-premium";
  return "room-category room-category-standard";
}

function Rooms({ search, role }: { search: string; role?: string }) {
  const { notify } = useToast();
  const [rows, setRows] = useState<Room[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [wing, setWing] = useState<(typeof WINGS)[number]>("All");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const load = async (query?: string) => {
    setLoading(true);
    setErr("");
    try {
      if (role === "Student") {
        const user = getStoredUser();
        if (!user?.email) {
          setRows([]);
          return;
        }
        const students = await api<any[]>(`/students?email=${encodeURIComponent(user.email)}`);
        const rec = Array.isArray(students) && students.length ? students[0] : null;
        if (!rec?.room) {
          setRows([]);
          return;
        }
        const rooms = await api<Room[]>(`/rooms?search=${encodeURIComponent(rec.room)}`);
        setRows(Array.isArray(rooms) ? rooms.filter((r) => r.room === rec.room) : []);
        return;
      }
      const params = new URLSearchParams();
      const term = query ?? search;
      if (term) params.set("search", term);
      if (wing !== "All") params.set("wing", wing);
      if (category !== "All") params.set("category", category);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      setRows(await api<Room[]>(`/rooms${suffix}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);
  useEffect(() => {
    const t = window.setTimeout(() => load(search), 300);
    return () => window.clearTimeout(t);
  }, [search, wing, category]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({
      room: r.room, floor: r.floor, type: r.type,
      capacity: String(r.capacity), occupied: String(r.occupied), status: r.status,
      wing: r.wing || "Boys", category: r.category || "Standard",
      washroom: r.washroom || "Common", amenities: r.amenities || "",
      monthlyRent: r.monthlyRent != null ? String(r.monthlyRent) : "",
      photo: r.photo || "",
      photoGallery: r.photoGallery || "",
      toiletCondition: r.toiletCondition || "",
      cleaningStatus: r.cleaningStatus || "",
      groundSportsStatus: r.groundSportsStatus || "",
      shaftsStatus: r.shaftsStatus || "",
      safetyNotes: r.safetyNotes || "",
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.room.trim()) { notify("Room number is required", "error"); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity),
        occupied: Number(form.occupied),
        monthlyRent: form.monthlyRent === "" ? 0 : Number(form.monthlyRent),
      };
      if (editing) {
        await api(`/rooms/${editing.id}`, { method: "PUT", body });
        notify("Room updated");
      } else {
        await api("/rooms", { method: "POST", body });
        notify("Room added");
      }
      setShowModal(false);
      load(search);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Room) => {
    if (!window.confirm(`Remove room ${r.room}?`)) return;
    try {
      await api(`/rooms/${r.id}`, { method: "DELETE" });
      notify("Room removed");
      load(search);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const term = q.toLowerCase();
  const filtered = term
    ? rows.filter((r) => [r.room, r.floor, r.type].join(" ").toLowerCase().includes(term))
    : rows;
  const total = rows.length;
  const avail = rows.filter((r) => r.status === "Available").length;
  const occ = rows.filter((r) => r.status === "Occupied").length;
  const maint = rows.filter((r) => r.status === "Maintenance").length;
  return (
    <section className="content">
      <div className="page-heading rooms-heading">
        <div>
          <h2>Rooms</h2>
          <p>Track rooms, beds, occupancy and availability.</p>
        </div>
        {role !== "Student" && (
          <button type="button" className="primary-btn" onClick={openAdd}>
            <Plus size={17} /> Add Room
          </button>
        )}
      </div>

      <div className="room-summary-grid">
        <div className="room-summary-card">
          <div className="room-summary-icon"><BedDouble size={20} /></div>
          <div><span>Total rooms</span><h3>{total}</h3></div>
        </div>
        <div className="room-summary-card">
          <div className="room-summary-icon"><BedDouble size={20} /></div>
          <div><span>Available</span><h3>{avail}</h3></div>
        </div>
        <div className="room-summary-card">
          <div className="room-summary-icon"><BedDouble size={20} /></div>
          <div><span>Occupied</span><h3>{occ}</h3></div>
        </div>
        <div className="room-summary-card">
          <div className="room-summary-icon"><BedDouble size={20} /></div>
          <div><span>Maintenance</span><h3>{maint}</h3></div>
        </div>
      </div>

      <div className="rooms-table-card">
        <div className="rooms-table-header">
          <div><h3>All Rooms</h3><p>{filtered.length} record(s)</p></div>
          <div className="room-filters">
            <div className="room-search">
              <Search size={16} />
              <input placeholder="Filter..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select
              className="room-filter-select"
              value={wing}
              onChange={(e) => setWing(e.target.value as (typeof WINGS)[number])}
              aria-label="Filter by wing"
            >
              {WINGS.map((w) => (
                <option key={w} value={w}>{w === "All" ? "All wings" : w}</option>
              ))}
            </select>
            <select
              className="room-filter-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              aria-label="Filter by category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="skeleton-card">
            <div className="skeleton-line" style={{ width: "60%" }} />
            <div className="skeleton-line" style={{ width: "80%" }} />
          </div>
        ) : err ? (
          <div className="error-state">{err}
            <button type="button" onClick={() => load(search)}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <BedDouble size={28} /><strong>No rooms found</strong>
            <p>Add your first room to get started.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Beds</th>
                  <th>Wing</th>
                  <th>Category</th>
                  <th>Washroom</th>
                  <th>Amenities</th>
                  <th>Photo</th>
                  <th>Monthly Rent</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="room-number">
                        <div className="room-icon"><BedDouble size={17} /></div>
                        <div><strong>{r.room}</strong><br /><small>{r.floor}</small></div>
                      </div>
                    </td>
                    <td>{r.type}</td>
                    <td>{r.occupied}/{r.capacity}</td>
                    <td><span className={`room-wing ${wingClass(r.wing)}`}>{r.wing}</span></td>
                    <td><span className={`room-category ${categoryClass(r.category)}`}>{r.category}</span></td>
                    <td><span className={`room-washroom ${r.washroom === "Attached" ? "room-washroom-attached" : "room-washroom-common"}`}>{r.washroom}</span></td>
                    <td className="room-amenities">{r.amenities?.split(",").slice(0, 3).join(", ") || "—"}</td>
                    <td><img src={r.photo || "/rooms/boys-room.svg"} alt={`${r.room} ${r.wing}`} className="room-photo" /></td>
                    <td className="room-rent">{typeof r.monthlyRent === "number" ? formatINR(r.monthlyRent) : r.monthlyRent || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {role !== "Student" && (
                        <>
                          <button type="button" className="action-btn" onClick={() => openEdit(r)} aria-label="Edit">
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="action-btn" onClick={() => remove(r)} aria-label="Delete">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal
          title={editing ? `Edit Room ${editing.room}` : "Add Room"}
          subtitle="Room details and bed capacity"
          onClose={() => setShowModal(false)}
        >
          <div className="hub-form">
            <div className="hub-form-grid">
              <div className="hub-field"><label>Room number *</label>
                <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="101" />
              </div>
              <div className="hub-field"><label>Floor</label>
                <select value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>
                  <option>Ground Floor</option><option>First Floor</option>
                  <option>Second Floor</option><option>Third Floor</option>
                </select>
              </div>
              <div className="hub-field"><label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>1 Seater</option><option>2 Seater</option>
                  <option>3 Seater</option><option>4 Seater</option>
                </select>
              </div>
              <div className="hub-field"><label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>Available</option><option>Occupied</option><option>Maintenance</option>
                </select>
              </div>
              <div className="hub-field"><label>Capacity</label>
                <input type="number" min={1} value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div className="hub-field"><label>Occupied beds</label>
                <input type="number" min={0} value={form.occupied}
                  onChange={(e) => setForm({ ...form, occupied: e.target.value })} />
              </div>
            </div>

            <div className="hub-form-subhead">Premium &amp; maintenance details</div>
            <div className="hub-form-grid">
              <div className="hub-field"><label>Toilet condition</label>
                <select value={form.toiletCondition} onChange={(e) => setForm({ ...form, toiletCondition: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
              <div className="hub-field"><label>Cleaning status</label>
                <select value={form.cleaningStatus} onChange={(e) => setForm({ ...form, cleaningStatus: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="Cleaning Scheduled">Cleaning Scheduled</option>
                  <option value="Cleaning Done">Cleaning Done</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
              <div className="hub-field"><label>Ground &amp; sports</label>
                <select value={form.groundSportsStatus} onChange={(e) => setForm({ ...form, groundSportsStatus: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="hub-field"><label>Water shafts</label>
                <select value={form.shaftsStatus} onChange={(e) => setForm({ ...form, shaftsStatus: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="Full">Full</option>
                  <option value="Empty">Empty</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="hub-field full"><label>Safety notes</label>
                <textarea rows={2} value={form.safetyNotes}
                  onChange={(e) => setForm({ ...form, safetyNotes: e.target.value })}
                  placeholder="Gate timings, CCTV coverage, emergency contacts..." />
              </div>
              <div className="hub-field full"><label>Photo gallery</label>
                <textarea rows={2} value={form.photoGallery}
                  onChange={(e) => setForm({ ...form, photoGallery: e.target.value })}
                  placeholder="/rooms/101-a.jpg, /rooms/101-b.jpg" />
              </div>
            </div>

            <div className="hub-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Room"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default Rooms;
