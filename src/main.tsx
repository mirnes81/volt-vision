// Main entry point - v11.0.0 - Force complete cache bust
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from "./App.tsx";
import "./index.css";
import { preloadOfflineCache } from "./hooks/useInterventionsCache";

// Force clear ALL caches immediately on every load
(async function forceClearCaches() {
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
  }
  
  // Clear browser caches
  if ('caches' in window) {
    const names = await caches.keys();
    for (const name of names) {
      await caches.delete(name);
    }
  }
})();

// Preload offline cache
preloadOfflineCache();

// Render app
const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
