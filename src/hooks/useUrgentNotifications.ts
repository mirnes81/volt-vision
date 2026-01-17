import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment, UrgentNotification } from '@/types/assignments';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1eW11ncH2Km5yYkIJ1bWRkaXB8i5yamI+DdWxkZGlwfIuampiPg3VsZGRpcHyLmpqYj4N1bGRkaXB8i5qamI+DdWxkZGlwfIuampiPg3VsZGRpcHyLmpqYj4N1bGRkaXB8i5qamI+DdWxkZGlwfIuampiPg3VsZGRpcHyLmpqYj4N1bGRkaXB8i5qamI+DdWxkZGlwfIuampiPg3VsZGRpcHyLmpqYj4N1bGRkaXB8i5qamI+DdWxkZGlwfIuampiPg3VsZGQ=';

export function useUrgentNotifications() {
  const [urgentAssignments, setUrgentAssignments] = useState<InterventionAssignment[]>([]);
  const [notifications, setNotifications] = useState<UrgentNotification[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.7;
  }, []);

  // Play notification sound (with debounce)
  const playSound = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current > 3000) { // 3 second debounce
      audioRef.current?.play().catch(console.warn);
      lastPlayedRef.current = now;
    }
  }, []);

  // Fetch urgent assignments
  const fetchUrgentAssignments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('user_id', user.id)
        .in('priority', ['urgent', 'critical'])
        .eq('notification_acknowledged', false)
        .order('priority', { ascending: false })
        .order('date_planned', { ascending: true });

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        priority: item.priority as 'normal' | 'urgent' | 'critical'
      })) as InterventionAssignment[];

      setUrgentAssignments(typedData);
      setUnacknowledgedCount(typedData.length);

      // Create notifications from assignments
      const notifs: UrgentNotification[] = typedData.map(a => ({
        assignment: a,
        isNew: !a.notification_sent,
        isReminder: a.reminder_count > 0,
      }));
      setNotifications(notifs);

      // Play sound if there are new notifications
      if (notifs.some(n => n.isNew)) {
        playSound();
      }

    } catch (error) {
      console.error('Error fetching urgent assignments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [playSound]);

  // Subscribe to realtime changes
  useEffect(() => {
    fetchUrgentAssignments();

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channel = supabase
        .channel('urgent-assignments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'intervention_assignments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<InterventionAssignment>) => {
            console.log('Assignment change:', payload);
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const assignment = payload.new as InterventionAssignment;
              if (['urgent', 'critical'].includes(assignment.priority) && !assignment.notification_acknowledged) {
                playSound();
                fetchUrgentAssignments();
              }
            } else if (payload.eventType === 'DELETE') {
              fetchUrgentAssignments();
            }
          }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    setupSubscription().then(c => { channel = c; });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchUrgentAssignments, playSound]);

  // Acknowledge notification
  const acknowledgeNotification = useCallback(async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('intervention_assignments')
        .update({
          notification_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.assignment.id !== assignmentId));
      setUnacknowledgedCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('Error acknowledging notification:', error);
    }
  }, []);

  // Acknowledge all notifications
  const acknowledgeAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('intervention_assignments')
        .update({
          notification_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('notification_acknowledged', false);

      if (error) throw error;

      setNotifications([]);
      setUnacknowledgedCount(0);
      
    } catch (error) {
      console.error('Error acknowledging all notifications:', error);
    }
  }, []);

  return {
    urgentAssignments,
    notifications,
    unacknowledgedCount,
    isLoading,
    acknowledgeNotification,
    acknowledgeAll,
    refresh: fetchUrgentAssignments,
  };
}
