import * as React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlySummaryCardProps {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  approvedMinutes: number;
  month?: Date;
}

export function MonthlySummaryCard({
  totalMinutes,
  regularMinutes,
  overtimeMinutes,
  approvedMinutes,
  month = new Date(),
}: MonthlySummaryCardProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

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
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-semibold">Récapitulatif du mois</span>
        </div>
        <span className="text-sm text-muted-foreground capitalize">
          {format(monthStart, 'MMMM yyyy', { locale: fr })}
        </span>
      </div>

      {/* Total */}
      <div className="text-center py-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
        <p className="text-sm text-muted-foreground mb-1">Total travaillé</p>
        <p className="text-3xl font-bold text-primary">{formatDuration(totalMinutes)}</p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Regular hours */}
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Normales</p>
            <p className="font-semibold">{formatDuration(regularMinutes)}</p>
          </div>
        </div>

        {/* Overtime */}
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          overtimeMinutes > 0 
            ? 'bg-amber-500/10 border border-amber-500/20' 
            : 'bg-secondary/50'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            overtimeMinutes > 0 ? 'bg-amber-500/20' : 'bg-secondary'
          )}>
            <TrendingUp className={cn(
              'w-5 h-5',
              overtimeMinutes > 0 ? 'text-amber-500' : 'text-muted-foreground'
            )} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Supplémentaires</p>
            <p className={cn(
              'font-semibold',
              overtimeMinutes > 0 && 'text-amber-600 dark:text-amber-400'
            )}>
              {formatDuration(overtimeMinutes)}
            </p>
          </div>
        </div>
      </div>

      {/* Approved info */}
      <div className="text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {formatDuration(approvedMinutes)} approuvées
        </span>
      </div>
    </div>
  );
}
