// Settings for daily hours management

const HOURS_SETTINGS_KEY = 'mv3_hours_settings';

export interface HoursSettings {
  maxDailyHours: number; // in minutes (default 8h30 = 510 minutes)
  alertThresholdMinutes: number; // Alert when X minutes remaining
}

const defaultSettings: HoursSettings = {
  maxDailyHours: 510, // 8h30 in minutes
  alertThresholdMinutes: 30, // Alert 30 minutes before max
};

export function getHoursSettings(): HoursSettings {
  try {
    const stored = localStorage.getItem(HOURS_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading hours settings:', e);
  }
  return defaultSettings;
}

export function saveHoursSettings(settings: Partial<HoursSettings>): HoursSettings {
  const current = getHoursSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(HOURS_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function formatMinutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function parseHMToMinutes(hm: string): number | null {
  // Accept formats: "8h30", "8:30", "8.5"
  let match = hm.match(/^(\d+)[h:](\d+)$/i);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  
  // Decimal format (8.5 = 8h30)
  const decimal = parseFloat(hm);
  if (!isNaN(decimal) && decimal >= 0 && decimal <= 24) {
    return Math.round(decimal * 60);
  }
  
  return null;
}

// Calculate total hours for a specific user on a specific date
export function calculateDailyHours(
  allInterventionHours: Array<{ dateStart: string; durationHours?: number; userId: number }>,
  userId: number,
  date: Date
): number {
  const dateStr = date.toISOString().split('T')[0];
  
  return allInterventionHours
    .filter(h => {
      const hourDate = h.dateStart.split('T')[0];
      return hourDate === dateStr && h.userId === userId;
    })
    .reduce((acc, h) => acc + (h.durationHours || 0) * 60, 0); // Return in minutes
}

export function checkDailyLimit(
  currentDailyMinutes: number,
  newMinutes: number,
  settings: HoursSettings = getHoursSettings()
): { 
  allowed: boolean; 
  warning: boolean; 
  message?: string; 
  exceededBy?: number;
  remainingMinutes: number;
} {
  const totalAfterNew = currentDailyMinutes + newMinutes;
  const remainingMinutes = settings.maxDailyHours - currentDailyMinutes;
  
  if (totalAfterNew > settings.maxDailyHours) {
    const exceededBy = totalAfterNew - settings.maxDailyHours;
    return {
      allowed: false,
      warning: true,
      message: `Dépassement de ${formatMinutesToHM(exceededBy)}. Limite: ${formatMinutesToHM(settings.maxDailyHours)}/jour`,
      exceededBy,
      remainingMinutes: Math.max(0, remainingMinutes),
    };
  }
  
  if (remainingMinutes <= settings.alertThresholdMinutes) {
    return {
      allowed: true,
      warning: true,
      message: `Attention: il vous reste ${formatMinutesToHM(remainingMinutes)} aujourd'hui`,
      remainingMinutes,
    };
  }
  
  return {
    allowed: true,
    warning: false,
    remainingMinutes,
  };
}
