import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkTimeEntry, DailyLimitCheck } from '@/types/timeTracking';
import { useToast } from '@/hooks/use-toast';

interface UseTimeTrackingOptions {
  userId?: string;
  tenantId?: string;
  date?: Date;
}

export function useTimeTracking(options: UseTimeTrackingOptions = {}) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<WorkTimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WorkTimeEntry | null>(null);
  const [dailyLimit, setDailyLimit] = useState<DailyLimitCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);

  // Get current user and tenant
  const [currentUser, setCurrentUser] = useState<{ id: string; tenant_id: string } | null>(null);

  useEffect(() => {
    async function fetchUserInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('saas_profiles')
          .select('id, tenant_id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile?.tenant_id) {
          setCurrentUser({ id: profile.id, tenant_id: profile.tenant_id });
        }
      }
    }
    fetchUserInfo();
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    if (!currentUser) return;

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
        .eq('tenant_id', currentUser.tenant_id)
        .gte('clock_in', startOfDay.toISOString())
        .lte('clock_in', endOfDay.toISOString())
        .order('clock_in', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      } else {
        query = query.eq('user_id', currentUser.id);
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
  }, [currentUser, options.userId, options.date, toast]);

  // Fetch daily limit
  const fetchDailyLimit = useCallback(async () => {
    if (!currentUser) return;

    try {
      const targetDate = options.date || new Date();
      const dateStr = targetDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .rpc('check_daily_hours_limit', {
          _user_id: options.userId || currentUser.id,
          _tenant_id: currentUser.tenant_id,
          _date: dateStr,
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setDailyLimit(data[0]);
      }
    } catch (error) {
      console.error('Error fetching daily limit:', error);
    }
  }, [currentUser, options.userId, options.date]);

  useEffect(() => {
    if (currentUser) {
      fetchEntries();
      fetchDailyLimit();
    }
  }, [currentUser, fetchEntries, fetchDailyLimit]);

  // Clock in
  const clockIn = async (data: {
    work_type?: string;
    intervention_id?: number;
    intervention_ref?: string;
    comment?: string;
    latitude?: number;
    longitude?: number;
  } = {}) => {
    if (!currentUser) {
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
          tenant_id: currentUser.tenant_id,
          user_id: currentUser.id,
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
      const { data: entry, error } = await supabase
        .from('work_time_entries')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_latitude: data.latitude,
          clock_out_longitude: data.longitude,
          comment: data.comment || activeEntry.comment,
        })
        .eq('id', activeEntry.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Dépointé !',
        description: 'Votre pointage de sortie a été enregistré',
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
    currentUser,
    clockIn,
    clockOut,
    updateEntry,
    deleteEntry,
    refresh: fetchEntries,
  };
}
