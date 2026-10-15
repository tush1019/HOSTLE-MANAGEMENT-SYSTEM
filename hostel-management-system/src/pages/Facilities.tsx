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
} from "lucide-react";
import { api } from "../lib/api";

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

function FacilityCard({ facility }: { facility: Facility }) {
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
    </div>
  );
}

export default function Facilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");

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

  const filtered = facilities.filter(f => category === "All" || f.category === category);

  return (
    <section className="content">
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
      </div>

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
            <FacilityCard key={f.id} facility={f} />
          ))}
        </div>
      )}
    </section>
  );
}
