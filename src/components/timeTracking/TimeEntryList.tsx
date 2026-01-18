import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, MapPin, CheckCircle, XCircle, AlertCircle, Trash2, TrendingUp } from 'lucide-react';
import { WorkTimeEntry, WORK_TYPES } from '@/types/timeTracking';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TimeEntryListProps {
  entries: WorkTimeEntry[];
  onDelete?: (entryId: string) => void;
  showUser?: boolean;
}

const statusConfig = {
  pending: { label: 'En attente', icon: AlertCircle, color: 'text-yellow-500 bg-yellow-500/10' },
  approved: { label: 'Approuvé', icon: CheckCircle, color: 'text-green-500 bg-green-500/10' },
  rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-500 bg-red-500/10' },
};

export function TimeEntryList({ entries, onDelete, showUser = false }: TimeEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune entrée de temps</p>
      </div>
    );
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--:--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const status = statusConfig[entry.status];
        const StatusIcon = status.icon;
        const workTypeLabel = WORK_TYPES.find(t => t.value === entry.work_type)?.label || entry.work_type;

        return (
          <div
            key={entry.id}
            className={cn(
              'bg-card border rounded-xl p-4 space-y-3',
              !entry.clock_out && 'border-primary ring-1 ring-primary/20'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {showUser && entry.user_name && (
                  <p className="font-semibold text-sm mb-1">{entry.user_name}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {workTypeLabel}
                  </Badge>
                  {entry.intervention_ref && (
                    <Badge variant="outline" className="text-xs">
                      {entry.intervention_ref}
                    </Badge>
                  )}
                  {(entry as any).is_overtime && (
                    <Badge className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Heure sup.
                    </Badge>
                  )}
                </div>
              </div>
              <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', status.color)}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Entrée</p>
                <p className="font-medium">{format(new Date(entry.clock_in), 'HH:mm', { locale: fr })}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Sortie</p>
                <p className="font-medium">
                  {entry.clock_out 
                    ? format(new Date(entry.clock_out), 'HH:mm', { locale: fr })
                    : <span className="text-primary animate-pulse">En cours...</span>
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Durée</p>
                <p className="font-semibold text-primary">{formatDuration(entry.duration_minutes)}</p>
              </div>
            </div>

            {/* Comment */}
            {entry.comment && (
              <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                {entry.comment}
              </p>
            )}

            {/* Rejection reason */}
            {entry.status === 'rejected' && entry.rejection_reason && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                <span className="font-medium">Motif : </span>
                {entry.rejection_reason}
              </div>
            )}

            {/* Location indicator */}
            {(entry.clock_in_latitude || entry.clock_out_latitude) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>Position enregistrée</span>
              </div>
            )}

            {/* Delete button (only for pending entries) */}
            {entry.status === 'pending' && !entry.clock_out && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(entry.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Supprimer
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
