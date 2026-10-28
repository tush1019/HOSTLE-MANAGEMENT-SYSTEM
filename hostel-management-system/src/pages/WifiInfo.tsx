import ServiceList from "../components/ServiceList";

function WifiInfo({ role }: { role?: "Admin" | "Student" | null }) {
  return <ServiceList category="WiFi Information" role={role} />;
}

export default WifiInfo;

