// PWA utilities for managing updates and installation

/**
 * Force clear all caches and reload the app
 */
export async function forceUpdateApp() {
  console.log('[PWA] Forcing app update...');
  
  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[PWA] Unregistered service worker');
    }
  }

  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
      console.log('[PWA] Deleted cache:', cacheName);
    }
  }

  // Clear localStorage except auth
  const authData = localStorage.getItem('mv3_auth');
  const workerData = localStorage.getItem('mv3_worker');
  localStorage.clear();
  if (authData) localStorage.setItem('mv3_auth', authData);
  if (workerData) localStorage.setItem('mv3_worker', workerData);

  // Reload the page
  window.location.reload();
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return !!registration.waiting;
  } catch (error) {
    console.error('[PWA] Error checking for updates:', error);
    return false;
  }
}

/**
 * Register for automatic updates when new service worker is available
 */
export function onServiceWorkerUpdate(callback: () => void) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New version available');
          callback();
        }
      });
    });
  });
}

/**
 * Check if app is running as installed PWA
 */
export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

/**
 * Get install prompt event (for custom install button)
 */
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}
