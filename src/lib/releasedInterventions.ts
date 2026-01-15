import { supabase } from '@/integrations/supabase/client';
import { Intervention, Coordinates } from '@/types/intervention';

export interface ReleasedIntervention {
  id: string;
  intervention_id: number;
  intervention_ref: string;
  intervention_label: string;
  client_name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  date_start: string | null;
  intervention_type: string;
  priority: string;
  released_by_user_id: number;
  released_by_name: string;
  released_by_supabase_uid: string | null;
  released_at: string;
  taken_by_user_id: number | null;
  taken_by_name: string | null;
  taken_by_supabase_uid: string | null;
  taken_at: string | null;
  status: 'available' | 'taken' | 'cancelled';
  created_at: string;
}

// Get current Supabase user ID
async function getSupabaseUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Release an intervention
export async function releaseIntervention(
  intervention: Intervention,
  userId: number,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUid = await getSupabaseUserId();
    
    const { error } = await supabase.from('released_interventions').insert({
      intervention_id: intervention.id,
      intervention_ref: intervention.ref,
      intervention_label: intervention.label,
      client_name: intervention.clientName,
      location: intervention.location,
      latitude: intervention.coordinates?.lat || null,
      longitude: intervention.coordinates?.lng || null,
      date_start: intervention.dateStart || null,
      intervention_type: intervention.type,
      priority: intervention.priority,
      released_by_user_id: userId,
      released_by_name: userName,
      released_by_supabase_uid: supabaseUid,
      status: 'available'
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error releasing intervention:', error);
    return { success: false, error: error.message };
  }
}

// Take a released intervention
export async function takeIntervention(
  releaseId: string,
  userId: number,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUid = await getSupabaseUserId();
    
    const { error } = await supabase
      .from('released_interventions')
      .update({
        taken_by_user_id: userId,
        taken_by_name: userName,
        taken_by_supabase_uid: supabaseUid,
        taken_at: new Date().toISOString(),
        status: 'taken'
      })
      .eq('id', releaseId)
      .eq('status', 'available');

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error taking intervention:', error);
    return { success: false, error: error.message };
  }
}

// Cancel a release
export async function cancelRelease(releaseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('released_interventions')
      .update({ status: 'cancelled' })
      .eq('id', releaseId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling release:', error);
    return { success: false, error: error.message };
  }
}

// Get available interventions
export async function getAvailableInterventions(): Promise<ReleasedIntervention[]> {
  try {
    const { data, error } = await supabase
      .from('released_interventions')
      .select('*')
      .eq('status', 'available')
      .order('released_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ReleasedIntervention[];
  } catch (error) {
    console.error('Error fetching available interventions:', error);
    return [];
  }
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Sort interventions by distance from user
export function sortByDistance(
  interventions: ReleasedIntervention[],
  userLat: number,
  userLng: number
): (ReleasedIntervention & { distance: number })[] {
  return interventions
    .filter(i => i.latitude && i.longitude)
    .map(i => ({
      ...i,
      distance: calculateDistance(userLat, userLng, i.latitude!, i.longitude!)
    }))
    .sort((a, b) => a.distance - b.distance);
}