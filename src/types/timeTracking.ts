export interface WorkTimeEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  intervention_id: number | null;
  intervention_ref: string | null;
  work_type: string;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  validated_by: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  duration_minutes: number | null;
  synced_to_dolibarr: boolean;
  dolibarr_sync_at: string | null;
  dolibarr_line_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
  validator_name?: string;
}

export interface DailyWorkSummary {
  tenant_id: string;
  user_id: string;
  work_date: string;
  entry_count: number;
  total_minutes: number;
  approved_minutes: number;
  pending_minutes: number;
  first_clock_in: string;
  last_clock_out: string;
}

export interface HoursAlert {
  id: string;
  tenant_id: string;
  user_id: string;
  alert_date: string;
  total_minutes: number;
  limit_minutes: number;
  excess_minutes: number;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  // Joined data
  user_name?: string;
}

export interface DailyLimitCheck {
  total_minutes: number;
  limit_minutes: number;
  is_exceeded: boolean;
  remaining_minutes: number;
}

export type TimeEntryStatus = 'pending' | 'approved' | 'rejected';
export type WorkType = 'intervention' | 'transport' | 'administratif' | 'formation' | 'autre';

export const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'intervention', label: 'Intervention' },
  { value: 'transport', label: 'Transport' },
  { value: 'administratif', label: 'Administratif' },
  { value: 'formation', label: 'Formation' },
  { value: 'autre', label: 'Autre' },
];
