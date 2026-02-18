import * as React from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, Calendar, User, Building, Phone, Users, Wrench, RotateCcw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention, InterventionStatus } from '@/types/intervention';
import { InterventionAssignment } from '@/types/assignments';
import { cn } from '@/lib/utils';
import { getDateOverride } from '@/components/intervention/DateEditDialog';
import { loadOperationalStatus, OPERATIONAL_STATUS_CONFIG, OperationalStatus } from '@/components/intervention/OperationalStatusSelector';

interface InterventionCardCompactProps {
  intervention: Intervention;
  supabaseAssignments?: InterventionAssignment[];
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

// Check if intervention is urgent based on priority or label/description
function isUrgent(intervention: Intervention): boolean {
  if (intervention.priority === 'urgent' || intervention.priority === 'critical') return true;
  const textToCheck = `${intervention.label} ${intervention.description}`.toLowerCase();
  return textToCheck.includes('urgent');
}

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

export function InterventionCardCompact({ intervention, supabaseAssignments = [] }: InterventionCardCompactProps) {
  const status = statusConfig[intervention.status] || statusConfig.a_planifier;
  const StatusIcon = status.icon;
  const [opStatus, setOpStatus] = React.useState<OperationalStatus | null>(null);

  React.useEffect(() => {
    loadOperationalStatus(intervention.id).then(s => setOpStatus(s));
  }, [intervention.id]);

  // Use local override if exists, otherwise dateStart or datePlanned
  const localOverride = getDateOverride(intervention.id);
  const dateInfo = formatDateTime(localOverride || intervention.dateStart || intervention.datePlanned);
  const completedTasks = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalTasks = intervention.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const typeColor = typeColors[intervention.type] || 'bg-primary';
  const location = intervention.extraAdresse || intervention.location;
  const urgent = isUrgent(intervention);
  
  // Worker hours summary for this intervention
  const totalHours = intervention.hours?.reduce((sum, h) => sum + (h.durationHours || 0), 0) || 0;

  const opConfig = opStatus ? OPERATIONAL_STATUS_CONFIG[opStatus] : null;

  return (
    <Link to={`/intervention/${intervention.id}`}>
      <article className={cn(
        "group relative bg-card rounded-lg p-2 shadow-sm border transition-all duration-200",
        urgent 
          ? "border-destructive/50 hover:border-destructive" 
          : "border-border/50 hover:border-primary/30"
      )}>
        {/* Type indicator line */}
        <div className={cn("absolute left-0 top-2 bottom-2 w-0.5 rounded-full", typeColor)} />
        
        {/* Urgent banner - smaller */}
        {urgent && (
          <div className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-bl-md rounded-tr-md text-[8px] font-bold flex items-center gap-0.5 shadow-sm">
            <AlertTriangle className="w-2.5 h-2.5" />
            URGENT
          </div>
        )}
        
        <div className="pl-2.5">
          {/* Header row - compact */}
          <div className="flex items-start justify-between gap-1.5 mb-0.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-primary/80">{intervention.ref}</span>
                {intervention.extraBon && (
                  <span className="text-[8px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded">
                    #{intervention.extraBon}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-xs text-foreground truncate leading-tight">
                {intervention.clientName}
              </h3>
            </div>
            
            {/* Status badges */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {/* Dolibarr status - small dot only */}
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold",
                status.bgColor,
                status.color,
                urgent && "mt-2"
              )}>
                <StatusIcon className="w-2.5 h-2.5" />
              </div>
              {/* Operational status badge */}
              {opConfig && opStatus !== 'a_faire' && (
                <div className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold",
                  opConfig.bgColor,
                  opConfig.color
                )}>
                  {React.createElement(opConfig.icon, { className: "w-2.5 h-2.5" })}
                  <span className="leading-none">{opConfig.label.replace(' ✓', '')}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Label - compact */}
          <p className="text-[10px] text-muted-foreground truncate mb-1">{intervention.label}</p>
          
          {/* Date & location - single compact row */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
            {dateInfo && (
              <div className="flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5 text-primary" />
                <span className="font-medium">{dateInfo.day} {dateInfo.date}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-0.5 min-w-0 flex-1">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
          
          {/* Footer: Assigned worker + Tasks progress - compact */}
          <div className="flex items-center justify-between gap-1 text-[10px]">
            {/* Assigned workers */}
            <div className="flex items-center gap-0.5 min-w-0 flex-1">
              {supabaseAssignments.length > 0 ? (
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <Users className="w-2.5 h-2.5 text-primary" />
                  <div className="flex items-center gap-0.5 truncate">
                    {supabaseAssignments.slice(0, 2).map((a, idx) => (
                      <span 
                        key={a.id} 
                        className={cn(
                          "font-medium text-[9px]",
                          a.is_primary && "text-primary"
                        )}
                      >
                        {a.user_name.split(' ')[0]}{idx < Math.min(supabaseAssignments.length - 1, 1) ? ',' : ''}
                      </span>
                    ))}
                    {supabaseAssignments.length > 2 && (
                      <span className="text-muted-foreground text-[9px]">+{supabaseAssignments.length - 2}</span>
                    )}
                  </div>
                </div>
              ) : intervention.assignedTo ? (
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <User className="w-2.5 h-2.5" />
                  <span className="font-medium text-[9px]">
                    {intervention.assignedTo.firstName || intervention.assignedTo.name}
                    {totalHours > 0 && (
                      <span className="ml-0.5 text-primary">({totalHours.toFixed(1)}h)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 text-destructive">
                  <User className="w-2.5 h-2.5" />
                  <span className="font-semibold text-[9px]">Non assigné</span>
                </div>
              )}
            </div>
            
            {/* Type + Tasks progress */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground capitalize">
                {intervention.type}
              </span>
              {totalTasks > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-medium">{completedTasks}/{totalTasks}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
