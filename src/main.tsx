import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadOfflineCache } from "./hooks/useInterventionsCache";

// Clear cache automatically for Lovable preview sessions
function clearPreviewCache() {
  const isPreview = window.location.hostname.includes('preview--') || 
                    window.location.hostname.includes('lovable.app');
  
  if (isPreview) {
    const sessionKey = 'lovable_preview_session';
    const currentSession = sessionStorage.getItem(sessionKey);
    
    // If no session marker exists, this is a new preview session - clear old data
    if (!currentSession) {
      console.log('[Preview] New session detected - clearing cached data');
      
      // Clear authentication data
      localStorage.removeItem('mv3_token');
      localStorage.removeItem('mv3_worker');
      localStorage.removeItem('worker');
      
      // Clear intervention cache
      localStorage.removeItem('interventions_cache');
      localStorage.removeItem('interventions_cache_timestamp');
      
      // Mark this session
      sessionStorage.setItem(sessionKey, Date.now().toString());
    }
  }
}

// Run cache cleanup before anything else
clearPreviewCache();

// Preload offline cache immediately
preloadOfflineCache();

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
