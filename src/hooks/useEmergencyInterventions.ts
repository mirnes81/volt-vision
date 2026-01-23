import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playEmergencySound, playSuccessSound, isOutsideWorkHours } from '@/lib/emergencySound';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface EmergencyIntervention {
  id: string;
  intervention_id: number;
  intervention_ref?: string;
  intervention_label?: string;
  client_name?: string;
  location?: string;
  description?: string;
  bonus_amount: number;
  currency: string;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  claimed_by_user_id?: string;
  claimed_by_user_name?: string;
  claimed_at?: string;
  created_by_user_id: string;
  created_by_user_name?: string;
  created_at: string;
  expires_at?: string;
}

export function useEmergencyInterventions() {
  const [emergencies, setEmergencies] = useState<EmergencyIntervention[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchEmergencies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_interventions')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []) as EmergencyIntervention[];
      setEmergencies(mapped);
      setOpenCount(mapped.filter(e => e.status === 'open').length);
    } catch (err) {
      console.error('[Emergency] Error fetching:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEmergencies();
  }, [fetchEmergencies]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('emergency-interventions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_interventions',
          filter: `tenant_id=eq.${DEFAULT_TENANT_ID}`
        },
        (payload) => {
          console.log('[Emergency] Realtime update:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            // Play sound (urgent if outside work hours)
            playEmergencySound();
            
            const outsideHours = isOutsideWorkHours();
            toast.warning(outsideHours ? '🚨 URGENCE!' : '🚨 Nouvelle urgence disponible!', {
              description: outsideHours 
                ? 'Dépannage urgent avec bonus - Action requise!'
                : 'Un dépannage avec bonus est disponible',
              duration: outsideHours ? 30000 : 10000
            });
          }
          fetchEmergencies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmergencies, playEmergencySound]);

  // Claim an emergency (atomic operation)
  const claimEmergency = useCallback(async (emergencyId: string): Promise<boolean> => {
    const worker = localStorage.getItem('worker');
    if (!worker) {
      toast.error('Vous devez être connecté');
      return false;
    }

    const workerData = JSON.parse(worker);
    setClaimingId(emergencyId);

    try {
      const { data, error } = await supabase.rpc('claim_emergency_intervention', {
        p_emergency_id: emergencyId,
        p_user_id: String(workerData.id),
        p_user_name: `${workerData.firstname} ${workerData.lastname}`
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; bonus_amount?: number; message?: string };
      
      if (result.success) {
        // Play success sound
        playSuccessSound();
        toast.success(`🎉 Intervention réclamée! Bonus: ${result.bonus_amount} CHF`, {
          duration: 5000
        });
        await fetchEmergencies();
        return true;
      } else {
        toast.error(result.error || 'Impossible de réclamer cette intervention');
        return false;
      }
    } catch (err: any) {
      console.error('[Emergency] Claim error:', err);
      toast.error(err.message || 'Erreur lors de la réclamation');
      return false;
    } finally {
      setClaimingId(null);
    }
  }, [fetchEmergencies]);

  // Create a new emergency (admin only)
  const createEmergency = useCallback(async (params: {
    intervention_id: number;
    intervention_ref?: string;
    intervention_label?: string;
    client_name?: string;
    location?: string;
    description?: string;
    bonus_amount: number;
  }): Promise<boolean> => {
    const worker = localStorage.getItem('worker');
    if (!worker) {
      toast.error('Vous devez être connecté');
      return false;
    }

    const workerData = JSON.parse(worker);

    try {
      const { error } = await supabase
        .from('emergency_interventions')
        .insert({
          tenant_id: DEFAULT_TENANT_ID,
          intervention_id: params.intervention_id,
          intervention_ref: params.intervention_ref,
          intervention_label: params.intervention_label,
          client_name: params.client_name,
          location: params.location,
          description: params.description,
          bonus_amount: params.bonus_amount,
          created_by_user_id: String(workerData.id),
          created_by_user_name: `${workerData.firstname} ${workerData.lastname}`
        });

      if (error) throw error;

      toast.success('Urgence créée et diffusée à tous les techniciens');
      return true;
    } catch (err: any) {
      console.error('[Emergency] Create error:', err);
      toast.error(err.message || 'Erreur lors de la création');
      return false;
    }
  }, []);

  // Cancel an emergency (admin only)
  const cancelEmergency = useCallback(async (emergencyId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('emergency_interventions')
        .update({ status: 'cancelled' })
        .eq('id', emergencyId);

      if (error) throw error;

      toast.success('Urgence annulée');
      await fetchEmergencies();
      return true;
    } catch (err: any) {
      console.error('[Emergency] Cancel error:', err);
      toast.error(err.message || 'Erreur lors de l\'annulation');
      return false;
    }
  }, [fetchEmergencies]);

  // Mark as completed
  const completeEmergency = useCallback(async (emergencyId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('emergency_interventions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', emergencyId);

      if (error) throw error;

      toast.success('Urgence marquée comme terminée');
      await fetchEmergencies();
      return true;
    } catch (err: any) {
      console.error('[Emergency] Complete error:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour');
      return false;
    }
  }, [fetchEmergencies]);

  return {
    emergencies,
    openEmergencies: emergencies.filter(e => e.status === 'open'),
    myClaimedEmergencies: emergencies.filter(e => {
      const worker = localStorage.getItem('worker');
      if (!worker) return false;
      const workerData = JSON.parse(worker);
      return e.claimed_by_user_id === String(workerData.id) && e.status === 'claimed';
    }),
    openCount,
    isLoading,
    claimingId,
    claimEmergency,
    createEmergency,
    cancelEmergency,
    completeEmergency,
    refresh: fetchEmergencies
  };
}
