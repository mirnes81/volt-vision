import { useState } from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, User, FileText, Hash, Calendar, Building2, Key, Lock, Home, Gauge, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention, InterventionStatus } from '@/types/intervention';
import { cn } from '@/lib/utils';
import { updateInterventionStatus } from '@/lib/dolibarrApi';
import { toast } from 'sonner';

interface InterventionCardProps {
  intervention: Intervention;
  onStatusChange?: (interventionId: number, newStatus: InterventionStatus) => void;
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

const statusOptions: { value: InterventionStatus; label: string }[] = [
  { value: 'a_planifier', label: 'À planifier' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'facture', label: 'Facturé' },
];

const dayNames: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

function formatDateWithDay(dateString?: string): { date: string; time: string | null } | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const dayName = dayNames[date.getDay()];
    const formattedDate = date.toLocaleDateString('fr-CH', {
      day: 'numeric',
      month: 'short',
    });
    
    // Format time (only if not midnight - which usually means no time was set)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hasTime = hours !== 0 || minutes !== 0;
    const formattedTime = hasTime 
      ? date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
      : null;
    
    return { 
      date: `${dayName} ${formattedDate}`, 
      time: formattedTime 
    };
  } catch {
    return null;
  }
}

// Check if user is admin
function isUserAdmin(): boolean {
  const workerData = localStorage.getItem('mv3_worker');
  if (!workerData) return false;
  try {
    const worker = JSON.parse(workerData);
    return worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
  } catch {
    return false;
  }
}

export function InterventionCard({ intervention, onStatusChange }: InterventionCardProps) {
  const [currentStatus, setCurrentStatus] = useState<InterventionStatus>(intervention.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const isAdmin = isUserAdmin();
  const status = statusConfig[currentStatus] || statusConfig.a_planifier;
  const StatusIcon = status.icon;
  const completedTasks = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalTasks = intervention.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Use dateStart or datePlanned for the intervention date
  const interventionDate = formatDateWithDay(intervention.dateStart || intervention.datePlanned);

  const briefing = intervention.briefing || intervention.description;
  const assigneeName = intervention.assignedTo 
    ? `${intervention.assignedTo.firstName} ${intervention.assignedTo.name}`.trim()
    : null;

  // Intervention extrafields
  const hasBon = intervention.extraBon && intervention.extraBon.trim();
  const hasExtraAdresse = intervention.extraAdresse && intervention.extraAdresse.trim();
  const hasExtraContact = intervention.extraContact && intervention.extraContact.trim();
  const hasExtraCle = intervention.extraCle && intervention.extraCle.trim();
  const hasExtraCode = intervention.extraCode && intervention.extraCode.trim();
  const hasExtraNoImm = intervention.extraNoImm && intervention.extraNoImm.trim();
  const hasExtraAdresseComplete = intervention.extraAdresseComplete && intervention.extraAdresseComplete.trim();
  const hasExtraNCompt = intervention.extraNCompt && intervention.extraNCompt.trim();

  const handleStatusChange = async (e: React.MouseEvent, newStatus: InterventionStatus) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (newStatus === currentStatus || isUpdating) return;
    
    setIsUpdating(true);
    setShowDropdown(false);
    
    try {
      await updateInterventionStatus(intervention.id, newStatus);
      setCurrentStatus(newStatus);
      onStatusChange?.(intervention.id, newStatus);
      toast.success(`Statut modifié: ${statusConfig[newStatus].label}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleDropdownClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(false);
  };

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
          
          {/* Right side: Status (editable for admin) + Bon number */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 relative">
            {isAdmin ? (
              <div className="relative">
                <button
                  onClick={handleDropdownToggle}
                  disabled={isUpdating}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                    status.color,
                    isUpdating && "opacity-50 cursor-not-allowed",
                    !isUpdating && "hover:ring-2 hover:ring-primary/30 cursor-pointer"
                  )}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {isUpdating ? 'Mise à jour...' : status.label}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showDropdown && "rotate-180")} />
                </button>
                
                {/* Dropdown menu */}
                {showDropdown && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={handleDropdownClose}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                      {statusOptions.map((option) => {
                        const optConfig = statusConfig[option.value];
                        const OptIcon = optConfig.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={(e) => handleStatusChange(e, option.value)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors text-left",
                              option.value === currentStatus && "bg-secondary"
                            )}
                          >
                            <OptIcon className="w-3.5 h-3.5" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                status.color
              )}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </div>
            )}
            {hasBon && (
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                <Hash className="w-3 h-3" />
                <span>Bon: {intervention.extraBon}</span>
              </div>
            )}
          </div>
        </div>

        {/* Date with day of week and time */}
        {interventionDate && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Calendar className="w-4 h-4 shrink-0 text-primary" />
            <span className="font-semibold text-foreground">{interventionDate.date}</span>
            {interventionDate.time && (
              <span className="text-primary font-medium">• {interventionDate.time}</span>
            )}
          </div>
        )}

        {/* Briefing / Description - show more text */}
        {briefing && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="line-clamp-3">{briefing}</p>
          </div>
        )}

        {/* Extra Adresse (from intervention extrafield) */}
        {hasExtraAdresse && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{intervention.extraAdresse}</span>
          </div>
        )}

        {/* Fallback to client address if no extra adresse */}
        {!hasExtraAdresse && intervention.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{intervention.location}</span>
          </div>
        )}

        {/* Extra Contact / Concierge (from intervention extrafield) */}
        {hasExtraContact && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Building2 className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate font-medium">Concierge: {intervention.extraContact}</span>
          </div>
        )}

        {/* N° immeuble / Appartement */}
        {hasExtraNoImm && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Home className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate font-medium">Immeuble/Appt: {intervention.extraNoImm}</span>
          </div>
        )}

        {/* Adresse complète */}
        {hasExtraAdresseComplete && !hasExtraAdresse && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="w-4 h-4 shrink-0 text-accent" />
            <span className="truncate">{intervention.extraAdresseComplete}</span>
          </div>
        )}

        {/* N° compteur */}
        {hasExtraNCompt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Gauge className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate font-medium">Compteur: {intervention.extraNCompt}</span>
          </div>
        )}

        {/* Access codes (clé, code) */}
        {(hasExtraCle || hasExtraCode) && (
          <div className="flex items-center gap-3 text-sm mb-2 flex-wrap">
            {hasExtraCle && (
              <div className="flex items-center gap-1.5 text-muted-foreground bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-md">
                <Key className="w-3 h-3" />
                <span className="text-xs font-medium">Clé: {intervention.extraCle}</span>
              </div>
            )}
            {hasExtraCode && (
              <div className="flex items-center gap-1.5 text-muted-foreground bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-md">
                <Lock className="w-3 h-3" />
                <span className="text-xs font-medium">Code: {intervention.extraCode}</span>
              </div>
            )}
          </div>
        )}

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
