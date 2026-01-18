import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment } from '@/types/assignments';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface AssignmentsContextType {
  assignments: InterventionAssignment[];
  isLoading: boolean;
  getAssignmentsForIntervention: (interventionId: number) => InterventionAssignment[];
  refresh: () => Promise<void>;
}

const AssignmentsContext = createContext<AssignmentsContextType | undefined>(undefined);

export function AssignmentsProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<InterventionAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('[AssignmentsContext] Error loading assignments:', error);
        return;
      }

      const mapped = (data || []).map(a => ({
        ...a,
        priority: a.priority as 'normal' | 'urgent' | 'critical'
      }));
      
      console.log('[AssignmentsContext] Loaded', mapped.length, 'assignments');
      setAssignments(mapped);
    } catch (err) {
      console.error('[AssignmentsContext] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'intervention_assignments',
          filter: `tenant_id=eq.${DEFAULT_TENANT_ID}`
        },
        (payload) => {
          console.log('[AssignmentsContext] Realtime update:', payload.eventType);
          loadAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAssignments]);

  const getAssignmentsForIntervention = useCallback((interventionId: number): InterventionAssignment[] => {
    return assignments.filter(a => a.intervention_id === interventionId);
  }, [assignments]);

  const refresh = useCallback(async () => {
    await loadAssignments();
  }, [loadAssignments]);

  return (
    <AssignmentsContext.Provider value={{ assignments, isLoading, getAssignmentsForIntervention, refresh }}>
      {children}
    </AssignmentsContext.Provider>
  );
}

export function useAssignments() {
  const context = useContext(AssignmentsContext);
  if (!context) {
    throw new Error('useAssignments must be used within AssignmentsProvider');
  }
  return context;
}
