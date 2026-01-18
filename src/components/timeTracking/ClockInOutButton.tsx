import * as React from 'react';
import { Play, Square, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClockInOutButtonProps {
  interventionId?: number;
  interventionRef?: string;
  workType?: string;
  className?: string;
  compact?: boolean;
}

export function ClockInOutButton({
  interventionId,
  interventionRef,
  workType = 'intervention',
  className,
  compact = false,
}: ClockInOutButtonProps) {
  const { isClockedIn, activeEntry, dailyLimit, clockIn, clockOut, isLoading } = useTimeTracking();
  const [isActing, setIsActing] = React.useState(false);
  const [location, setLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [elapsedTime, setElapsedTime] = React.useState('00:00:00');

  // Get current location
  React.useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Geolocation error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Update elapsed time
  React.useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00');
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeEntry.clock_in);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const handleAction = async () => {
    setIsActing(true);
    try {
      if (isClockedIn) {
        await clockOut({
          latitude: location?.lat,
          longitude: location?.lng,
        });
      } else {
        await clockIn({
          work_type: workType,
          intervention_id: interventionId,
          intervention_ref: interventionRef,
          latitude: location?.lat,
          longitude: location?.lng,
        });
      }
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <Button disabled className={className}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (compact) {
    return (
      <Button
        onClick={handleAction}
        disabled={isActing}
        variant={isClockedIn ? 'destructive' : 'default'}
        size="sm"
        className={cn('gap-2', className)}
      >
        {isActing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isClockedIn ? (
          <>
            <Square className="w-4 h-4" />
            Arrêter
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Pointer
          </>
        )}
      </Button>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main button */}
      <Button
        onClick={handleAction}
        disabled={isActing}
        variant={isClockedIn ? 'destructive' : 'default'}
        size="lg"
        className="w-full gap-3 h-14 text-lg font-semibold shadow-lg"
      >
        {isActing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isClockedIn ? (
          <>
            <Square className="w-6 h-6" />
            Arrêter le pointage
          </>
        ) : (
          <>
            <Play className="w-6 h-6" />
            Commencer le pointage
          </>
        )}
      </Button>

      {/* Status info */}
      {isClockedIn && activeEntry && (
        <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">En cours depuis</span>
            <span className="font-mono text-lg font-bold text-primary">{elapsedTime}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Début</span>
            <span>{format(new Date(activeEntry.clock_in), 'HH:mm', { locale: fr })}</span>
          </div>
          {activeEntry.intervention_ref && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Intervention</span>
              <span className="font-medium">{activeEntry.intervention_ref}</span>
            </div>
          )}
        </div>
      )}

      {/* Daily summary */}
      {dailyLimit && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Travaillé aujourd'hui</span>
            <span className={cn(
              'font-semibold',
              dailyLimit.is_exceeded ? 'text-destructive' : 'text-foreground'
            )}>
              {Math.floor(dailyLimit.total_minutes / 60)}h{(dailyLimit.total_minutes % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                dailyLimit.is_exceeded ? 'bg-destructive' : 'bg-primary'
              )}
              style={{
                width: `${Math.min(100, (dailyLimit.total_minutes / dailyLimit.limit_minutes) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0h</span>
            <span>Limite: {Math.floor(dailyLimit.limit_minutes / 60)}h{(dailyLimit.limit_minutes % 60).toString().padStart(2, '0')}</span>
          </div>
          {dailyLimit.is_exceeded && (
            <div className="text-xs text-destructive font-medium pt-1">
              ⚠️ Limite dépassée de {Math.floor((dailyLimit.total_minutes - dailyLimit.limit_minutes) / 60)}h{((dailyLimit.total_minutes - dailyLimit.limit_minutes) % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      )}

      {/* Location indicator */}
      {location && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>Position GPS activée</span>
        </div>
      )}
    </div>
  );
}
