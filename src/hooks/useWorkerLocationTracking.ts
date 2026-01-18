import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const UPDATE_INTERVAL = 30000; // 30 seconds

export interface WorkerLocation {
  id: string;
  user_id: string;
  user_name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
  is_online: boolean;
  current_intervention_id: number | null;
  current_intervention_ref: string | null;
}

export function useWorkerLocationTracking() {
  const { worker } = useAuth();
  const [isTracking, setIsTracking] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = React.useRef<number | null>(null);

  const updateLocation = React.useCallback(async (position: GeolocationPosition) => {
    if (!worker) return;

    const userId = worker.id?.toString();
    const userName = `${worker.firstName || ''} ${worker.name || ''}`.trim() || 'Inconnu';

    if (!userId) {
      console.error('[WorkerLocation] No user ID available');
      return;
    }

    try {
      const { error } = await supabase
        .from('worker_locations')
        .upsert({
          user_id: userId,
          user_name: userName,
          tenant_id: DEFAULT_TENANT_ID,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updated_at: new Date().toISOString(),
          is_online: true
        }, {
          onConflict: 'user_id,tenant_id'
        });

      if (error) {
        console.error('[WorkerLocation] Error updating location:', error);
      } else {
        setLastUpdate(new Date());
        console.log('[WorkerLocation] Location updated successfully');
      }
    } catch (err) {
      console.error('[WorkerLocation] Unexpected error:', err);
    }
  }, [worker]);

  const startTracking = React.useCallback(() => {
    if (!navigator.geolocation) {
      console.error('[WorkerLocation] Geolocation not supported');
      return;
    }

    setIsTracking(true);

    // Get immediate position
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      (error) => console.error('[WorkerLocation] Initial position error:', error),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (error) => console.error('[WorkerLocation] Watch position error:', error),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    // Also update periodically
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        (error) => console.error('[WorkerLocation] Periodic update error:', error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, UPDATE_INTERVAL);

    console.log('[WorkerLocation] Tracking started');
  }, [updateLocation]);

  const stopTracking = React.useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Mark as offline
    if (worker) {
      const userId = worker.id?.toString();
      if (userId) {
        await supabase
          .from('worker_locations')
          .update({ is_online: false })
          .eq('user_id', userId)
          .eq('tenant_id', DEFAULT_TENANT_ID);
      }
    }

    setIsTracking(false);
    console.log('[WorkerLocation] Tracking stopped');
  }, [worker]);

  // Start tracking when component mounts (if worker is logged in)
  React.useEffect(() => {
    if (worker && !isTracking) {
      startTracking();
    }

    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [worker]);

  return {
    isTracking,
    lastUpdate,
    startTracking,
    stopTracking
  };
}

export function useWorkerLocations() {
  const [workers, setWorkers] = React.useState<WorkerLocation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadWorkers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('worker_locations')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .eq('is_online', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[WorkerLocations] Error loading:', error);
        return;
      }

      setWorkers(data as WorkerLocation[]);
    } catch (err) {
      console.error('[WorkerLocations] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount and subscribe to realtime
  React.useEffect(() => {
    loadWorkers();

    const channel = supabase
      .channel('worker-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_locations',
          filter: `tenant_id=eq.${DEFAULT_TENANT_ID}`
        },
        (payload) => {
          console.log('[WorkerLocations] Realtime update:', payload.eventType);
          loadWorkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadWorkers]);

  return {
    workers,
    isLoading,
    refresh: loadWorkers
  };
}
