import React from "react";
import { createRoot } from "react-dom/client";
import App from "../wasi_agent.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
