import ServiceList from "../components/ServiceList";

function LaundryServices({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Laundry Services" role={role} />;
}

export default LaundryServices;

