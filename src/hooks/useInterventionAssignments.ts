import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment } from '@/types/assignments';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// In-memory cache for assignments
let assignmentsCache: InterventionAssignment[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 30000; // 30 seconds

export function useInterventionAssignments() {
  const [assignments, setAssignments] = useState<InterventionAssignment[]>(assignmentsCache || []);
  const [isLoading, setIsLoading] = useState(!assignmentsCache);

  useEffect(() => {
    const fetchAssignments = async () => {
      // Use cache if fresh
      if (assignmentsCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        setAssignments(assignmentsCache);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('intervention_assignments')
          .select('*')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .order('assigned_at', { ascending: false });

        if (error) {
          console.error('Error fetching assignments:', error);
          return;
        }

        // Update cache - cast priority to union type
        assignmentsCache = (data || []).map(a => ({
          ...a,
          priority: a.priority as 'normal' | 'urgent' | 'critical'
        }));
        cacheTimestamp = Date.now();
        setAssignments(assignmentsCache);
      } catch (err) {
        console.error('Failed to fetch assignments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, []);

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

  // Invalidate cache (call after creating/updating assignments)
  const invalidateCache = () => {
    assignmentsCache = null;
    cacheTimestamp = null;
  };

  return {
    assignments,
    isLoading,
    getAssignmentsForIntervention,
    assignmentsByInterventionId,
    invalidateCache,
  };
}

// Export for invalidation from other components
export function invalidateAssignmentsCache() {
  assignmentsCache = null;
  cacheTimestamp = null;
}
