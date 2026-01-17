import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, Calendar, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention, InterventionStatus } from '@/types/intervention';
import { cn } from '@/lib/utils';

interface InterventionCardCompactProps {
  intervention: Intervention;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  a_planifier: { label: 'À planifier', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Clock },
  en_cours: { label: 'En cours', color: 'text-primary', bgColor: 'bg-primary/10', icon: Play },
  termine: { label: 'Terminé', color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle2 },
  facture: { label: 'Facturé', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: CheckCircle2 },
};

const typeColors: Record<string, string> = {
  installation: 'bg-primary',
  depannage: 'bg-destructive',
  renovation: 'bg-warning',
  tableau: 'bg-success',
  cuisine: 'bg-purple-500',
  oibt: 'bg-cyan-500',
};

const dayNames: Record<number, string> = {
  0: 'Dim',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
};

function formatDateTime(dateString?: string): { day: string; date: string; time: string | null } | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hasTime = hours !== 0 || minutes !== 0;
    
    return {
      day: dayNames[date.getDay()],
      date: date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }),
      time: hasTime ? date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : null,
    };
  } catch {
    return null;
  }
}

export function InterventionCardCompact({ intervention }: InterventionCardCompactProps) {
  const status = statusConfig[intervention.status] || statusConfig.a_planifier;
  const StatusIcon = status.icon;
  const dateInfo = formatDateTime(intervention.dateStart || intervention.datePlanned);
  const completedTasks = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalTasks = intervention.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const typeColor = typeColors[intervention.type] || 'bg-primary';
  const location = intervention.extraAdresse || intervention.location;

  return (
    <Link to={`/intervention/${intervention.id}`}>
      <article className="group relative bg-card rounded-xl p-3 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all duration-200">
        {/* Type indicator line */}
        <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", typeColor)} />
        
        <div className="pl-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold text-primary/80">{intervention.ref}</span>
                {intervention.priority === 'urgent' && (
                  <AlertTriangle className="w-3 h-3 text-destructive animate-pulse" />
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
                {intervention.clientName}
              </h3>
            </div>
            
            {/* Status badge */}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
              status.bgColor,
              status.color
            )}>
              <StatusIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{status.label}</span>
            </div>
          </div>
          
          {/* Label */}
          <p className="text-xs text-muted-foreground truncate mb-2">{intervention.label}</p>
          
          {/* Info row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            {/* Date & time */}
            {dateInfo && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" />
                <span className="font-medium">{dateInfo.day} {dateInfo.date}</span>
                {dateInfo.time && (
                  <span className="text-primary font-semibold">{dateInfo.time}</span>
                )}
              </div>
            )}
            
            {/* Location */}
            {location && (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{location}</span>
              </div>
            )}
            
            {/* Tasks progress */}
            {totalTasks > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium">{completedTasks}/{totalTasks}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Hover effect */}
        <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </article>
    </Link>
  );
}
