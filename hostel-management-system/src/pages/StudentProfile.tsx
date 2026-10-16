import { useEffect, useMemo, useState } from "react";
import {
  BedDouble, BookOpen, Camera, Image as ImageIcon, Pencil,
  Save, ShieldCheck, Trash2,
} from "lucide-react";
import { api, getStoredUser } from "../lib/api";
import { formatINR } from "../lib/format";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import { compressImage } from "../lib/images";

type Profile = {
  userId: number;
  email: string;
  phone: string | null;
  bio: string | null;
  address: string | null;
  profilePhoto: string | null;
  coverPhoto: string | null;
  updatedAt: string | null;
};

type StudentRec = {
  studentCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  course: string | null;
  room: string | null;
  status: string;
};

type RoomRec = {
  room: string;
  floor: string;
  type: string;
  capacity: number;
  occupied: number;
  status: string;
  wing: string;
  category: string;
  washroom: string;
  amenities: string | null;
  monthlyRent: number;
  photo: string | null;
  photoGallery: string | null;
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function chipClass(status: string | null | undefined) {
  if (status === "Active" || status === "Available" || status === "Approved") return "sp-chip sp-chip-ok";
  if (status === "Pending" || status === "Maintenance" || status === "In Progress") return "sp-chip sp-chip-warn";
  return "sp-chip sp-chip-muted";
}

function StudentProfile() {
  const { notify } = useToast();
  const user = useMemo(() => getStoredUser(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<StudentRec | null>(null);
  const [room, setRoom] = useState<RoomRec | null>(null);
  const [form, setForm] = useState({ phone: "", bio: "", address: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState<"" | "avatar" | "cover">("");
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null);

  const load = async () => {
    if (!user) {
      setErr("You are not signed in on this device.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const [prof, students] = await Promise.all([
        api<Profile | null>(
          `/profiles/me?userId=${user.id}&email=${encodeURIComponent(user.email)}`
        ),
        api<StudentRec[]>(`/students?email=${encodeURIComponent(user.email)}`),
      ]);
      setProfile(prof ?? null);
      setForm({
        phone: prof?.phone ?? "",
        bio: prof?.bio ?? "",
        address: prof?.address ?? "",
      });
      const rec = Array.isArray(students) && students.length ? students[0] : null;
      setStudent(rec);
      if (rec && rec.room) {
        try {
          const rooms = await api<RoomRec[]>(`/rooms?search=${encodeURIComponent(rec.room)}`);
          const match = Array.isArray(rooms)
            ? rooms.find((r) => r.room === rec.room) ?? null
            : null;
          setRoom(match);
        } catch {
          setRoom(null);
        }
      } else {
        setRoom(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPhoto = async (kind: "avatar" | "cover", file: File) => {
    if (!user) return;
    setUploading(kind);
    try {
      const photo = await compressImage(
        file,
        kind === "avatar"
          ? { maxDim: 512, quality: 0.82, maxChars: 300000 }
          : { maxDim: 1600, quality: 0.78, maxChars: 800000 }
      );
      const updated = await api<Profile>("/profiles/me/photo", {
        method: "PUT",
        body: { userId: user.id, email: user.email, kind, photo },
      });
      setProfile(updated);
      notify(kind === "avatar" ? "Profile photo updated" : "Cover photo updated");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Photo upload failed", "error");
    } finally {
      setUploading("");
    }
  };

  const removePhoto = async (kind: "avatar" | "cover") => {
    if (!user) return;
    const label = kind === "avatar" ? "profile photo" : "cover photo";
    if (!window.confirm(`Remove your ${label}?`)) return;
    setUploading(kind);
    try {
      const updated = await api<Profile>("/profiles/me/photo", {
        method: "DELETE",
        body: { userId: user.id, email: user.email, kind },
      });
      setProfile(updated);
      notify(kind === "avatar" ? "Profile photo removed" : "Cover photo removed");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not remove photo", "error");
    } finally {
      setUploading("");
    }
  };

  const saveDetails = async () => {
    if (!user) return;
    setSavingDetails(true);
    try {
      const updated = await api<Profile>("/profiles/me/details", {
        method: "PUT",
        body: { userId: user.id, email: user.email, ...form },
      });
      setProfile(updated);
      notify("Profile details saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save details", "error");
    } finally {
      setSavingDetails(false);
    }
  };

  const onPick = (kind: "avatar" | "cover") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadPhoto(kind, file);
  };

  if (!user) {
    return (
      <section className="content">
        <div className="error-state">
          <strong>You are not signed in</strong>
          <p>Sign in again to view and edit your profile.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="content">
        <div className="skeleton-card">
          <div className="skeleton-line" style={{ width: "45%" }} />
          <div className="skeleton-line" style={{ width: "75%" }} />
          <div className="skeleton-line" style={{ width: "60%" }} />
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className="content">
        <div className="error-state">
          {err}
          <button type="button" onClick={() => void load()}>Retry</button>
        </div>
      </section>
    );
  }

  const cover = profile?.coverPhoto || "";
  const avatar = profile?.profilePhoto || "";
  const displayName = student?.name || user.name;

  /* Room gallery: primary photo + comma-separated gallery entries. */
  const gallery: string[] = [];
  if (room) {
    if (room.photo) gallery.push(room.photo);
    (room.photoGallery || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((p) => {
        if (!gallery.includes(p)) gallery.push(p);
      });
  }

  return (
    <section className="content sp-page">
      <div className="sp-header">
        <div className={`sp-cover${cover ? "" : " sp-cover-empty"}`}>
          {cover ? (
            <img src={cover} alt="Cover" className="sp-cover-img" />
          ) : (
            <span className="sp-cover-label">No cover photo yet</span>
          )}
          <div className="sp-cover-actions">
            <label className="sp-photo-btn" title="Change cover photo">
              <Camera size={14} />
              {cover ? "Change cover" : "Add cover"}
              <input
                type="file"
                accept="image/*"
                onChange={onPick("cover")}
                disabled={uploading === "cover"}
              />
            </label>
            {cover && uploading !== "cover" && (
              <button
                type="button"
                className="sp-photo-btn sp-photo-remove"
                onClick={() => void removePhoto("cover")}
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
            {uploading === "cover" && <span className="sp-busy">Saving…</span>}
          </div>
        </div>

        <div className="sp-id">
          <div className="sp-avatar">
            {avatar ? (
              <img src={avatar} alt={displayName} />
            ) : (
              <span className="sp-avatar-fallback">{initialsOf(displayName)}</span>
            )}
            <label className="sp-avatar-btn" title="Change profile photo">
              <Camera size={14} />
              <input
                type="file"
                accept="image/*"
                onChange={onPick("avatar")}
                disabled={uploading === "avatar"}
              />
            </label>
            {uploading === "avatar" && <span className="sp-busy sp-busy-avatar">Saving…</span>}
          </div>
          <div className="sp-id-text">
            <h2>{displayName}</h2>
            <p>{user.email}</p>
            <div className="sp-chips">
              <span className="sp-chip">Student</span>
              {student?.studentCode && (
                <span className="sp-chip sp-chip-soft">{student.studentCode}</span>
              )}
              {student?.status ? (
                <span className={chipClass(student.status)}>{student.status}</span>
              ) : (
                <span className="sp-chip sp-chip-muted">No student record linked</span>
              )}
            </div>
          </div>
          <div className="sp-id-actions">
            {avatar && uploading !== "avatar" && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void removePhoto("avatar")}
              >
                <Trash2 size={14} /> Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="sp-grid">
        {/* Editable profile details — account-specific, edited only by the owner */}
        <div className="settings-card sp-card">
          <div className="settings-card-title">
            <Pencil size={20} />
            <div><h3>Profile details</h3><p>Editable by you only</p></div>
          </div>
          <div className="hub-form">
            <div className="hub-field">
              <label>Phone</label>
              <input
                value={form.phone}
                maxLength={30}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Your contact number"
              />
            </div>
            <div className="hub-field">
              <label>Address</label>
              <input
                value={form.address}
                maxLength={200}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Home address"
              />
            </div>
            <div className="hub-field">
              <label>Bio</label>
              <textarea
                rows={3}
                maxLength={800}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A short intro about you..."
              />
              <small className="sp-hint">{form.bio.length}/800 characters</small>
            </div>
            <div className="hub-form-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => void saveDetails()}
                disabled={savingDetails}
              >
                <Save size={15} /> {savingDetails ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Read-only account info */}
        <div className="settings-card sp-card">
          <div className="settings-card-title">
            <ShieldCheck size={20} />
            <div><h3>Account</h3><p>Signed-in details (read-only)</p></div>
          </div>
          <div className="security-row"><div><strong>Full name</strong><span>{displayName}</span></div></div>
          <div className="security-row"><div><strong>Email</strong><span>{user.email}</span></div></div>
          <div className="security-row">
            <div><strong>Role</strong><span>{user.role === "Admin" ? "Administrator" : "Student"}</span></div>
          </div>
          <div className="security-row">
            <div>
              <strong>Profile last updated</strong>
              <span>
                {profile?.updatedAt
                  ? String(profile.updatedAt).replace("T", " ").slice(0, 16)
                  : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* Academic / enrollment record (admin-managed) */}
        <div className="settings-card sp-card">
          <div className="settings-card-title">
            <BookOpen size={20} />
            <div><h3>Academic record</h3><p>Managed by the hostel office</p></div>
          </div>
          {student ? (
            <>
              <div className="security-row">
                <div><strong>Student code</strong><span>{student.studentCode || "—"}</span></div>
              </div>
              <div className="security-row">
                <div><strong>Course</strong><span>{student.course || "Not set"}</span></div>
              </div>
              <div className="security-row">
                <div><strong>Phone on record</strong><span>{student.phone || "Not set"}</span></div>
              </div>
              <div className="security-row">
                <div><strong>Room on record</strong><span>{student.room || "Not allocated"}</span></div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <BookOpen size={24} />
              <strong>No student record linked</strong>
              <p>Ask the hostel office to link your account to a student record.</p>
            </div>
          )}
        </div>

        {/* Room & allocation with multi-image gallery */}
        <div className="settings-card sp-card sp-card-wide">
          <div className="settings-card-title">
            <BedDouble size={20} />
            <div><h3>Room &amp; allocation</h3><p>Beds, amenities and photos</p></div>
            {room && <span className={chipClass(room.status)}>{room.status}</span>}
          </div>
          {!student ? (
            <div className="empty-state">
              <BedDouble size={26} />
              <strong>No student record linked</strong>
              <p>Room allocation appears here once the hostel office links your account.</p>
            </div>
          ) : !student.room ? (
            <div className="empty-state">
              <BedDouble size={26} />
              <strong>Room not allocated yet</strong>
              <p>Your allocation will appear here once the warden assigns a room.</p>
            </div>
          ) : !room ? (
            <div className="empty-state">
              <BedDouble size={26} />
              <strong>Room {student.room} not found in the directory</strong>
              <p>Report this to the hostel office if it looks wrong.</p>
            </div>
          ) : (
            <>
              <div className="sp-facts">
                <div className="sp-fact"><span>Room</span><strong>{room.room}</strong></div>
                <div className="sp-fact"><span>Floor</span><strong>{room.floor}</strong></div>
                <div className="sp-fact"><span>Type</span><strong>{room.type}</strong></div>
                <div className="sp-fact"><span>Wing</span><strong>{room.wing}</strong></div>
                <div className="sp-fact"><span>Category</span><strong>{room.category}</strong></div>
                <div className="sp-fact"><span>Washroom</span><strong>{room.washroom}</strong></div>
                <div className="sp-fact">
                  <span>Beds</span>
                  <strong>{room.occupied}/{room.capacity} occupied</strong>
                </div>
                <div className="sp-fact">
                  <span>Monthly rent</span>
                  <strong>{formatINR(Number(room.monthlyRent) || 0)}</strong>
                </div>
              </div>
              {room.amenities && (
                <div className="sp-amenities">
                  <span className="sp-facts-label">Amenities</span>
                  <div className="sp-chips">
                    {room.amenities
                      .split(",")
                      .map((a) => a.trim())
                      .filter(Boolean)
                      .map((a, i) => (
                        <span className="sp-chip" key={`${a}-${i}`}>{a}</span>
                      ))}
                  </div>
                </div>
              )}
              <div className="sp-gallery-head">
                <span className="sp-facts-label">Room gallery</span>
                <small>
                  {gallery.length} photo{gallery.length === 1 ? "" : "s"}
                </small>
              </div>
              {gallery.length === 0 ? (
                <div className="empty-state">
                  <ImageIcon size={24} />
                  <strong>No room photos yet</strong>
                </div>
              ) : (
                <div className="sp-gallery">
                  {gallery.map((src, i) => (
                    <button
                      type="button"
                      className="sp-gallery-item"
                      key={`${src}-${i}`}
                      onClick={() => setViewer({ src, title: `Room ${room.room} — photo ${i + 1}` })}
                      title={`Preview photo ${i + 1}`}
                    >
                      <img src={src} alt={`Room ${room.room} photo ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {viewer && (
        <Modal title={viewer.title} subtitle="Room photo" onClose={() => setViewer(null)}>
          <div className="sp-viewer">
            <img src={viewer.src} alt={viewer.title} />
          </div>
        </Modal>
      )}
    </section>
  );
}

export default StudentProfile;