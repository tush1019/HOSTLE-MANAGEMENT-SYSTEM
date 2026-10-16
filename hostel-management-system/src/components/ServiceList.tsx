import { useEffect, useState } from "react";
import { Search, Phone, MapPin, Building, Wifi, Droplets, ShieldAlert, LayoutList } from "lucide-react";
import { api } from "../lib/api";

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

function ServiceList({ category }: { category: string }) {
  const [rows, setRows] = useState<Service[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

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
      </div>

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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ServiceList;
