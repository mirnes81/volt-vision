// Intervention Reminders Service
// Gère les rappels pour les interventions à venir

import { showLocalNotification, scheduleNotification, cancelScheduledNotification } from './pushNotifications';

export interface ReminderSettings {
  enabled: boolean;
  timeBefore: number; // minutes before intervention
  dailySummary: boolean;
  dailySummaryTime: string; // HH:mm format
}

export interface ScheduledReminder {
  interventionId: number;
  interventionRef: string;
  clientName: string;
  dateStart: string;
  timerId: number | null;
  reminderTime: Date;
}

const REMINDER_SETTINGS_KEY = 'intervention_reminder_settings';
const SCHEDULED_REMINDERS_KEY = 'scheduled_reminders';

// Default settings
const defaultSettings: ReminderSettings = {
  enabled: true,
  timeBefore: 30, // 30 minutes avant
  dailySummary: true,
  dailySummaryTime: '07:00',
};

// Get reminder settings
export function getReminderSettings(): ReminderSettings {
  try {
    const stored = localStorage.getItem(REMINDER_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading reminder settings:', e);
  }
  return defaultSettings;
}

// Save reminder settings
export function saveReminderSettings(settings: ReminderSettings): void {
  localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

// Get scheduled reminders
export function getScheduledReminders(): ScheduledReminder[] {
  try {
    const stored = localStorage.getItem(SCHEDULED_REMINDERS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading scheduled reminders:', e);
  }
  return [];
}

// Save scheduled reminders
function saveScheduledReminders(reminders: ScheduledReminder[]): void {
  localStorage.setItem(SCHEDULED_REMINDERS_KEY, JSON.stringify(reminders));
}

// Active timer IDs (in-memory, not persisted)
const activeTimers: Map<number, number> = new Map();

// Schedule a reminder for an intervention
export function scheduleInterventionReminder(
  interventionId: number,
  interventionRef: string,
  clientName: string,
  dateStart: string,
  location?: string
): boolean {
  const settings = getReminderSettings();
  if (!settings.enabled) return false;

  const startDate = new Date(dateStart);
  if (isNaN(startDate.getTime())) {
    console.warn('Invalid date for reminder:', dateStart);
    return false;
  }

  // Calculate reminder time
  const reminderTime = new Date(startDate.getTime() - settings.timeBefore * 60 * 1000);
  const now = new Date();

  // Don't schedule if reminder time is in the past
  if (reminderTime <= now) {
    console.log('Reminder time already passed for:', interventionRef);
    return false;
  }

  // Cancel existing reminder for this intervention
  cancelInterventionReminder(interventionId);

  const delayMs = reminderTime.getTime() - now.getTime();
  
  // Schedule the notification
  const timerId = scheduleNotification(
    {
      title: '⏰ Intervention dans ' + settings.timeBefore + ' min',
      body: `${interventionRef} - ${clientName}${location ? '\n📍 ' + location : ''}`,
      tag: `reminder-${interventionId}`,
      data: { type: 'reminder', interventionId, interventionRef },
    },
    delayMs
  );

  // Store the timer
  activeTimers.set(interventionId, timerId);

  // Save to storage
  const reminders = getScheduledReminders().filter(r => r.interventionId !== interventionId);
  reminders.push({
    interventionId,
    interventionRef,
    clientName,
    dateStart,
    timerId: null, // Don't store timer ID, it's not valid after page reload
    reminderTime,
  });
  saveScheduledReminders(reminders);

  console.log(`Reminder scheduled for ${interventionRef} at ${reminderTime.toLocaleString()}`);
  return true;
}

// Cancel a scheduled reminder
export function cancelInterventionReminder(interventionId: number): void {
  const timerId = activeTimers.get(interventionId);
  if (timerId !== undefined) {
    cancelScheduledNotification(timerId);
    activeTimers.delete(interventionId);
  }

  const reminders = getScheduledReminders().filter(r => r.interventionId !== interventionId);
  saveScheduledReminders(reminders);
}

// Clear all reminders
export function clearAllReminders(): void {
  activeTimers.forEach((timerId) => {
    cancelScheduledNotification(timerId);
  });
  activeTimers.clear();
  saveScheduledReminders([]);
}

// Reschedule reminders on app start (after page reload)
export function rescheduleRemindersOnStart(): void {
  const settings = getReminderSettings();
  if (!settings.enabled) return;

  const reminders = getScheduledReminders();
  const now = new Date();
  const validReminders: ScheduledReminder[] = [];

  reminders.forEach(reminder => {
    const startDate = new Date(reminder.dateStart);
    if (isNaN(startDate.getTime())) return;

    const reminderTime = new Date(startDate.getTime() - settings.timeBefore * 60 * 1000);
    
    if (reminderTime > now) {
      // Reschedule
      const delayMs = reminderTime.getTime() - now.getTime();
      const timerId = scheduleNotification(
        {
          title: '⏰ Intervention dans ' + settings.timeBefore + ' min',
          body: `${reminder.interventionRef} - ${reminder.clientName}`,
          tag: `reminder-${reminder.interventionId}`,
          data: { type: 'reminder', interventionId: reminder.interventionId, interventionRef: reminder.interventionRef },
        },
        delayMs
      );
      activeTimers.set(reminder.interventionId, timerId);
      validReminders.push({ ...reminder, reminderTime });
      console.log(`Rescheduled reminder for ${reminder.interventionRef}`);
    }
  });

  saveScheduledReminders(validReminders);
}

// Show daily summary of today's interventions
export async function showDailySummary(interventions: Array<{
  id: number;
  ref: string;
  clientName: string;
  dateStart?: string;
}>): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayInterventions = interventions.filter(int => {
    if (!int.dateStart) return false;
    const date = new Date(int.dateStart);
    return date >= today && date < tomorrow;
  });

  if (todayInterventions.length === 0) return;

  const summary = todayInterventions.length === 1
    ? `1 intervention programmée`
    : `${todayInterventions.length} interventions programmées`;

  await showLocalNotification({
    title: '📅 Programme du jour',
    body: summary,
    tag: 'daily-summary',
    data: { type: 'daily-summary' },
  });
}

// Format time remaining in human readable format
export function formatTimeRemaining(dateStart: string): string {
  const start = new Date(dateStart);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Maintenant';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `Dans ${diffDays}j ${diffHours % 24}h`;
  }
  if (diffHours > 0) {
    return `Dans ${diffHours}h ${diffMins % 60}min`;
  }
  return `Dans ${diffMins}min`;
}

// Check if an intervention has a reminder scheduled
export function hasReminderScheduled(interventionId: number): boolean {
  return activeTimers.has(interventionId) || 
    getScheduledReminders().some(r => r.interventionId === interventionId);
}
