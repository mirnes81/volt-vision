import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkTimeEntry, HoursAlert, DailyWorkSummary } from '@/types/timeTracking';
import { useToast } from '@/hooks/use-toast';

interface UseTimeTrackingAdminOptions {
  startDate?: Date;
  endDate?: Date;
  statusFilter?: 'all' | 'pending' | 'approved' | 'rejected';
}

export function useTimeTrackingAdmin(options: UseTimeTrackingAdminOptions = {}) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<WorkTimeEntry[]>([]);
  const [alerts, setAlerts] = useState<HoursAlert[]>([]);
  const [summaries, setSummaries] = useState<DailyWorkSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get tenant ID
  useEffect(() => {
    async function fetchTenantId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('saas_profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        }
      }
    }
    fetchTenantId();
  }, []);

  // Fetch all entries for the tenant
  const fetchEntries = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const startDate = options.startDate || new Date(new Date().setDate(new Date().getDate() - 7));
      const endDate = options.endDate || new Date();
      
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('work_time_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('clock_in', startOfDay.toISOString())
        .lte('clock_in', endOfDay.toISOString())
        .order('clock_in', { ascending: false });

      if (options.statusFilter && options.statusFilter !== 'all') {
        query = query.eq('status', options.statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('saas_profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const entriesWithNames = (data || []).map(entry => ({
        ...entry,
        status: entry.status as 'pending' | 'approved' | 'rejected',
        user_name: profileMap.get(entry.user_id)?.full_name || 'Inconnu',
        user_email: profileMap.get(entry.user_id)?.email,
      })) as WorkTimeEntry[];

      setEntries(entriesWithNames);

    } catch (error) {
      console.error('Error fetching entries:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les entrées',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, options.startDate, options.endDate, options.statusFilter, toast]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('hours_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false)
        .order('alert_date', { ascending: false });

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('saas_profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const alertsWithNames = (data || []).map(alert => ({
        ...alert,
        user_name: profileMap.get(alert.user_id)?.full_name || 'Inconnu',
      })) as HoursAlert[];

      setAlerts(alertsWithNames);

    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [tenantId]);

  // Fetch daily summaries
  const fetchSummaries = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('daily_work_summary')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('work_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      setSummaries((data || []) as DailyWorkSummary[]);

    } catch (error) {
      console.error('Error fetching summaries:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      fetchEntries();
      fetchAlerts();
      fetchSummaries();
    }
  }, [tenantId, fetchEntries, fetchAlerts, fetchSummaries]);

  // Approve entry
  const approveEntry = async (entryId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('work_time_entries')
        .update({
          status: 'approved',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: 'Approuvé',
        description: 'L\'entrée a été validée',
      });

      await fetchEntries();
    } catch (error) {
      console.error('Error approving entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de valider l\'entrée',
        variant: 'destructive',
      });
    }
  };

  // Reject entry
  const rejectEntry = async (entryId: string, reason: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('work_time_entries')
        .update({
          status: 'rejected',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: 'Rejeté',
        description: 'L\'entrée a été rejetée',
      });

      await fetchEntries();
    } catch (error) {
      console.error('Error rejecting entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de rejeter l\'entrée',
        variant: 'destructive',
      });
    }
  };

  // Bulk approve
  const bulkApprove = async (entryIds: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('work_time_entries')
        .update({
          status: 'approved',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .in('id', entryIds);

      if (error) throw error;

      toast({
        title: 'Approuvées',
        description: `${entryIds.length} entrée(s) validée(s)`,
      });

      await fetchEntries();
    } catch (error) {
      console.error('Error bulk approving:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de valider les entrées',
        variant: 'destructive',
      });
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('hours_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: 'Acquitté',
        description: 'L\'alerte a été acquittée',
      });

      await fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'acquitter l\'alerte',
        variant: 'destructive',
      });
    }
  };

  return {
    entries,
    alerts,
    summaries,
    isLoading,
    approveEntry,
    rejectEntry,
    bulkApprove,
    acknowledgeAlert,
    refresh: fetchEntries,
  };
}
