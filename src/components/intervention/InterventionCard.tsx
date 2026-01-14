import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, User, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention } from '@/types/intervention';
import { cn } from '@/lib/utils';

interface InterventionCardProps {
  intervention: Intervention;
}

const typeLabels: Record<string, string> = {
  installation: 'Installation',
  depannage: 'Dépannage',
  renovation: 'Rénovation',
  tableau: 'Tableau',
  cuisine: 'Cuisine',
  oibt: 'OIBT',
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  a_planifier: { label: 'À planifier', color: 'bg-muted text-muted-foreground', icon: Clock },
  en_cours: { label: 'En cours', color: 'bg-primary/10 text-primary', icon: Play },
  termine: { label: 'Terminé', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  facture: { label: 'Facturé', color: 'bg-muted text-muted-foreground', icon: CheckCircle2 },
};

export function InterventionCard({ intervention }: InterventionCardProps) {
  const status = statusConfig[intervention.status] || statusConfig.a_planifier;
  const StatusIcon = status.icon;
  const completedTasks = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalTasks = intervention.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Truncate description for display
  const shortDescription = intervention.description 
    ? intervention.description.length > 80 
      ? intervention.description.substring(0, 80) + '...'
      : intervention.description
    : '';

  const briefing = intervention.briefing || shortDescription;
  const assigneeName = intervention.assignedTo 
    ? `${intervention.assignedTo.firstName} ${intervention.assignedTo.name}`.trim()
    : null;

  return (
    <Link to={`/intervention/${intervention.id}`}>
      <article className="bg-card rounded-2xl p-4 shadow-card card-hover border border-border/50">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {intervention.ref}
              </span>
              {intervention.priority === 'urgent' && (
                <span className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  Urgent
                </span>
              )}
            </div>
            <h3 className="font-bold text-foreground text-base leading-tight">{intervention.clientName}</h3>
            <p className="text-sm font-medium text-foreground/80 truncate">{intervention.label}</p>
          </div>
          
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
            status.color
          )}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </div>
        </div>

        {/* Briefing / Description */}
        {briefing && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="line-clamp-2">{briefing}</p>
          </div>
        )}

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">{intervention.location}</span>
        </div>

        {/* Assigned to */}
        {assigneeName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">Assigné à : <span className="font-medium text-foreground">{assigneeName}</span></span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-md">
            {typeLabels[intervention.type] || intervention.type}
          </span>
          
          {totalTasks > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
