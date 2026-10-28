import { useCallback, useEffect, useState } from "react";
import { getStoredUser } from "./lib/api";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/students";
import Staff from "./pages/Staff";
import Chat from "./pages/Chat";

import Rooms from "./pages/Room";
import Fees from "./pages/Fees";
import Complaints from "./pages/Complaints";
import Mess from "./pages/Mess";
import Notices from "./pages/Notices";
import Reports from "./pages/Reports";
import Facilities from "./pages/Facilities";
import Attendance from "./pages/Attendance";
import Assignments from "./pages/Assignments";
import Timetable from "./pages/Timetable";
import FacultyReports from "./pages/FacultyReports";
import FacultyRooms from "./pages/FacultyRooms";
import Settings from "./pages/Settings";
import EmergencyContacts from "./pages/EmergencyContacts";
import MedicalFacilities from "./pages/MedicalFacilities";
import WifiInfo from "./pages/WifiInfo";
import LaundryServices from "./pages/LaundryServices";
import StudyRoom from "./pages/StudyRoom";
import WaterElectricity from "./pages/WaterElectricity";
import Housekeeping from "./pages/Housekeeping";
import EntryExitRules from "./pages/EntryExitRules";
import MaintenanceRequest from "./pages/MaintenanceRequest";
import LeaveManagement from "./pages/LeaveManagement";
import MessPhotos from "./pages/MessPhotos";
import GymPhotos from "./pages/GymPhotos";
import RoomIssuePhotos from "./pages/RoomIssuePhotos";
import StudentProfile from "./pages/StudentProfile";

type Role = "Admin" | "Student" | "Faculty" | null;
type PublicPage = "Home" | "Login" | "Signup";

const ADMIN_ONLY_ROUTES = new Set([
  "Students", "Staff", "Rooms", "Fees", "Reports", "Settings", "Campus Gallery", "Faculty Rooms",
  "Leave Management", "Maintenance Request", "Mess", "Housekeeping",
  "Water & Electricity", "Notices", "Medical Facilities", "Study Room",
]);
const STUDENT_ROUTES = new Set([
  "Dashboard", "Profile", "Rooms", "Water & Electricity", "Housekeeping",
  "Mess", "Complaints", "Leave Management", "Maintenance Request",
  "Study Room", "Gym Photos", "Facilities", "Entry & Exit Rules",
  "Medical Facilities", "WiFi Information", "Notices", "Laundry Services",
  "Mess Photos", "Room Issue Photos", "Settings", "Chat",
]);
function isAdminRoute(page: string): boolean { return ADMIN_ONLY_ROUTES.has(page); }
function isStudentRoute(page: string): boolean { return STUDENT_ROUTES.has(page); }

