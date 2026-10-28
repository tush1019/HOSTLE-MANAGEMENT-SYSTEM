import ServiceList from "../components/ServiceList";

function EmergencyContacts({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Emergency Contact" role={role} />;
}

export default EmergencyContacts;

