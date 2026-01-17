// Push Notification Service for ENES Électricité PWA

const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'; // À configurer

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Register service worker for push
export async function registerPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
    // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    // Send subscription to server
    await sendSubscriptionToServer(subscription);
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscriptionFromServer(subscription);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

// Show local notification
export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!isPushSupported()) return;
  
  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: false,
    });
    // Trigger vibration separately
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (error) {
    // Fallback to basic notification
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
    });
  }
}

// Notification presets for ENES Électricité
export const notifications = {
  newIntervention: (ref: string, client: string) => showLocalNotification({
    title: '📋 Nouvelle intervention',
    body: `${ref} - ${client}`,
    tag: 'new-intervention',
    data: { type: 'intervention', ref },
  }),

  urgentIntervention: (ref: string, location: string) => showLocalNotification({
    title: '🚨 Intervention URGENTE',
    body: `${ref} à ${location}`,
    tag: 'urgent-intervention',
    data: { type: 'urgent', ref },
  }),

  reminderStart: (ref: string, time: string) => showLocalNotification({
    title: '⏰ Rappel intervention',
    body: `${ref} prévu à ${time}`,
    tag: 'reminder',
    data: { type: 'reminder', ref },
  }),

  syncComplete: (count: number) => showLocalNotification({
    title: '✅ Synchronisation terminée',
    body: `${count} modification(s) synchronisée(s)`,
    tag: 'sync',
  }),

  lowStock: (product: string, qty: number) => showLocalNotification({
    title: '⚠️ Stock bas',
    body: `${product}: ${qty} restant(s)`,
    tag: 'low-stock',
    data: { type: 'stock', product },
  }),

  oibtReminder: (location: string, date: string) => showLocalNotification({
    title: '📅 Contrôle OIBT à venir',
    body: `${location} - ${date}`,
    tag: 'oibt-reminder',
  }),
};

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  // TODO: Send to Dolibarr API when implemented
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh,
      auth: subscription.toJSON().keys?.auth,
    },
  };
  
  // Store locally for now
  localStorage.setItem('push_subscription', JSON.stringify(subscriptionData));
  console.log('Push subscription stored:', subscriptionData);
}

async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  localStorage.removeItem('push_subscription');
  console.log('Push subscription removed');
}

// Schedule local notification
export function scheduleNotification(payload: NotificationPayload, delayMs: number): number {
  return window.setTimeout(() => {
    showLocalNotification(payload);
  }, delayMs);
}

// Cancel scheduled notification
export function cancelScheduledNotification(timerId: number): void {
  window.clearTimeout(timerId);
}
