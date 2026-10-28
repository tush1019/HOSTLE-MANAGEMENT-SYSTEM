import ServiceList from "../components/ServiceList";

function StudyRoomPage({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Study Room" role={role} />;
}

export default StudyRoomPage;

