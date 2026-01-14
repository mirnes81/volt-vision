import { useState, useEffect } from 'react';
import { Clock, Bell, Calendar, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getReminderSettings,
  saveReminderSettings,
  rescheduleRemindersOnStart,
  clearAllReminders,
  getScheduledReminders,
  ReminderSettings as ReminderSettingsType,
} from '@/lib/interventionReminders';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const timeBeforeOptions = [
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 120, label: '2 heures avant' },
  { value: 1440, label: '1 jour avant' },
];

const dailySummaryTimeOptions = [
  { value: '06:00', label: '06:00' },
  { value: '06:30', label: '06:30' },
  { value: '07:00', label: '07:00' },
  { value: '07:30', label: '07:30' },
  { value: '08:00', label: '08:00' },
  { value: '08:30', label: '08:30' },
];

export function ReminderSettings() {
  const { isSupported, isSubscribed, permission } = usePushNotifications();
  const [settings, setSettings] = useState<ReminderSettingsType>(getReminderSettings);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setScheduledCount(getScheduledReminders().length);
  }, []);

  const handleSettingChange = async <K extends keyof ReminderSettingsType>(
    key: K, 
    value: ReminderSettingsType[K]
  ) => {
    setIsSaving(true);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveReminderSettings(newSettings);

    // Reschedule reminders with new settings
    if (key === 'enabled' || key === 'timeBefore') {
      if (newSettings.enabled) {
        rescheduleRemindersOnStart();
      } else {
        clearAllReminders();
      }
      setScheduledCount(getScheduledReminders().length);
    }

    setTimeout(() => {
      setIsSaving(false);
      toast.success('Paramètres sauvegardés');
    }, 300);
  };

  const handleClearReminders = () => {
    clearAllReminders();
    setScheduledCount(0);
    toast.success('Tous les rappels ont été supprimés');
  };

  const notificationsDisabled = !isSupported || !isSubscribed || permission === 'denied';

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          settings.enabled && !notificationsDisabled ? 'bg-primary/10' : 'bg-muted'
        }`}>
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          ) : (
            <Clock className="w-6 h-6 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Rappels d'interventions</h3>
          <p className="text-sm text-muted-foreground">
            {notificationsDisabled 
              ? 'Activez les notifications push d\'abord'
              : scheduledCount > 0 
                ? `${scheduledCount} rappel(s) programmé(s)`
                : 'Aucun rappel programmé'
            }
          </p>
        </div>
        <Switch
          checked={settings.enabled && !notificationsDisabled}
          onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
          disabled={notificationsDisabled}
        />
      </div>

      {notificationsDisabled && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
          <p className="text-sm text-warning-foreground">
            Pour utiliser les rappels, activez d'abord les notifications push ci-dessus.
          </p>
        </div>
      )}

      {/* Settings */}
      {settings.enabled && !notificationsDisabled && (
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Time Before */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Rappel avant l'intervention
            </label>
            <Select
              value={settings.timeBefore.toString()}
              onValueChange={(value) => handleSettingChange('timeBefore', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeBeforeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Daily Summary */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Résumé du jour</p>
                <p className="text-xs text-muted-foreground">
                  Notification matinale avec les interventions
                </p>
              </div>
            </div>
            <Switch
              checked={settings.dailySummary}
              onCheckedChange={(checked) => handleSettingChange('dailySummary', checked)}
            />
          </div>

          {/* Daily Summary Time */}
          {settings.dailySummary && (
            <div className="space-y-2 pl-6">
              <label className="text-sm text-muted-foreground">Heure du résumé</label>
              <Select
                value={settings.dailySummaryTime}
                onValueChange={(value) => handleSettingChange('dailySummaryTime', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dailySummaryTimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Scheduled reminders info */}
          {scheduledCount > 0 && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearReminders}
                className="w-full text-destructive hover:text-destructive"
              >
                Supprimer tous les rappels ({scheduledCount})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
