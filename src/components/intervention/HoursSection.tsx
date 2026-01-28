import * as React from 'react';
import { Clock, Plus, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Intervention, WorkerHour } from '@/types/intervention';
import { addManualHours } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { 
  getHoursSettings, 
  formatMinutesToHM, 
  parseHMToMinutes,
  checkDailyLimit 
} from '@/lib/hoursSettings';
import { getCurrentWorker } from '@/lib/api';

interface HoursSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function HoursSection({ intervention, onUpdate }: HoursSectionProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [hoursInput, setHoursInput] = React.useState('');
  const [dailyTotal, setDailyTotal] = React.useState(0);
  const settings = getHoursSettings();
  
  // Calculate daily total for current user
  React.useEffect(() => {
    const worker = getCurrentWorker();
    if (!worker) return;
    
    const today = new Date().toISOString().split('T')[0];
    const todayHours = intervention.hours
      .filter(h => {
        const hourDate = h.dateStart.split('T')[0];
        return hourDate === today && h.userId === worker.id;
      })
      .reduce((acc, h) => acc + (h.durationHours || 0), 0);
    
    setDailyTotal(Math.round(todayHours * 60)); // Convert to minutes
  }, [intervention.hours]);
  
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };
  
  const handleAddHours = async () => {
    if (!hoursInput.trim()) {
      toast.error('Veuillez entrer un nombre d\'heures');
      return;
    }
    
    const minutes = parseHMToMinutes(hoursInput);
    if (minutes === null || minutes <= 0) {
      toast.error('Format invalide. Ex: 2h30, 2:30 ou 2.5');
      return;
    }
    
    // Check daily limit
    const limitCheck = checkDailyLimit(dailyTotal, minutes, settings);
    
    if (!limitCheck.allowed) {
      toast.error(limitCheck.message, {
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
        duration: 5000,
      });
      // Notify admin would happen here via webhook or notification system
      console.warn('ADMIN ALERT: Hours exceeded for user', {
        interventionId: intervention.id,
        exceededBy: limitCheck.exceededBy,
      });
      return;
    }
    
    if (limitCheck.warning) {
      toast.warning(limitCheck.message, {
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      });
    }
    
    setIsLoading(true);
    try {
      const now = new Date();
      const hoursDecimal = minutes / 60;
      const endTime = new Date(now.getTime() + minutes * 60 * 1000);
      
      await addManualHours(intervention.id, {
        dateStart: now.toISOString(),
        dateEnd: endTime.toISOString(),
        workType: intervention.type,
        comment: `Saisie manuelle: ${formatMinutesToHM(minutes)}`,
      });
      
      toast.success(`${formatMinutesToHM(minutes)} ajoutées`);
      setHoursInput('');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout des heures');
    } finally {
      setIsLoading(false);
    }
  };
  
  const totalHours = intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0);
  const remainingMinutes = Math.max(0, settings.maxDailyHours - dailyTotal);
  const isNearLimit = remainingMinutes <= settings.alertThresholdMinutes;

  return (
    <div className="space-y-3">
      {/* Hours Input - Compact */}
      <div className="bg-card rounded-xl p-3 shadow-card border border-border/50">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Heures facturables
        </h3>
        
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Ex: 2h30"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            className="flex-1 h-10 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddHours()}
          />
          <Button
            variant="worker-success"
            size="icon"
            onClick={handleAddHours}
            disabled={isLoading || !hoursInput.trim()}
            className="h-10 w-10"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Daily limit info - Compact */}
        <div className={cn(
          "mt-2.5 p-2 rounded-lg flex items-center gap-2",
          isNearLimit ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-secondary/50"
        )}>
          {isNearLimit ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-medium">
              Aujourd'hui: {formatMinutesToHM(dailyTotal)} / {formatMinutesToHM(settings.maxDailyHours)}
            </p>
            <p className="text-muted-foreground">
              Reste: {formatMinutesToHM(remainingMinutes)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Total - Compact */}
      <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
        <Clock className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Total:</p>
          <p className="text-base font-bold">{formatDuration(totalHours)}</p>
        </div>
      </div>
      
      {/* Hours History - Compact */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground px-1">Historique</h4>
        {intervention.hours.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Aucune heure enregistrée
          </p>
        ) : (
          <div className="space-y-1.5">
            {intervention.hours.map((hour) => (
              <div
                key={hour.id}
                className="bg-card rounded-lg p-2 border border-border/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-xs">
                      {new Date(hour.dateStart).toLocaleDateString('fr-CH')}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                      {hour.comment || hour.workType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatDuration(hour.durationHours || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">{hour.userName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
