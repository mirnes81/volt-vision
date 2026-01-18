import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment } from '@/types/assignments';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// In-memory cache for assignments
let assignmentsCache: InterventionAssignment[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 30000; // 30 seconds

// Subscribers for cache updates
type CacheSubscriber = () => void;
const subscribers = new Set<CacheSubscriber>();

function notifySubscribers() {
  console.log('[useInterventionAssignments] Notifying', subscribers.size, 'subscribers');
  subscribers.forEach(callback => callback());
}

export function useInterventionAssignments() {
  const [assignments, setAssignments] = useState<InterventionAssignment[]>(assignmentsCache || []);
  const [isLoading, setIsLoading] = useState(!assignmentsCache);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAssignments = useCallback(async (force = false) => {
    console.log('[useInterventionAssignments] fetchAssignments called, force:', force);
    console.log('[useInterventionAssignments] Cache status:', { 
      hasCache: !!assignmentsCache, 
      cacheTimestamp,
      age: cacheTimestamp ? Date.now() - cacheTimestamp : null 
    });
    
    // Use cache if fresh and not forced
    if (!force && assignmentsCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log('[useInterventionAssignments] Using cached data:', assignmentsCache.length, 'assignments');
      setAssignments(assignmentsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[useInterventionAssignments] Fetching from Supabase...');
      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('[useInterventionAssignments] Fetch error:', error);
        return;
      }

      console.log('[useInterventionAssignments] Fetched', data?.length || 0, 'assignments from DB');
      
      // Update cache - cast priority to union type
      assignmentsCache = (data || []).map(a => ({
        ...a,
        priority: a.priority as 'normal' | 'urgent' | 'critical'
      }));
      cacheTimestamp = Date.now();
      setAssignments(assignmentsCache);
      
      console.log('[useInterventionAssignments] State updated with', assignmentsCache.length, 'assignments');
    } catch (err) {
      console.error('[useInterventionAssignments] Failed to fetch assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Subscribe to cache invalidations
  useEffect(() => {
    const handleInvalidation = () => {
      console.log('[useInterventionAssignments] Cache invalidated, triggering refresh');
      setRefreshKey(k => k + 1);
    };
    
    subscribers.add(handleInvalidation);
    console.log('[useInterventionAssignments] Subscribed, total subscribers:', subscribers.size);
    return () => {
      subscribers.delete(handleInvalidation);
      console.log('[useInterventionAssignments] Unsubscribed, remaining subscribers:', subscribers.size);
    };
  }, []);

  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      console.log('[useInterventionAssignments] RefreshKey changed to', refreshKey, ', refetching...');
      fetchAssignments(true);
    }
  }, [refreshKey, fetchAssignments]);

  // Create a lookup map by intervention_id for quick access
  const assignmentsByInterventionId = useMemo(() => {
    const map = new Map<number, InterventionAssignment[]>();
    
    assignments.forEach(a => {
      if (a.intervention_id !== null) {
        const existing = map.get(a.intervention_id) || [];
        existing.push(a);
        map.set(a.intervention_id, existing);
      }
    });

    return map;
  }, [assignments]);

  // Get assignments for a specific intervention
  const getAssignmentsForIntervention = (interventionId: number): InterventionAssignment[] => {
    return assignmentsByInterventionId.get(interventionId) || [];
  };

  // Force refresh - returns Promise for awaiting
  const refresh = useCallback(async () => {
    await fetchAssignments(true);
  }, [fetchAssignments]);

  return {
    assignments,
    isLoading,
    getAssignmentsForIntervention,
    assignmentsByInterventionId,
    refresh,
  };
}

// Global function to invalidate cache and notify all subscribers
export function invalidateAssignmentsCache() {
  console.log('[useInterventionAssignments] Invalidating cache');
  assignmentsCache = null;
  cacheTimestamp = null;
  notifySubscribers();
}
