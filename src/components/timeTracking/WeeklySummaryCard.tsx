import * as React from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface WeeklySummaryCardProps {
  totalMinutes: number;
  limitMinutes: number;
  overtimeMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  weekStart?: Date;
}

export function WeeklySummaryCard({
  totalMinutes,
  limitMinutes,
  overtimeMinutes,
  approvedMinutes,
  pendingMinutes,
  weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }),
}: WeeklySummaryCardProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const progressPercent = Math.min(100, (totalMinutes / limitMinutes) * 100);
  const isExceeded = totalMinutes > limitMinutes;
  const regularMinutes = totalMinutes - overtimeMinutes;

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <span className="font-semibold">Semaine en cours</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM', { locale: fr })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Heures travaillées</span>
          <span className={cn('font-semibold', isExceeded && 'text-amber-500')}>
            {formatDuration(totalMinutes)} / {formatDuration(limitMinutes)}
          </span>
        </div>
        <Progress 
          value={progressPercent} 
          className={cn('h-3', isExceeded && '[&>div]:bg-amber-500')}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Regular hours */}
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span>Heures normales</span>
          </div>
          <p className="font-semibold text-lg">{formatDuration(regularMinutes)}</p>
        </div>

        {/* Overtime */}
        <div className={cn(
          'rounded-lg p-3',
          overtimeMinutes > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-secondary/50'
        )}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className={cn('w-4 h-4', overtimeMinutes > 0 && 'text-amber-500')} />
            <span>Heures sup.</span>
          </div>
          <p className={cn(
            'font-semibold text-lg',
            overtimeMinutes > 0 && 'text-amber-600 dark:text-amber-400'
          )}>
            {formatDuration(overtimeMinutes)}
          </p>
        </div>
      </div>

      {/* Approval status */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Approuvées:</span>
          <span className="font-medium">{formatDuration(approvedMinutes)}</span>
        </div>
        {pendingMinutes > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">En attente:</span>
            <span className="font-medium">{formatDuration(pendingMinutes)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
