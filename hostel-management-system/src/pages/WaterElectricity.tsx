import ServiceList from "../components/ServiceList";

function WaterElectricity({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="Water & Electricity" role={role} />;
}

export default WaterElectricity;

