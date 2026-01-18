import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment } from '@/types/assignments';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface AssignmentsContextType {
  assignments: InterventionAssignment[];
  isLoading: boolean;
  getAssignmentsForIntervention: (interventionId: number) => InterventionAssignment[];
  refresh: () => Promise<void>;
}

const AssignmentsContext = React.createContext<AssignmentsContextType | undefined>(undefined);

export function AssignmentsProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = React.useState<InterventionAssignment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadAssignments = React.useCallback(async () => {
    console.log('[AssignmentsContext] ========== LOADING ASSIGNMENTS ==========');
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('assigned_at', { ascending: false });

      console.log('[AssignmentsContext] Supabase response:', { 
        dataCount: data?.length || 0, 
        error,
        firstItem: data?.[0] 
      });

      if (error) {
        console.error('[AssignmentsContext] Error loading assignments:', error);
        setIsLoading(false);
        return;
      }

      const mapped = (data || []).map(a => ({
        ...a,
        priority: a.priority as 'normal' | 'urgent' | 'critical'
      }));
      
      console.log('[AssignmentsContext] Mapped assignments:', mapped.map(a => ({
        id: a.id,
        intervention_id: a.intervention_id,
        user_name: a.user_name,
        user_id: a.user_id
      })));
      setAssignments(mapped);
    } catch (err) {
      console.error('[AssignmentsContext] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  React.useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Subscribe to realtime changes
  React.useEffect(() => {
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

  const getAssignmentsForIntervention = React.useCallback((interventionId: number): InterventionAssignment[] => {
    const result = assignments.filter(a => a.intervention_id === interventionId);
    if (result.length > 0) {
      console.log(`[AssignmentsContext] Found ${result.length} assignments for intervention ${interventionId}:`, result.map(a => a.user_name));
    }
    return result;
  }, [assignments]);

  const refresh = React.useCallback(async () => {
    await loadAssignments();
  }, [loadAssignments]);

  const value = React.useMemo(() => ({
    assignments,
    isLoading,
    getAssignmentsForIntervention,
    refresh
  }), [assignments, isLoading, getAssignmentsForIntervention, refresh]);

  return (
    <AssignmentsContext.Provider value={value}>
      {children}
    </AssignmentsContext.Provider>
  );
}

export function useAssignments() {
  const context = React.useContext(AssignmentsContext);
  if (context === undefined) {
    throw new Error('useAssignments must be used within AssignmentsProvider');
  }
  return context;
}
