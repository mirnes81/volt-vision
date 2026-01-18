// Main entry point - v5.0.0 ENES Électricité - Force complete rebuild
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadOfflineCache } from "./hooks/useInterventionsCache";

// AGGRESSIVE cache clearing for all sessions to remove old demo data
async function clearAllCaches() {
  console.log('[ENES] Clearing all caches and old data...');
  
  // Clear all localStorage demo data
  const keysToRemove = [
    'mv3_token', 'mv3_worker', 'worker',
    'interventions_cache', 'interventions_cache_timestamp',
    'interventions_cache_all', 'interventions_cache_mine',
    'interventions_cache_all_meta', 'interventions_cache_mine_meta',
    'dolibarr_config', 'hours_settings', 'reminder_settings'
  ];
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Unregister old service workers and clear caches
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('[ENES] Unregistering old SW:', registration.scope);
        await registration.unregister();
      }
    } catch (e) {
      console.warn('[ENES] Could not unregister SW:', e);
    }
  }
  
  // Clear all browser caches
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        console.log('[ENES] Deleting cache:', name);
        await caches.delete(name);
      }
    } catch (e) {
      console.warn('[ENES] Could not clear caches:', e);
    }
  }
  
  // Clear IndexedDB
  if ('indexedDB' in window) {
    try {
      const databases = await indexedDB.databases?.() || [];
      for (const db of databases) {
        if (db.name) {
          console.log('[ENES] Deleting IndexedDB:', db.name);
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      console.warn('[ENES] Could not clear IndexedDB:', e);
    }
  }
  
  console.log('[ENES] All caches cleared!');
}

// Check if this is a fresh start that needs cache clearing
const CACHE_VERSION = 'enes-v5';
const lastVersion = localStorage.getItem('app_cache_version');

if (lastVersion !== CACHE_VERSION) {
  // Version changed or first run - clear everything
  clearAllCaches().then(() => {
    localStorage.setItem('app_cache_version', CACHE_VERSION);
    // Reload to get fresh content
    if (lastVersion) {
      window.location.reload();
    }
  });
} else {
  // Normal start - preload offline cache
  preloadOfflineCache();
}

// Register new service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[ENES] SW registered:', registration.scope);
        // Force update check
        registration.update();
      })
      .catch((error) => {
        console.log('[ENES] SW registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
