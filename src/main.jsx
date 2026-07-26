import React from "react";
import ReactDOM from "react-dom/client";
import "./storage.js";          // must come before App — installs window.storage
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
