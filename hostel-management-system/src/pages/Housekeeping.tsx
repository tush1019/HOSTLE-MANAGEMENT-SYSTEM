import ServiceList from "../components/ServiceList";

function Housekeeping({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Housekeeping" role={role} />;
}

export default Housekeeping;

