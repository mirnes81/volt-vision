export interface InterventionAssignment {
  id: string;
  tenant_id: string;
  intervention_id: number | null;
  autonomous_intervention_id: string | null;
  intervention_ref: string;
  intervention_label: string;
  user_id: string;
  user_name: string;
  is_primary: boolean;
  priority: 'normal' | 'urgent' | 'critical';
  date_planned: string | null;
  location: string | null;
  client_name: string | null;
  notification_sent: boolean;
  notification_acknowledged: boolean;
  acknowledged_at: string | null;
  last_reminder_sent: string | null;
  reminder_count: number;
  assigned_by: string | null;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export interface UrgentNotification {
  assignment: InterventionAssignment;
  isNew: boolean;
  isReminder: boolean;
}
