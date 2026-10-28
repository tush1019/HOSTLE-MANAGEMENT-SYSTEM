import { useCallback, useEffect } from "react";
import { Building2, X, UserCircle, ChevronRight } from "lucide-react";
import { getStoredUser } from "../lib/api";

type Section = {
  label: string;
  items: Array<{
    name: string;
    icon: React.ElementType;
    route: string;
    roles: ("Admin" | "Student" | "Faculty")[];
  }>;
};

type MobileNavProps = {
  role: "Admin" | "Student" | "Faculty" | null;
  activePage: string;
  setActivePage: (page: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
};

function MobileNav({ role, activePage, setActivePage, onLogout, isOpen, onClose, onOpen }: MobileNavProps) {
  const user = getStoredUser();

  /* Sync drawer state from parent prop - no local state needed */
  const drawerOpen = isOpen;

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [isOpen, onClose]);
  const handleLogout = useCallback(() => {
    onClose();
    onLogout();
  }, [onLogout, onClose]);

  const go = useCallback(
    (route: string) => {
      setActivePage(route);
      onClose();
    },
    [onClose, setActivePage]
  );

  const ADMIN_SECTIONS: Section[] = [
    {
      label: "Dashboard & Overview",
      items: [{ name: "Dashboard", icon: Building2, route: "Dashboard", roles: ["Admin"] }],
    },
    {
      label: "Hostel Management",
      items: [
        { name: "Student Management", icon: UserCircle, route: "Students", roles: ["Admin"] },
        { name: "Room Management", icon: Building2, route: "Rooms", roles: ["Admin"] },
        { name: "Fee Management", icon: Building2, route: "Fees", roles: ["Admin"] },
        { name: "Study Room Management", icon: Building2, route: "Study Room", roles: ["Admin"] },
        { name: "Gym & Facilities", icon: Building2, route: "Facilities", roles: ["Admin"] },
      ],
    },
    {
      label: "Operations",
      items: [
        { name: "Leave Approvals", icon: UserCircle, route: "Leave Management", roles: ["Admin"] },
        { name: "Maintenance Management", icon: Building2, route: "Maintenance Request", roles: ["Admin"] },
        { name: "Mess Management", icon: Building2, route: "Mess", roles: ["Admin"] },
        { name: "Housekeeping", icon: Building2, route: "Housekeeping", roles: ["Admin"] },
        { name: "Water & Electricity", icon: Building2, route: "Water & Electricity", roles: ["Admin"] },
      ],
    },
    {
      label: "Communications",
      items: [
        { name: "Notices & Announcements", icon: UserCircle, route: "Notices", roles: ["Admin"] },
        { name: "Reports & Analytics", icon: Building2, route: "Reports", roles: ["Admin"] },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Medical & Emergency Contacts", icon: UserCircle, route: "Medical Facilities", roles: ["Admin"] },
        { name: "Notifications", icon: Building2, route: "Notifications", roles: ["Admin"] },
        { name: "Settings", icon: Building2, route: "Settings", roles: ["Admin"] },
      ],
    },
  ];

  const STUDENT_SECTIONS: Section[] = [
    {
      label: "Overview",
      items: [{ name: "Dashboard", icon: Building2, route: "Dashboard", roles: ["Student"] }],
    },
    {
      label: "My Account",
      items: [
        { name: "My Profile", icon: UserCircle, route: "Profile", roles: ["Student"] },
        { name: "My Room", icon: Building2, route: "Rooms", roles: ["Student"] },
      ],
    },
    {
      label: "Hostel Services",
      items: [
        { name: "Mess & Food Quality", icon: Building2, route: "Mess", roles: ["Student"] },
        { name: "Leave Applications", icon: UserCircle, route: "Leave Management", roles: ["Student"] },
        { name: "Maintenance Requests", icon: Building2, route: "Maintenance Request", roles: ["Student"] },
        { name: "Water & Electricity", icon: Building2, route: "Water & Electricity", roles: ["Student"] },
        { name: "Housekeeping", icon: Building2, route: "Housekeeping", roles: ["Student"] },
        { name: "Study Room", icon: Building2, route: "Study Room", roles: ["Student"] },
        { name: "Gym & Recreation", icon: Building2, route: "Facilities", roles: ["Student"] },
      ],
    },
    {
      label: "Support & Info",
      items: [
        { name: "Hostel Rules", icon: UserCircle, route: "Entry & Exit Rules", roles: ["Student"] },
        { name: "Medical & Emergency", icon: Building2, route: "Medical Facilities", roles: ["Student"] },
        { name: "Notifications", icon: Building2, route: "Notices", roles: ["Student"] },
        { name: "Help & Support", icon: Building2, route: "Complaints", roles: ["Student"] },
        { name: "Settings", icon: Building2, route: "Settings", roles: ["Student"] },
      ],
    },
  ];

  // sections computed on demand in render
  const sections = role === "Admin" ? ADMIN_SECTIONS : STUDENT_SECTIONS;


  return (
    <>
      <button type="button" className="st-button" aria-label="Open navigation menu" onClick={() => onOpen()}>
        ST
      </button>
      {drawerOpen && (
        <div className="mobile-nav-overlay" onClick={onClose} aria-hidden="true" style={{ zIndex: 1040, pointerEvents: "auto" }}>
          <nav className="mobile-nav-drawer" style={{ zIndex: 1050 }}>
            <div className="mobile-nav-header">
              <div className="mobile-nav-brand">
                <div className="mobile-nav-icon"><Building2 size={24} /></div>
                <div>
                  <strong>HostelHub</strong>
                  <div className="mobile-nav-subtitle">{role === "Student" ? "Student Panel" : role === "Faculty" ? "Faculty Panel" : "Admin Panel"}</div>
                </div>
              </div>
              <button type="button" className="mobile-nav-close" aria-label="Close menu" onClick={onClose}><X size={22} /></button>
            </div>
            {user && (
              <div className="mobile-nav-user">
                <div className="mobile-nav-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="mobile-nav-user-name">{user.name}</div>
                  <div className="mobile-nav-user-role">{user.role}</div>
                </div>
              </div>
            )}
            <div className="mobile-nav-sections">
              {sections.map((section, si) => (
                <div key={si} className="mobile-nav-section-group">
                  <h3 className="mobile-nav-section-label">{section.label}</h3>
                  <ul className="mobile-nav-section-list">
                    {section.items
                      .filter((i) => !role || i.roles.includes(role))
                      .map((item) => {
                        const Icon = item.icon;
                        const active = activePage === item.name;
                        return (
                          <li key={item.name}>
                            <button type="button" className={`mobile-nav-item ${active ? "active" : ""}`} onClick={() => go(item.route)} aria-current={active ? "page" : undefined}>
                              <Icon size={18} />
                              <span className="mobile-nav-item-label">{item.name}</span>
                              <ChevronRight size={14} />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mobile-nav-logout" onClick={handleLogout}>
              <UserCircle size={20} />
              <span>Logout</span>
              <ChevronRight size={16} />
            </div>
          </nav>
        </div>
      )}
    </>
  );

}
export default MobileNav;



