// Main entry point - v13.0.0 - Cache bust fix
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from "./App.tsx";
import "./index.css";
import { preloadOfflineCache } from "./hooks/useInterventionsCache";
import { registerSW } from 'virtual:pwa-register';

// Version pour le cache - changer cette valeur force une mise à jour
const APP_VERSION = 'enes-v13';
const VERSION_KEY = 'enes_app_version';

// Vérifier si c'est une nouvelle version
const storedVersion = localStorage.getItem(VERSION_KEY);
const isNewVersion = storedVersion !== APP_VERSION;

if (isNewVersion) {
  console.log(`[ENES] Nouvelle version détectée: ${storedVersion} → ${APP_VERSION}`);
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  
  // Nettoyer les anciennes données de cache (pas les auth)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('interventions_') || key?.includes('cache')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Register PWA service worker avec auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Nouvelle version disponible - rafraîchir automatiquement
    console.log('[PWA] Nouvelle version disponible, mise à jour...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Application prête pour utilisation hors-ligne');
  },
  onRegisteredSW(swUrl, r) {
    console.log('[PWA] Service Worker enregistré:', swUrl);
    // Vérifier les mises à jour toutes les 5 minutes
    if (r) {
      setInterval(() => {
        r.update();
      }, 5 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Erreur d\'enregistrement du SW:', error);
  }
});

// Preload offline cache après enregistrement du SW
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
