import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const hasFetchedOnce = useRef(false);

  const fetchAssignments = useCallback(async (force = false) => {
    console.log('[useInterventionAssignments] fetchAssignments called, force:', force, 'hasFetchedOnce:', hasFetchedOnce.current);
    console.log('[useInterventionAssignments] Cache status:', { 
      hasCache: !!assignmentsCache, 
      cacheLength: assignmentsCache?.length,
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
      // Use direct fetch with cache-busting headers to bypass Supabase CDN cache
      const cacheBuster = Date.now();
      console.log('[useInterventionAssignments] Fetching from Supabase for tenant:', DEFAULT_TENANT_ID, 'cacheBuster:', cacheBuster);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/intervention_assignments?select=*&tenant_id=eq.${DEFAULT_TENANT_ID}&order=assigned_at.desc&_=${cacheBuster}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        console.error('[useInterventionAssignments] Fetch error:', response.status, response.statusText);
        return;
      }

      const data = await response.json();

      console.log('[useInterventionAssignments] Fetched', data?.length || 0, 'assignments from DB');
      console.log('[useInterventionAssignments] Raw data:', JSON.stringify(data, null, 2));
      
      // Update cache - cast priority to union type
      assignmentsCache = (data || []).map((a: any) => ({
        ...a,
        priority: a.priority as 'normal' | 'urgent' | 'critical'
      }));
      cacheTimestamp = Date.now();
      hasFetchedOnce.current = true;
      setAssignments(assignmentsCache);
      
      console.log('[useInterventionAssignments] State updated with', assignmentsCache.length, 'assignments');
      
      // Log intervention IDs for debugging
      const interventionIds = assignmentsCache.map(a => a.intervention_id);
      console.log('[useInterventionAssignments] Intervention IDs in cache:', interventionIds);
    } catch (err) {
      console.error('[useInterventionAssignments] Failed to fetch assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch - force on mount to ensure data is loaded
  useEffect(() => {
    console.log('[useInterventionAssignments] Component mounted, starting initial fetch');
    // Clear cache on mount to ensure fresh data
    assignmentsCache = null;
    cacheTimestamp = null;
    fetchAssignments(true);
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
    
    console.log('[useInterventionAssignments] Building lookup map from', assignments.length, 'assignments');
    
    assignments.forEach(a => {
      if (a.intervention_id !== null) {
        const existing = map.get(a.intervention_id) || [];
        existing.push(a);
        map.set(a.intervention_id, existing);
      }
    });

    console.log('[useInterventionAssignments] Lookup map has', map.size, 'interventions');
    return map;
  }, [assignments]);

  // Get assignments for a specific intervention (NOT a hook - regular function)
  const getAssignmentsForIntervention = (interventionId: number): InterventionAssignment[] => {
    const result = assignmentsByInterventionId.get(interventionId) || [];
    console.log('[useInterventionAssignments] getAssignmentsForIntervention', interventionId, ':', result.length, 'found, map size:', assignmentsByInterventionId.size);
    return result;
  };

  // Force refresh - returns Promise for awaiting
  const refresh = useCallback(async () => {
    console.log('[useInterventionAssignments] Manual refresh requested');
    assignmentsCache = null;
    cacheTimestamp = null;
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
  console.log('[useInterventionAssignments] Invalidating cache globally');
  assignmentsCache = null;
  cacheTimestamp = null;
  notifySubscribers();
}
