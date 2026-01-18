import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkTimeEntry, DailyLimitCheck } from '@/types/timeTracking';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UseTimeTrackingOptions {
  userId?: string;
  tenantId?: string;
  date?: Date;
}

// Default tenant UUID for Dolibarr integration mode
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function useTimeTracking(options: UseTimeTrackingOptions = {}) {
  const { toast } = useToast();
  const { worker } = useAuth();
  const [entries, setEntries] = React.useState<WorkTimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = React.useState<WorkTimeEntry | null>(null);
  const [dailyLimit, setDailyLimit] = React.useState<DailyLimitCheck | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClockedIn, setIsClockedIn] = React.useState(false);

  // Use worker from AuthContext (Dolibarr) instead of Supabase auth
  const userId = worker ? String(worker.id) : null;
  const tenantId = options.tenantId || DEFAULT_TENANT_ID;

  // Fetch entries
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
      
      // Check for active (unclosed) entry
      const active = typedData.find(e => !e.clock_out);
      setActiveEntry(active || null);
      setIsClockedIn(!!active);

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

  // Fetch daily limit
  const fetchDailyLimit = React.useCallback(async () => {
    if (!userId) return;

    try {
      const targetDate = options.date || new Date();
      const dateStr = targetDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .rpc('check_daily_hours_limit', {
          _user_id: options.userId || userId,
          _tenant_id: tenantId,
          _date: dateStr,
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setDailyLimit(data[0]);
      }
    } catch (error) {
      console.error('Error fetching daily limit:', error);
    }
  }, [userId, tenantId, options.userId, options.date]);

  React.useEffect(() => {
    if (userId) {
      fetchEntries();
      fetchDailyLimit();
    }
  }, [userId, fetchEntries, fetchDailyLimit]);

  // Clock in
  const clockIn = async (data: {
    work_type?: string;
    intervention_id?: number;
    intervention_ref?: string;
    comment?: string;
    latitude?: number;
    longitude?: number;
  } = {}) => {
    if (!userId) {
      toast({
        title: 'Erreur',
        description: 'Utilisateur non connecté',
        variant: 'destructive',
      });
      return null;
    }

    if (isClockedIn) {
      toast({
        title: 'Attention',
        description: 'Vous êtes déjà pointé',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data: entry, error } = await supabase
        .from('work_time_entries')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          work_type: data.work_type || 'intervention',
          intervention_id: data.intervention_id,
          intervention_ref: data.intervention_ref,
          comment: data.comment,
          clock_in_latitude: data.latitude,
          clock_in_longitude: data.longitude,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Pointé !',
        description: 'Votre pointage d\'entrée a été enregistré',
      });

      await fetchEntries();
      await fetchDailyLimit();
      
      return entry;
    } catch (error) {
      console.error('Error clocking in:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer le pointage',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Clock out
  const clockOut = async (data: {
    comment?: string;
    latitude?: number;
    longitude?: number;
  } = {}) => {
    if (!activeEntry) {
      toast({
        title: 'Attention',
        description: 'Aucun pointage actif à clôturer',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const clockOutTime = new Date();
      const clockInTime = new Date(activeEntry.clock_in);
      const durationMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000);

      const { data: entry, error } = await supabase
        .from('work_time_entries')
        .update({
          clock_out: clockOutTime.toISOString(),
          clock_out_latitude: data.latitude,
          clock_out_longitude: data.longitude,
          comment: data.comment || activeEntry.comment,
          duration_minutes: durationMinutes,
        })
        .eq('id', activeEntry.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Dépointé !',
        description: `Durée: ${Math.floor(durationMinutes / 60)}h${(durationMinutes % 60).toString().padStart(2, '0')}`,
      });

      await fetchEntries();
      await fetchDailyLimit();
      
      return entry;
    } catch (error) {
      console.error('Error clocking out:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer le dépointage',
        variant: 'destructive',
      });
      return null;
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
      await fetchDailyLimit();
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
    activeEntry,
    dailyLimit,
    isLoading,
    isClockedIn,
    currentUser: userId ? { id: userId, tenant_id: tenantId } : null,
    clockIn,
    clockOut,
    updateEntry,
    deleteEntry,
    refresh: fetchEntries,
  };
}
