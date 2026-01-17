import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Clock, User, Check, Bell } from 'lucide-react';
import { HoursAlert } from '@/types/timeTracking';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HoursAlertsPanelProps {
  alerts: HoursAlert[];
  onAcknowledge: (alertId: string) => Promise<void>;
}

export function HoursAlertsPanel({ alerts, onAcknowledge }: HoursAlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune alerte de dépassement</p>
      </div>
    );
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {alert.user_name || 'Inconnu'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(alert.alert_date), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-muted-foreground text-xs">Travaillé</p>
              <p className="font-bold text-destructive">{formatMinutes(alert.total_minutes)}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-muted-foreground text-xs">Limite</p>
              <p className="font-semibold">{formatMinutes(alert.limit_minutes)}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-muted-foreground text-xs">Dépassement</p>
              <p className="font-bold text-destructive">+{formatMinutes(alert.excess_minutes)}</p>
            </div>
          </div>

          <Button
            onClick={() => onAcknowledge(alert.id)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Check className="w-4 h-4 mr-2" />
            Acquitter l'alerte
          </Button>
        </div>
      ))}
    </div>
  );
}
