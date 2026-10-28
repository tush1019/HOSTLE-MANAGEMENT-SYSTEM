import {
  LayoutDashboard, Users, BedDouble, CreditCard,
  MessageSquareWarning, Utensils, BarChart3, Bell,
  Settings, LogOut, Building2,
  ShieldAlert, Phone, Wifi, Droplets, Zap, MapPin,
  Wrench, Calendar, Image, Dumbbell, LayoutList, UserCircle,
  X, MessageCircle,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

type DrawerItem = {
  route: string;
  label: string;
  icon: React.ElementType;
  roles: ("Admin" | "Student" | "Faculty")[];
  group: string;
};

const GROUP_LABELS: Record<string, string> = {
  overview: "Overview",
  profile: "Profile",
  accommodation: "Accommodation",
  dining: "Dining",
  requests: "Requests",
  facilities: "Facilities",
  safety: "Safety & Rules",
  communication: "Communication",
  records: "Student Records",
  finance: "Fee Management",
  reports: "Reports & Analytics",
  settings: "Settings",
  account: "Account",
};

const STUDENT_ITEMS: DrawerItem[] = [
  { route: "Dashboard", label: "Overview", icon: LayoutDashboard, roles: ["Student"], group: "overview" },
  { route: "Profile", label: "My Profile", icon: UserCircle, roles: ["Student"], group: "profile" },
  { route: "Rooms", label: "My Room", icon: BedDouble, roles: ["Student"], group: "accommodation" },
  { route: "Water & Electricity", label: "Water & Electricity", icon: Zap, roles: ["Student"], group: "accommodation" },
  { route: "Housekeeping", label: "Housekeeping", icon: MapPin, roles: ["Student"], group: "accommodation" },
  { route: "Mess", label: "Mess & Food Quality", icon: Utensils, roles: ["Student"], group: "dining" },
  { route: "Complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["Student"], group: "requests" },
  { route: "Leave Management", label: "Leave Applications", icon: Calendar, roles: ["Student"], group: "requests" },
  { route: "Maintenance Request", label: "Maintenance Requests", icon: Wrench, roles: ["Student"], group: "requests" },
  { route: "Study Room", label: "Study Room", icon: LayoutList, roles: ["Student"], group: "facilities" },
  { route: "Gym Photos", label: "Gym & Recreation", icon: Dumbbell, roles: ["Student"], group: "facilities" },
  { route: "Facilities", label: "Campus Facilities", icon: Building2, roles: ["Student"], group: "facilities" },
  { route: "Entry & Exit Rules", label: "Hostel Rules", icon: ShieldAlert, roles: ["Student"], group: "safety" },
  { route: "Medical Facilities", label: "Medical & Emergency", icon: Phone, roles: ["Student"], group: "safety" },
  { route: "WiFi Information", label: "Wi-Fi Information", icon: Wifi, roles: ["Student"], group: "communication" },
  { route: "Notices", label: "Notifications", icon: Bell, roles: ["Student"], group: "communication" },
  { route: "Laundry Services", label: "Laundry Services", icon: Droplets, roles: ["Student"], group: "communication" },
  { route: "Mess Photos", label: "Mess Photos", icon: Utensils, roles: ["Student"], group: "communication" },
  { route: "Room Issue Photos", label: "Room Issue Photos", icon: Image, roles: ["Student"], group: "communication" },
  { route: "Chat", label: "Chat with Admin", icon: MessageCircle, roles: ["Student"], group: "communication" },
  { route: "Settings", label: "Settings", icon: Settings, roles: ["Student"], group: "settings" },
];

const ADMIN_ITEMS: DrawerItem[] = [
  { route: "Dashboard", label: "Admin Overview", icon: LayoutDashboard, roles: ["Admin"], group: "overview" },
  { route: "Students", label: "Student Management", icon: Users, roles: ["Admin"], group: "records" },
  { route: "Staff", label: "Staff Management", icon: Users, roles: ["Admin"], group: "records" },
  { route: "Rooms", label: "Room Management", icon: BedDouble, roles: ["Admin"], group: "accommodation" },
  { route: "Fees", label: "Fee Management", icon: CreditCard, roles: ["Admin"], group: "finance" },
  { route: "Leave Management", label: "Leave Approvals", icon: Calendar, roles: ["Admin"], group: "requests" },
  { route: "Maintenance Request", label: "Maintenance Management", icon: Wrench, roles: ["Admin"], group: "requests" },
  { route: "Mess", label: "Mess Management", icon: Utensils, roles: ["Admin"], group: "dining" },
  { route: "Housekeeping", label: "Housekeeping", icon: MapPin, roles: ["Admin"], group: "accommodation" },
  { route: "Water & Electricity", label: "Water & Electricity", icon: Zap, roles: ["Admin"], group: "accommodation" },
  { route: "Study Room", label: "Study Room Management", icon: LayoutList, roles: ["Admin"], group: "facilities" },
  { route: "Facilities", label: "Facilities Management", icon: Building2, roles: ["Admin"], group: "facilities" },
  { route: "Gym Photos", label: "Gym & Facilities", icon: Dumbbell, roles: ["Admin"], group: "facilities" },
  { route: "Notices", label: "Notices & Announcements", icon: Bell, roles: ["Admin"], group: "communication" },
  { route: "Chat", label: "Student Chat", icon: MessageCircle, roles: ["Admin"], group: "communication" },
  { route: "Medical Facilities", label: "Medical & Emergency Contacts", icon: Phone, roles: ["Admin"], group: "safety" },
  { route: "Reports", label: "Reports & Analytics", icon: BarChart3, roles: ["Admin"], group: "reports" },
  { route: "Settings", label: "Settings", icon: Settings, roles: ["Admin"], group: "settings" },
];

const FACULTY_ITEMS: DrawerItem[] = [
  { route: "Dashboard", label: "Faculty Overview", icon: LayoutDashboard, roles: ["Faculty"], group: "overview" },
  { route: "Students", label: "Student Directory", icon: Users, roles: ["Faculty"], group: "records" },
  { route: "Rooms", label: "Room Management", icon: BedDouble, roles: ["Faculty"], group: "accommodation" },
  { route: "Faculty Rooms", label: "Faculty Rooms", icon: BedDouble, roles: ["Faculty"], group: "accommodation" },
  { route: "Water & Electricity", label: "Water & Electricity", icon: Zap, roles: ["Faculty"], group: "accommodation" },
  { route: "Housekeeping", label: "Housekeeping", icon: MapPin, roles: ["Faculty"], group: "accommodation" },
  { route: "Mess", label: "Mess & Food Quality", icon: Utensils, roles: ["Faculty"], group: "dining" },
  { route: "Complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["Faculty"], group: "requests" },
  { route: "Maintenance Request", label: "Maintenance Requests", icon: Wrench, roles: ["Faculty"], group: "requests" },
  { route: "Leave Management", label: "Leave Applications", icon: Calendar, roles: ["Faculty"], group: "requests" },
  { route: "Study Room", label: "Study Room", icon: LayoutList, roles: ["Faculty"], group: "facilities" },
  { route: "Gym Photos", label: "Gym & Recreation", icon: Dumbbell, roles: ["Faculty"], group: "facilities" },
  { route: "Facilities", label: "Campus Facilities", icon: Building2, roles: ["Faculty"], group: "facilities" },
  { route: "Entry & Exit Rules", label: "Hostel Rules", icon: ShieldAlert, roles: ["Faculty"], group: "safety" },
  { route: "Medical Facilities", label: "Medical & Emergency", icon: Phone, roles: ["Faculty"], group: "safety" },
  { route: "WiFi Information", label: "Wi-Fi Information", icon: Wifi, roles: ["Faculty"], group: "communication" },
  { route: "Laundry Services", label: "Laundry Services", icon: Droplets, roles: ["Faculty"], group: "communication" },
  { route: "Mess Photos", label: "Mess Photos", icon: Utensils, roles: ["Faculty"], group: "communication" },
  { route: "Room Issue Photos", label: "Room Issue Photos", icon: Image, roles: ["Faculty"], group: "communication" },
  { route: "Notices", label: "Notices & Announcements", icon: Bell, roles: ["Faculty"], group: "communication" },
  { route: "Chat", label: "Chat with Admin", icon: MessageCircle, roles: ["Faculty"], group: "communication" },
  { route: "Settings", label: "Settings", icon: Settings, roles: ["Faculty"], group: "settings" },
];

type SidebarProps = {
  activePage: string;
  setActivePage: (page: string) => void;
  onLogout: () => void;
  role: "Admin" | "Student" | "Faculty" | null;
};

function Sidebar({ activePage, setActivePage, onLogout, role }: SidebarProps) {
  const allItems = role === "Admin" ? ADMIN_ITEMS : role === "Faculty" ? FACULTY_ITEMS : STUDENT_ITEMS;
  const menuItems = allItems.filter((i) => i.roles.includes(role));

  const logout = () => {
    // End the server session (stateless: client discards local session),
    // then clear local session and return to the public home page.
    fetch(`${API_BASE_URL}/auth/logout`, { method: "POST" }).catch(() => {});
    localStorage.removeItem("hostelRole");
    localStorage.removeItem("hostelUser");
    localStorage.removeItem("hostelToken");
    document.body.classList.remove("sidebar-open");
    onLogout();
  };

  const go = (page: string, item: DrawerItem) => {
    /* Role-based route guard: block students from admin-only routes. */
    if (role !== "Admin" && item.roles.includes("Admin")) {
      return;
    }
    setActivePage(page);
    document.body.classList.remove("sidebar-open");
  };

  return (
    <aside className="sidebar" aria-label="Navigation">
      <div className="sidebar-header">
        <span className="sidebar-logo-icon">
          <Building2 size={22} />
        </span>
        <div className="sidebar-brand">
          <h2>HostelHub</h2>
          <span>{role === "Student" ? "Student Panel" : role === "Faculty" ? "Faculty Panel" : "Admin Panel"}</span>
        </div>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation menu"
          onClick={() => document.body.classList.remove("sidebar-open")}
        >
          <X size={20} />
        </button>
      </div>
      <nav>
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const showSeparator = index > 0 && menuItems[index - 1].group !== item.group;
          return (
            <>
              {showSeparator && (
                <div key={`sep-${item.route}`} className="sidebar-section">
                  {GROUP_LABELS[item.group] || item.group}
                </div>
              )}
              <button
                key={item.route}
                type="button"
                className={`sidebar-menu ${activePage === item.route ? "active" : ""}`}
                onClick={() => go(item.route, item)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            </>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button type="button" className="logout-btn" onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
