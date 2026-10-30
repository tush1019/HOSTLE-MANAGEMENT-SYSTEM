import { useEffect, useMemo, useState } from "react";
import { api, getStoredUser } from "../lib/api";
import { useToast } from "../components/Toast";

type Profile = {
  userId: number; email: string; phone: string | null; mobile: string | null; bio: string | null;
  address: string | null; profilePhoto: string | null; coverPhoto: string | null;
  designation: string | null; emergencyContact: string | null; updatedAt: string | null;
  adminId: string | null;
};

function AdminProfile() {
  const { notify } = useToast();
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ phone: "", mobile: "", bio: "", address: "", designation: "", emergencyContact: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) { setErr("Not signed in."); setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      const prof = await api<Profile | null>("/profiles/me");
      setProfile(prof ?? null);
      setForm({
        phone: prof?.phone ?? "", mobile: prof?.mobile ?? "", bio: prof?.bio ?? "",
        address: prof?.address ?? "", designation: prof?.designation ?? "",
        emergencyContact: prof?.emergencyContact ?? "",
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load profile"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api<Profile>("/profiles/me/details", {
        method: "PUT",
        body: {
          phone: form.phone.trim() || null, mobile: form.mobile.trim() || null,
          bio: form.bio.trim() || null, address: form.address.trim() || null,
          designation: form.designation.trim() || null, emergencyContact: form.emergencyContact.trim() || null,
        },
      });
      setProfile(updated); notify("Profile saved"); load();
    } catch (e) { notify(e instanceof Error ? e.message : "Save failed", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="content premium-page"><p>Loading…</p></section>;
  if (err) return <section className="content premium-page"><p style={{ color: "#ef4444" }}>{err}</p></section>;

  return (
    <section className="content premium-page">
      <div className="premium-hero"><div className="eyebrow">Admin Profile</div><h2>My Profile</h2></div>
      <div className="sp-card" style={{ padding: 20 }}>
        <div className="sp-facts">
          <div className="sp-fact"><span>Admin ID</span><strong>{profile?.adminId || "ADM" + String(user?.id || "").padStart(4, "0")}</strong></div>
          <div className="sp-fact"><span>Name</span><strong>{user?.name}</strong></div>
          <div className="sp-fact"><span>Email</span><strong>{user?.email}</strong></div>
        </div>
        <div className="hub-form-grid" style={{ marginTop: 16 }}>
          <div className="hub-field"><label>Mobile</label><input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
          <div className="hub-field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="hub-field"><label>Designation</label><input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div className="hub-field"><label>Emergency Contact</label><input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>
          <div className="hub-field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="hub-form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="primary-btn" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </div>
    </section>
  );
}

export default AdminProfile;