import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, Calendar, User, Building, Phone, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention, InterventionStatus } from '@/types/intervention';
import { InterventionAssignment } from '@/types/assignments';
import { cn } from '@/lib/utils';
import { getDateOverride } from '@/components/intervention/DateEditDialog';

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

  return (
    <Link to={`/intervention/${intervention.id}`}>
      <article className={cn(
        "group relative bg-card rounded-xl p-3 shadow-sm border transition-all duration-200",
        urgent 
          ? "border-destructive/50 hover:border-destructive hover:shadow-destructive/20" 
          : "border-border/50 hover:border-primary/30 hover:shadow-md"
      )}>
        {/* Type indicator line */}
        <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", typeColor)} />
        
        {/* Urgent banner */}
        {urgent && (
          <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground px-2 py-0.5 rounded-bl-lg rounded-tr-lg text-[10px] font-bold flex items-center gap-1 shadow-sm">
            <AlertTriangle className="w-3 h-3" />
            URGENT
          </div>
        )}
        
        <div className="pl-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold text-primary/80">{intervention.ref}</span>
                {intervention.extraBon && (
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    # {intervention.extraBon}
                  </span>
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
              status.color,
              urgent && "mt-3" // Push down if urgent banner
            )}>
              <StatusIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{status.label}</span>
            </div>
          </div>
          
          {/* Label */}
          <p className="text-xs text-muted-foreground truncate mb-2">{intervention.label}</p>
          
          {/* Location & Contact info */}
          <div className="flex flex-col gap-1 mb-2">
            {/* Date & location row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {dateInfo && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-primary" />
                  <span className="font-medium">{dateInfo.day} {dateInfo.date}</span>
                  {dateInfo.time && (
                    <span className="text-primary font-semibold">{dateInfo.time}</span>
                  )}
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[150px]">{location}</span>
                </div>
              )}
            </div>
            
            {/* Concierge/Immeuble info */}
            {(intervention.extraConcierge || intervention.extraNoImm || intervention.extraAppartement) && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                {intervention.extraConcierge && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-primary/70" />
                    <span className="truncate max-w-[150px]">Concierge: {intervention.extraConcierge}</span>
                  </div>
                )}
                {intervention.extraNoImm && (
                  <div className="flex items-center gap-1">
                    <Building className="w-3 h-3 text-primary/70" />
                    <span>Imm: {intervention.extraNoImm}</span>
                  </div>
                )}
                {intervention.extraAppartement && (
                  <div className="flex items-center gap-1">
                    <span>🚪 Appt: {intervention.extraAppartement}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer: Assigned worker + Tasks progress */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            {/* Assigned workers - Priority to Supabase assignments */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {supabaseAssignments.length > 0 ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3 text-primary" />
                  <div className="flex items-center gap-1 truncate">
                    {supabaseAssignments.slice(0, 2).map((a, idx) => (
                      <span 
                        key={a.id} 
                        className={cn(
                          "font-medium",
                          a.is_primary && "text-primary",
                          a.priority === 'urgent' && "text-warning",
                          a.priority === 'critical' && "text-destructive"
                        )}
                      >
                        {a.user_name.split(' ')[0]}{idx < Math.min(supabaseAssignments.length - 1, 1) ? ',' : ''}
                      </span>
                    ))}
                    {supabaseAssignments.length > 2 && (
                      <span className="text-muted-foreground">+{supabaseAssignments.length - 2}</span>
                    )}
                  </div>
                </div>
              ) : intervention.assignedTo ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span className="font-medium">
                    {intervention.assignedTo.firstName || intervention.assignedTo.name}
                    {totalHours > 0 && (
                      <span className="ml-1 text-primary">({totalHours.toFixed(1)}h)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-destructive">
                  <User className="w-3 h-3" />
                  <span className="font-semibold">Non assigné</span>
                </div>
              )}
            </div>
            
            {/* Type label + Tasks progress */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground capitalize">
                {intervention.type}
              </span>
              {totalTasks > 0 && (
                <div className="flex items-center gap-1.5">
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
        </div>
        
        {/* Hover effect */}
        <div className={cn(
          "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
          urgent ? "bg-destructive/5" : "bg-primary/5"
        )} />
      </article>
    </Link>
  );
}
