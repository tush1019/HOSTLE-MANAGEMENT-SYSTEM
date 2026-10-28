import ServiceList from "../components/ServiceList";

function MedicalFacilities({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Medical Facilities" role={role} />;
}

export default MedicalFacilities;

