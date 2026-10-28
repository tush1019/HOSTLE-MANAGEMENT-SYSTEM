import { useEffect, useState } from "react";
import {
  Users, BedDouble, CreditCard, MessageSquareWarning, Megaphone,
  ArrowUpRight, CircleAlert, Clock3, BedSingle, Wrench, BadgeCheck, TrendingUp,
  BarChart3, UserCircle, Calendar, Utensils, ArrowRight,
} from "lucide-react";
import { api, getStoredUser } from "../lib/api";
import { formatINR } from "../lib/format";
import "../dashboard-premium.css";

type D = {
  students: { total: number; active: number };
  rooms: { total: number; occupied: number; available: number; maintenance: number; boys: number; girls: number; beds: number; bedsFilled: number; occupancyRate: number };
  fees: { paid: number; pending: number; paidCount: number; pendingCount: number };
  complaints: { total: number; pending: number; inProgress: number; resolved: number };
  monthlyFees: { month: string; amount: number }[];
  recentComplaints: { code: string; student: string; subject: string; status: string }[];
  recentFees: { code: string; student: string; amount: number; status: string }[];
  notices: { id: number; title: string; message: string; date: string }[];
};

type LeaveRow = { leaveCode: string | null; startDate: string; endDate: string; reason: string; status: string };
type MaintRow = { requestCode: string | null; title: string; status: string; priority: string };
type TaskItem = { key: string; title: string; sub: string; status: string; page: string };

