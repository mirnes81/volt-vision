import { useState, useEffect } from 'react';
import { Play, Square, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention, WorkerHour } from '@/types/intervention';
import { startHours, stopHours, addManualHours } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HoursSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function HoursSection({ intervention, onUpdate }: HoursSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  // Find active (running) hour entry
  const activeHour = intervention.hours.find(h => h.dateStart && !h.dateEnd);
  
  // Timer for active hour
  useEffect(() => {
    if (!activeHour) {
      setElapsed(0);
      return;
    }
    
    const start = new Date(activeHour.dateStart).getTime();
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeHour]);
  
  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };
  
  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startHours(intervention.id, intervention.type);
      toast.success('Chrono démarré');
      onUpdate();
    } catch (error) {
      toast.error('Erreur au démarrage');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStop = async () => {
    if (!activeHour) return;
    setIsLoading(true);
    try {
      await stopHours(intervention.id, activeHour.id);
      toast.success('Chrono arrêté');
      onUpdate();
    } catch (error) {
      toast.error('Erreur à l\'arrêt');
    } finally {
      setIsLoading(false);
    }
  };
  
  const totalHours = intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0);

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
        {activeHour ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">En cours depuis</p>
            <p className="text-4xl font-bold text-primary font-mono mb-4">
              {formatElapsed(elapsed)}
            </p>
            <Button
              variant="worker-danger"
              size="full"
              onClick={handleStop}
              disabled={isLoading}
              className="gap-3"
            >
              <Square className="w-6 h-6" />
              Arrêter le chrono
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-2">Prêt à commencer</p>
            <p className="text-4xl font-bold text-muted-foreground font-mono mb-4">
              00:00:00
            </p>
            <Button
              variant="worker-success"
              size="full"
              onClick={handleStart}
              disabled={isLoading}
              className="gap-3"
            >
              <Play className="w-6 h-6" />
              Démarrer le chrono
            </Button>
          </>
        )}
      </div>
      
      {/* Total & Manual Entry */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-secondary/50 rounded-xl px-4 py-3 flex-1">
          <Clock className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total cumulé</p>
            <p className="text-lg font-bold">{formatDuration(totalHours)}</p>
          </div>
        </div>
        
        <Button
          variant="worker-outline"
          size="icon-lg"
          onClick={() => setShowManual(!showManual)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
      
      {/* Hours History */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground px-1">Historique</h4>
        {intervention.hours.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune heure enregistrée
          </p>
        ) : (
          <div className="space-y-2">
            {intervention.hours.map((hour) => (
              <div
                key={hour.id}
                className={cn(
                  "bg-card rounded-xl p-3 border border-border/50",
                  !hour.dateEnd && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {new Date(hour.dateStart).toLocaleDateString('fr-CH')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(hour.dateStart).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                      {hour.dateEnd && ` - ${new Date(hour.dateEnd).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {hour.durationHours ? (
                      <p className="font-bold">{formatDuration(hour.durationHours)}</p>
                    ) : (
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                        En cours
                      </span>
                    )}
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
