import ServiceList from "../components/ServiceList";

function EntryExitRules({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Entry & Exit Rules" role={role} />;
}

export default EntryExitRules;