function Dashboard({ role, onNavigate }: { role: "Admin" | "Student" | "Faculty"; onNavigate: (page: string) => void }) {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState("");
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [facultyData, setFacultyData] = useState<any>(null);
  useEffect(() => {
    if (role !== "Faculty") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api<any>("/faculty/dashboard");
        if (!cancelled) setFacultyData(data);
      } catch {
        if (!cancelled) setFacultyData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);
  const load = async () => {
    try { setD(await api<D>("/dashboard")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  };
  useEffect(() => { if (role !== "Faculty") load(); }, []);

  /* Student pending tasks — own leave applications + open maintenance reports. */
  useEffect(() => {
    if (role !== "Student") return;
    const user = getStoredUser();
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [leaves, maints] = await Promise.all([
          api<LeaveRow[]>(`/leave?student=${encodeURIComponent(user.name)}`),
          api<MaintRow[]>(`/maintenance?student=${encodeURIComponent(user.name)}`),
        ]);
        if (cancelled) return;
        const items: TaskItem[] = [];
        (leaves || [])
          .filter((l) => l.status === "Pending")
          .slice(0, 4)
          .forEach((l) =>
            items.push({
              key: `leave-${l.leaveCode || l.startDate}`,
              title: l.leaveCode || "Leave application",
              sub: `Leave ${l.startDate} → ${l.endDate}`,
              status: "Pending",
              page: "Leave Management",
            })
          );
        (maints || [])
          .filter((m) => m.status !== "Resolved")
          .slice(0, 4)
          .forEach((m) =>
            items.push({
              key: `mnt-${m.requestCode || m.title}`,
              title: m.requestCode || "Maintenance request",
              sub: m.title,
              status: m.status,
              page: "Maintenance Request",
            })
          );
        setTasks(items.slice(0, 6));
      } catch {
        if (!cancelled) setTasks(null);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);
  if (role === "Faculty") {
    const user = getStoredUser();
    const fd = facultyData?.data;
    return (
      <section className="content premium-page premium-dashboard">
        <div className="page-header">
          <h1>Faculty Dashboard</h1>
          <p>Welcome back, {user?.name || "Faculty"}. Live overview of your authorized faculty resources.</p>
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>Students</h3>
            <p>{fd?.students?.active ?? 0} active of {fd?.students?.total ?? 0} total</p>
          </div>
          <div className="dashboard-card">
            <h3>Rooms</h3>
            <p>{fd?.rooms?.available ?? 0} available of {fd?.rooms?.total ?? 0} total</p>
          </div>
          <div className="dashboard-card">
            <h3>Complaints</h3>
            <p>{fd?.complaints?.pending ?? 0} pending, {fd?.complaints?.resolved ?? 0} resolved</p>
          </div>
        </div>
        <div className="dashboard-grid" style={{ marginTop: 16 }}>
          <div className="dashboard-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("Faculty Rooms")}>
            <h3>Faculty Rooms</h3>
            <p>View rooms assigned to you.</p>
          </div>
          <div className="dashboard-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("Students")}>
            <h3>Student Directory</h3>
            <p>View student records (read-only).</p>
          </div>
          <div className="dashboard-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("Notices")}>
            <h3>Notices & Announcements</h3>
            <p>Read academic and hostel announcements.</p>
          </div>
          <div className="dashboard-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("Chat")}>
            <h3>Chat with Admin</h3>
            <p>Communicate with administration.</p>
          </div>
        </div>
        {fd?.notices?.length ? (
          <div className="dashboard-card" style={{ marginTop: 16 }}>
            <div className="table-header"><div><h3>Recent Notices</h3><p>Latest announcements</p></div></div>
            {fd.notices.map((n: any) => (
              <div key={n.id} className="notice-card" style={{ boxShadow: "none" }}>
                <div className="notice-icon"><Megaphone size={18} /></div>
                <div><h4>{n.title}</h4><p>{n.message}</p><span className="notice-date">{n.date}</span></div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  }
  if (err) return <section className="content premium-page premium-dashboard"><div className="error-state">{err}<button onClick={load}>Retry</button></div></section>;
  if (!d) return <section className="content premium-page premium-dashboard"><div className="skeleton-card"><div className="skeleton-line" style={{ width: "40%" }} /><div className="skeleton-line" style={{ width: "70%" }} /><div className="skeleton-line" style={{ width: "55%" }} /></div></section>;
  const max = Math.max(1, ...d.monthlyFees.map((m) => m.amount));
  const isAdmin = role === "Admin";
  const user = getStoredUser();
  const displayName = user?.name || (isAdmin ? "Admin" : "Student");
  const totalCollected = d.fees.paid + d.fees.pending;
  const collectRate = totalCollected > 0 ? Math.round((d.fees.paid / totalCollected) * 100) : 0;
  const resolution = d.complaints.total > 0
    ? Math.round((d.complaints.resolved / d.complaints.total) * 100)
    : 0;
  const quickActions = isAdmin
    ? [
        { label: "Students", icon: Users, page: "Students" },
        { label: "Rooms", icon: BedDouble, page: "Rooms" },
        { label: "Notices", icon: Megaphone, page: "Notices" },
        { label: "Fees", icon: CreditCard, page: "Fees" },
        { label: "Reports", icon: BarChart3, page: "Reports" },
        { label: "Complaints", icon: MessageSquareWarning, page: "Complaints" },
      ]
    : [
        { label: "My Profile", icon: UserCircle, page: "Profile" },
        { label: "Apply Leave", icon: Calendar, page: "Leave Management" },
        { label: "Maintenance", icon: Wrench, page: "Maintenance Request" },
        { label: "Mess Menu", icon: Utensils, page: "Mess" },
        { label: "Notices", icon: Megaphone, page: "Notices" },
        { label: "My Fees", icon: CreditCard, page: "Fees" },
      ];
  return (
    <section className="content premium-page premium-dashboard" style={{ background: "#F5F7FA" }}>
      <div className="page-heading admin-heading">
        <div>
          <span className="admin-eyebrow">{isAdmin ? "Admin Panel" : "Student Panel"}</span>
          <h2>{isAdmin ? "Admin Dashboard" : `Welcome, ${displayName}`}</h2>
          <p>{isAdmin ? "Live overview of your whole hostel." : "Live overview from your database."}</p>
        </div>
        {isAdmin && (
        <div className="admin-heading-badges">
          <span className="admin-pill"><BadgeCheck size={14} /> {d.students.active} active students</span>
          <span className="admin-pill warn"><Clock3 size={14} /> {d.fees.pendingCount} fees pending</span>
        </div>
        )}
      </div>
      <div className="qa-strip" role="list">
        {quickActions.map((a) => (
          <button
            type="button"
            key={a.label}
            className="qa-card"
            role="listitem"
            onClick={() => onNavigate(a.page)}
          >
            <span className="qa-icon"><a.icon size={18} /></span>
            <span className="qa-label">{a.label}</span>
            <ArrowRight size={14} className="qa-arrow" />
          </button>
        ))}
      </div>
      {!isAdmin && tasks && (
        <div className="dashboard-card sp-tasks">
          <div className="table-header">
            <div>
              <h3>Pending Tasks</h3>
              <p>
                {tasks.length === 0
                  ? "Nothing waiting on you"
                  : `${tasks.length} item${tasks.length === 1 ? "" : "s"} need attention`}
              </p>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <BadgeCheck size={26} />
              <strong>You're all caught up 🎉</strong>
              <p>No pending leave or maintenance items.</p>
            </div>
          ) : (
            <div className="sp-task-list">
              {tasks.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  className="sp-task-row"
                  onClick={() => onNavigate(t.page)}
                  title={`Open ${t.page}`}
                >
                  <span className={t.status === "Pending" ? "sp-task-dot" : "sp-task-dot sp-task-dot-active"} />
                  <span className="sp-task-text">
                    <strong>{t.title}</strong>
                    <small>{t.sub}</small>
                  </span>
                  <span
                    className={
                      t.status === "Pending"
                        ? "complaint-status complaint-pending"
                        : "complaint-status complaint-progress"
                    }
                  >
                    {t.status}
                  </span>
                  <ArrowRight size={14} className="qa-arrow" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {isAdmin && (
      <div className="stats-grid admin-stats">
        <div className="stat-card stat-tint-indigo">
          <div className="stat-icon"><Users size={22} /></div>
          <div className="stat-body"><span>Total Students</span><h3>{d.students.total}</h3><p><TrendingUp size={13} /> {d.students.active} active right now</p></div>
        </div>
        <div className="stat-card stat-tint-blue">
          <div className="stat-icon rooms"><BedDouble size={22} /></div>
          <div className="stat-body"><span>Bed Occupancy</span><h3>{d.rooms.occupancyRate}%</h3><p>{d.rooms.bedsFilled}/{d.rooms.beds} beds filled</p></div>
        </div>
        <div className="stat-card stat-tint-purple">
          <div className="stat-icon"><BedDouble size={22} /></div>
          <div className="stat-body"><span>Girls Wing</span><h3>{d.rooms.girls}</h3><p><TrendingUp size={13} /> {d.rooms.girls} of {d.rooms.total} rooms in the girls wing</p></div>
        </div>
        <div className="stat-card stat-tint-green">
          <div className="stat-icon fees"><CreditCard size={22} /></div>
          <div className="stat-body"><span>Fees Collected</span><h3>{formatINR(d.fees.paid)}</h3><p>{formatINR(d.fees.pending)} still pending</p></div>
        </div>
        <div className="stat-card stat-tint-orange">
          <div className="stat-icon complaints"><MessageSquareWarning size={22} /></div>
          <div className="stat-body"><span>Complaints</span><h3>{d.complaints.total}</h3><p>{d.complaints.pending} need attention</p></div>
        </div>
      </div>
      )}
      {isAdmin && (
        <div className="admin-strip">
          <div className="admin-strip-card">
            <span className="mini-icon mini-blue"><BedSingle size={17} /></span>
            <div><span>Rooms available</span><strong>{d.rooms.available} / {d.rooms.total}</strong></div>
            <ArrowUpRight size={16} className="strip-arrow" />
          </div>
          <div className="admin-strip-card">
            <span className="mini-icon mini-amber"><Wrench size={17} /></span>
            <div><span>Under maintenance</span><strong>{d.rooms.maintenance} rooms</strong></div>
            <ArrowUpRight size={16} className="strip-arrow" />
          </div>
          <div className="admin-strip-card">
            <span className="mini-icon mini-green"><BadgeCheck size={17} /></span>
            <div><span>Fee collection rate</span><strong>{collectRate}% collected</strong></div>
            <div className="mini-meter"><i style={{ width: `${collectRate}%` }} /></div>
          </div>
          <div className="admin-strip-card">
            <span className="mini-icon mini-purple"><CircleAlert size={17} /></span>
            <div><span>Complaint resolution</span><strong>{resolution}% resolved</strong></div>
            <div className="mini-meter purple"><i style={{ width: `${resolution}%` }} /></div>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="table-header"><div><h3>Fee Collection</h3><p>Monthly trend</p></div></div>
          {d.monthlyFees.length === 0 ? <div className="empty-state"><strong>No fee data</strong><p>Record a payment first.</p></div> : (
          <div className="fee-chart">{d.monthlyFees.map((m) => (
            <div className="chart-item" key={m.month}><span>{formatINR(m.amount)}</span>
            <div className="chart-bar-bg"><div className="chart-bar" style={{ height: `${Math.max(6, (m.amount / max) * 100)}%` }} /></div>
            <small>{m.month}</small></div>))}</div>)}
        </div>
        <div className="dashboard-card">
          <div className="table-header"><div><h3>Recent Complaints</h3><p>Latest 5</p></div></div>
          {d.recentComplaints.length === 0 ? <div className="empty-state"><strong>All clear 🎉</strong></div> : (
          <div className="table-wrapper"><table><tbody>
            {d.recentComplaints.map((c) => (<tr key={c.code}><td><strong>{c.student}</strong><br /><small>{c.subject}</small></td><td style={{ textAlign: "right" }}><span className={c.status === "Resolved" ? "complaint-status complaint-resolved" : c.status === "In Progress" ? "complaint-status complaint-progress" : "complaint-status complaint-pending"}>{c.status}</span></td></tr>))}
          </tbody></table></div>)}
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="table-header"><div><h3>Recent Payments</h3><p>Latest 5</p></div></div>
          {d.recentFees.length === 0 ? <div className="empty-state"><strong>No payments yet</strong></div> : (
          <div className="table-wrapper"><table><tbody>
            {d.recentFees.map((f) => (<tr key={f.code}><td><strong>{f.student}</strong><br /><small>{f.code}</small></td><td style={{ textAlign: "right" }}><strong>{formatINR(f.amount)}</strong><br /><small>{f.status}</small></td></tr>))}
          </tbody></table></div>)}
        </div>
        <div className="dashboard-card">
          <div className="table-header"><div><h3>Notice Board</h3><p>Latest announcements</p></div></div>
          {d.notices.length === 0 ? <div className="empty-state"><Megaphone size={26} /><strong>No notices</strong></div> :
            d.notices.slice(0, 3).map((n) => (<div key={n.id} className="notice-card" style={{ boxShadow: "none" }}><div className="notice-icon"><Megaphone size={18} /></div><div><h4>{n.title}</h4><p>{n.message}</p><span className="notice-date">{n.date}</span></div></div>))}
        </div>
      </div>
      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <div className="table-header"><div><h3>System Flowchart & ER Diagram</h3><p>Core entities and their relationships</p></div></div>
        <div style={{ overflowX: "auto", padding: 12 }}>
          <svg width="720" height="360" viewBox="0 0 720 360" style={{ maxWidth: "100%" }}>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" /></marker>
            </defs>
            {[
              { x: 40, y: 40, w: 120, h: 60, label: "Student", color: "#6366f1" },
              { x: 220, y: 40, w: 120, h: 60, label: "Room", color: "#10b981" },
              { x: 400, y: 40, w: 120, h: 60, label: "Faculty", color: "#f59e0b" },
              { x: 580, y: 40, w: 120, h: 60, label: "Warden", color: "#ef4444" },
              { x: 40, y: 200, w: 120, h: 60, label: "Fees", color: "#8b5cf6" },
              { x: 220, y: 200, w: 120, h: 60, label: "Complaint", color: "#ec4899" },
              { x: 400, y: 200, w: 120, h: 60, label: "Mess", color: "#14b8a6" },
              { x: 580, y: 200, w: 120, h: 60, label: "Notice", color: "#0ea5e9" },
            ].map((n) => (
              <g key={n.label}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" fill={n.color} opacity="0.15" stroke={n.color} strokeWidth="2" />
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="600" fill={n.color}>{n.label}</text>
              </g>
            ))}
            {[
              [100, 100, 280, 70],
              [160, 70, 400, 70],
              [340, 70, 580, 70],
              [100, 100, 100, 200],
              [280, 100, 280, 200],
              [460, 100, 460, 200],
              [640, 100, 640, 200],
            ].map((l, i) => (
              <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#6366f1" strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.6" />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
export default Dashboard;

