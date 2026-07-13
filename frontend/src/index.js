import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Schriftgröße aus localStorage anwenden (Ralph 26.05.2026)
try {
  const size = localStorage.getItem("ui_font_size_px");
  if (size) document.documentElement.style.fontSize = `${parseInt(size, 10)}px`;
} catch { /* ignore */ }

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />,
);

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