function App() {
  const storedRole = localStorage.getItem("hostelRole");

  const [role, setRole] = useState<Role>(
    storedRole === "Admin" || storedRole === "Student" || storedRole === "Faculty" ? storedRole : null
  );

  const [publicPage, setPublicPage] = useState<PublicPage>("Home");
  const [activePage, setActivePage] = useState("Dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hostelRole");
    setRole(stored === "Admin" || stored === "Student" || stored === "Faculty" ? stored : null);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("hostelRole");
      setRole(stored === "Admin" || stored === "Student" || stored === "Faculty" ? stored : null);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
        document.body.classList.remove("sidebar-open");
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [drawerOpen]);

  const handleSearch = useCallback((q: string) => setGlobalSearch(q), []);

  const goPage = useCallback(
    (page: string) => {
      if (role !== "Admin" && isAdminRoute(page) && !isStudentRoute(page) && !(role === "Faculty" && page === "Students")) {
        return;
      }
      setGlobalSearch("");
      setActivePage(page);
      setDrawerOpen(false);
      document.body.classList.remove("sidebar-open");
    },
    [role]
  );

  const handleLogin = (loginRole: "Admin" | "Student" | "Faculty") => {
    localStorage.setItem("hostelRole", loginRole);
    localStorage.setItem("hostelUser", JSON.stringify(getStoredUser()));
    setRole(loginRole);
    setActivePage("Dashboard");
    setPublicPage("Home");
  };

  const handleLogout = () => {
    localStorage.removeItem("hostelRole");
    localStorage.removeItem("hostelUser");
    setRole(null);
    setActivePage("Dashboard");
    setPublicPage("Home");
    setDrawerOpen(false);
    document.body.classList.remove("sidebar-open");
  };

  if (!role && publicPage === "Home") {
    return <Home onLogin={() => setPublicPage("Login")} onSignup={() => setPublicPage("Signup")} />;
  }

  if (!role && publicPage === "Login") {
    return (
      <Login
        onLogin={handleLogin}
        onSignup={() => setPublicPage("Signup")}
        onHome={() => setPublicPage("Home")}
      />
    );
  }

  if (!role && publicPage === "Signup") {
    return (
      <Signup
        onSignup={() => setPublicPage("Login")}
        onLogin={() => setPublicPage("Login")}
        onBackHome={() => setPublicPage("Home")}
      />
    );
  }

  return (
    <div className={role === "Student" ? "app student-mode" : "app"}>
      <button
        type="button"
        className="sidebar-overlay"
        aria-label="Close menu"
        onClick={() => {
          document.body.classList.remove("sidebar-open");
          setDrawerOpen(false);
        }}
      />
      <Sidebar
        activePage={activePage}
        setActivePage={goPage}
        onLogout={handleLogout}
        role={role as any}
      />
      <main className="main-content">
        <Navbar activePage={activePage} onSearch={handleSearch} onNavigate={goPage} />
        {activePage === "Dashboard" && <Dashboard role={role! as any} onNavigate={goPage} />}
        {activePage === "Profile" && <StudentProfile />}
        {activePage === "Students" && <Students search={globalSearch} role={role as any} />}
{activePage === "Staff" && <Staff search={globalSearch} role={role as any} />}
{activePage === "Chat" && <Chat />}
        {activePage === "Rooms" && <Rooms search={globalSearch} role={role as any} />}
        {activePage === "Fees" && <Fees search={globalSearch} role={role as any} />}
        {activePage === "Complaints" && <Complaints search={globalSearch} role={role as any} />}
        {activePage === "Mess" && <Mess search={globalSearch} role={role as any} />}
        {activePage === "Notices" && <Notices role={role as any} />}
        {activePage === "Facilities" && <Facilities role={role as any} />}
{activePage === "Attendance" && <Attendance />}
{activePage === "Assignments" && <Assignments />}
{activePage === "Timetable" && <Timetable />}
{activePage === "Faculty Reports" && <FacultyReports />}
{activePage === "Faculty Rooms" && <FacultyRooms />}
        {activePage === "Reports" && <Reports />}
        {activePage === "Settings" && <Settings />}
        {activePage === "Emergency Contacts" && <EmergencyContacts role={role as any} />}
        {activePage === "Medical Facilities" && <MedicalFacilities role={role as any} />}
        {activePage === "WiFi Information" && <WifiInfo role={role as any} />}
        {activePage === "Laundry Services" && <LaundryServices role={role as any} />}
        {activePage === "Study Room" && <StudyRoom role={role as any} />}
        {activePage === "Water & Electricity" && <WaterElectricity role={role as any} />}
        {activePage === "Housekeeping" && <Housekeeping role={role as any} />}
        {activePage === "Entry & Exit Rules" && <EntryExitRules role={role as any} />}
        {activePage === "Maintenance Request" && <MaintenanceRequest role={role! as any} />}
        {activePage === "Leave Management" && <LeaveManagement role={role! as any} />}
        {activePage === "Mess Photos" && <MessPhotos role={role! as any} />}
        {activePage === "Gym Photos" && <GymPhotos role={role as any} />}
        {activePage === "Room Issue Photos" && <RoomIssuePhotos />}
      </main>
    </div>
  );
}

export default App;
