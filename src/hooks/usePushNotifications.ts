import * as React from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerPushSubscription,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = React.useState(() => isPushSupported());
  const [permission, setPermission] = React.useState<NotificationPermission>(() => getNotificationPermission());
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Check subscription status on mount
  React.useEffect(() => {
    if (!isSupported) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (e) {
        console.error('Error checking subscription:', e);
      }
    };

    checkSubscription();
  }, [isSupported]);

  // Listen for permission changes
  React.useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      setPermission(getNotificationPermission());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported]);

  const requestPermission = React.useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Notifications non supportées sur cet appareil');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      return result === 'granted';
    } catch (e) {
      setError('Erreur lors de la demande de permission');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const subscribe = React.useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Notifications non supportées');
      return false;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await registerPushSubscription();
      if (subscription) {
        setIsSubscribed(true);
        return true;
      }
      setError('Impossible de s\'abonner aux notifications');
      return false;
    } catch (e) {
      setError('Erreur lors de l\'abonnement');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, requestPermission]);

  const unsubscribe = React.useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (e) {
      setError('Erreur lors de la désinscription');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}
