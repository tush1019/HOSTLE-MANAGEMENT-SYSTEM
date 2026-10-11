import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import "./theme.css";
import "./theme-dark.css";
import "./theme-components.css";
import "./theme-effects.css";
import "./theme-layout.css";
import "./theme-polish.css";
import "./theme-admin.css";
import "./theme-extreme.css";
import { ToastProvider } from "./components/Toast";

/* Apply saved theme before first paint */
const savedTheme = localStorage.getItem("hostelTheme");
if (savedTheme === "dark") {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
