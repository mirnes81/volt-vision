import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkTimeEntry } from '@/types/timeTracking';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface UseTimeTrackingOptions {
  userId?: string;
  tenantId?: string;
  date?: Date;
}

interface WeeklySummary {
  totalMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  overtimeMinutes: number;
  limitMinutes: number;
}

interface MonthlySummary {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  approvedMinutes: number;
}

// Default tenant UUID for Dolibarr integration mode
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function useTimeTracking(options: UseTimeTrackingOptions = {}) {
  const { toast } = useToast();
  const { worker } = useAuth();
  const [entries, setEntries] = React.useState<WorkTimeEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [weeklySummary, setWeeklySummary] = React.useState<WeeklySummary>({
    totalMinutes: 0,
    approvedMinutes: 0,
    pendingMinutes: 0,
    overtimeMinutes: 0,
    limitMinutes: 2520, // 42h default
  });
  const [monthlySummary, setMonthlySummary] = React.useState<MonthlySummary>({
    totalMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    approvedMinutes: 0,
  });

  // Use worker from AuthContext (Dolibarr) instead of Supabase auth
  const userId = worker ? String(worker.id) : null;
  const tenantId = options.tenantId || DEFAULT_TENANT_ID;

  // Fetch entries for the selected date
  const fetchEntries = React.useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const targetDate = options.date || new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('work_time_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('clock_in', startOfDay.toISOString())
        .lte('clock_in', endOfDay.toISOString())
        .order('clock_in', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(entry => ({
        ...entry,
        status: entry.status as 'pending' | 'approved' | 'rejected'
      })) as WorkTimeEntry[];
      
      setEntries(typedData);

    } catch (error) {
      console.error('Error fetching time entries:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les entrées de temps',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, tenantId, options.userId, options.date, toast]);

  // Fetch weekly summary
  const fetchWeeklySummary = React.useCallback(async () => {
    if (!userId) return;

    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get weekly entries
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('work_time_entries')
        .select('duration_minutes, status, is_overtime')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .not('clock_out', 'is', null);

      if (weeklyError) throw weeklyError;

      // Get user's weekly limit
      const { data: limitData } = await supabase
        .from('user_weekly_limits')
        .select('weekly_hours_limit')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single();

      const limitMinutes = (limitData?.weekly_hours_limit || 42) * 60;

      const summary = (weeklyData || []).reduce((acc, entry) => {
        const mins = entry.duration_minutes || 0;
        acc.totalMinutes += mins;
        if (entry.status === 'approved') acc.approvedMinutes += mins;
        if (entry.status === 'pending') acc.pendingMinutes += mins;
        if (entry.is_overtime) acc.overtimeMinutes += mins;
        return acc;
      }, {
        totalMinutes: 0,
        approvedMinutes: 0,
        pendingMinutes: 0,
        overtimeMinutes: 0,
        limitMinutes,
      });

      setWeeklySummary(summary);

    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    }
  }, [userId, tenantId]);

  // Fetch monthly summary
  const fetchMonthlySummary = React.useCallback(async () => {
    if (!userId) return;

    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const { data, error } = await supabase
        .from('work_time_entries')
        .select('duration_minutes, status, is_overtime')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('clock_in', monthStart.toISOString())
        .lte('clock_in', monthEnd.toISOString())
        .not('clock_out', 'is', null);

      if (error) throw error;

      const summary = (data || []).reduce((acc, entry) => {
        const mins = entry.duration_minutes || 0;
        acc.totalMinutes += mins;
        if (entry.is_overtime) {
          acc.overtimeMinutes += mins;
        } else {
          acc.regularMinutes += mins;
        }
        if (entry.status === 'approved') acc.approvedMinutes += mins;
        return acc;
      }, {
        totalMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        approvedMinutes: 0,
      });

      setMonthlySummary(summary);

    } catch (error) {
      console.error('Error fetching monthly summary:', error);
    }
  }, [userId, tenantId]);

  React.useEffect(() => {
    if (userId) {
      fetchEntries();
      fetchWeeklySummary();
      fetchMonthlySummary();
    }
  }, [userId, fetchEntries, fetchWeeklySummary, fetchMonthlySummary]);

  // Add manual time entry
  const addManualEntry = async (data: {
    date: string;
    duration_minutes: number;
    work_type: string;
    intervention_id?: number;
    intervention_ref?: string;
    comment?: string;
  }) => {
    if (!userId) {
      toast({
        title: 'Erreur',
        description: 'Utilisateur non connecté',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // Create clock_in and clock_out times from date and duration
      const clockIn = new Date(`${data.date}T09:00:00`);
      const clockOut = new Date(clockIn.getTime() + data.duration_minutes * 60000);

      const { error } = await supabase
        .from('work_time_entries')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          clock_in: clockIn.toISOString(),
          clock_out: clockOut.toISOString(),
          duration_minutes: data.duration_minutes,
          work_type: data.work_type,
          intervention_id: data.intervention_id,
          intervention_ref: data.intervention_ref,
          comment: data.comment,
        });

      if (error) throw error;

      toast({
        title: 'Heures ajoutées',
        description: `${Math.floor(data.duration_minutes / 60)}h${(data.duration_minutes % 60).toString().padStart(2, '0')} enregistrées`,
      });

      await fetchEntries();
      await fetchWeeklySummary();
      await fetchMonthlySummary();
      
      return true;
    } catch (error) {
      console.error('Error adding manual entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter les heures',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Update entry
  const updateEntry = async (entryId: string, updates: Partial<WorkTimeEntry>) => {
    try {
      const { data: entry, error } = await supabase
        .from('work_time_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;

      await fetchEntries();
      await fetchWeeklySummary();
      await fetchMonthlySummary();
      return entry;
    } catch (error) {
      console.error('Error updating entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier l\'entrée',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Delete entry (only pending ones)
  const deleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('work_time_entries')
        .delete()
        .eq('id', entryId)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: 'Supprimé',
        description: 'L\'entrée a été supprimée',
      });

      await fetchEntries();
      await fetchWeeklySummary();
      await fetchMonthlySummary();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'entrée',
        variant: 'destructive',
      });
    }
  };

  return {
    entries,
    isLoading,
    weeklySummary,
    monthlySummary,
    currentUser: userId ? { id: userId, tenant_id: tenantId } : null,
    addManualEntry,
    updateEntry,
    deleteEntry,
    refresh: () => {
      fetchEntries();
      fetchWeeklySummary();
      fetchMonthlySummary();
    },
  };
}
