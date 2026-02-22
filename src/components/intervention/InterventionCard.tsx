import * as React from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle2, Play, User, Users, FileText, Hash, Calendar, Building2, Key, Lock, Home, Gauge, ChevronDown, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention, InterventionStatus } from '@/types/intervention';
import { InterventionAssignment } from '@/types/assignments';
import { cn } from '@/lib/utils';
import { updateInterventionStatus } from '@/lib/dolibarrApi';
import { toast } from '@/components/ui/sonner';
import { getDateOverride } from '@/components/intervention/DateEditDialog';
interface InterventionCardProps {
  intervention: Intervention;
  supabaseAssignments?: InterventionAssignment[];
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

// Per-technician color palette (same as CalendarPage)
const TECH_BORDER_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-cyan-500',
  'border-l-rose-500',
  'border-l-teal-500',
  'border-l-orange-500',
  'border-l-indigo-500',
  'border-l-pink-500',
];

const TECH_TEXT_COLORS = [
  'text-blue-600',
  'text-emerald-600',
  'text-violet-600',
  'text-amber-600',
  'text-cyan-600',
  'text-rose-600',
  'text-teal-600',
  'text-orange-600',
  'text-indigo-600',
  'text-pink-600',
];

// Simple hash to get a consistent color index for a name
function getColorIndexForName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % TECH_BORDER_COLORS.length;
}

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
  // Check both localStorage keys for compatibility
  const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
  if (!workerData) {
    console.log('[InterventionCard] No worker data found in localStorage');
    return false;
  }
  try {
    const worker = JSON.parse(workerData);
    const isAdmin = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
    console.log('[InterventionCard] Admin check:', { admin: worker?.admin, isAdmin: worker?.isAdmin, result: isAdmin });
    return isAdmin;
  } catch (e) {
    console.error('[InterventionCard] Error parsing worker data:', e);
    return false;
  }
}

export function InterventionCard({ intervention, supabaseAssignments = [], onStatusChange }: InterventionCardProps) {
  const [currentStatus, setCurrentStatus] = React.useState<InterventionStatus>(intervention.status);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  
  const isAdmin = isUserAdmin();
  const status = statusConfig[currentStatus] || statusConfig.a_planifier;
  const StatusIcon = status.icon;
  const completedTasks = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalTasks = intervention.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Use local override if exists, otherwise dateStart or datePlanned
  const localOverride = getDateOverride(intervention.id);
  const interventionDate = formatDateWithDay(localOverride || intervention.dateStart || intervention.datePlanned);

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


  // Determine assigned tech color
  const primaryAssignment = supabaseAssignments.find(a => a.is_primary) || supabaseAssignments[0];
  const assignedTechName = primaryAssignment?.user_name || assigneeName;
  const techColorIdx = assignedTechName ? getColorIndexForName(assignedTechName) : -1;
  const borderColor = techColorIdx >= 0 ? TECH_BORDER_COLORS[techColorIdx] : '';
  const techTextColor = techColorIdx >= 0 ? TECH_TEXT_COLORS[techColorIdx] : '';

  return (
    <Link to={`/intervention/${intervention.id}`}>
      <article className={cn(
        "bg-card rounded-lg p-2.5 shadow-sm border border-border/50 transition-all hover:border-primary/30",
        borderColor && `border-l-4 ${borderColor}`
      )}>
        {/* Header - Compact */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {intervention.ref}
              </span>
              {intervention.priority === 'urgent' && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Urgent
                </span>
              )}
            </div>
            <h3 className="font-bold text-foreground text-sm leading-tight truncate">{intervention.clientName}</h3>
            <p className="text-xs text-foreground/80 truncate">{intervention.label}</p>
          </div>
          
          {/* Right side: Status (editable for admin) + Bon number */}
          <div className="flex flex-col items-end gap-1 shrink-0 relative">
            {isAdmin ? (
              <div className="relative">
                <button
                  onClick={handleDropdownToggle}
                  disabled={isUpdating}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all",
                    status.color,
                    isUpdating && "opacity-50 cursor-not-allowed",
                    !isUpdating && "hover:ring-2 hover:ring-primary/30 cursor-pointer"
                  )}
                >
                  <StatusIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{status.label}</span>
                  <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showDropdown && "rotate-180")} />
                </button>
                
                {/* Dropdown menu */}
                {showDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={handleDropdownClose}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                      {statusOptions.map((option) => {
                        const optConfig = statusConfig[option.value];
                        const OptIcon = optConfig.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={(e) => handleStatusChange(e, option.value)}
                            className={cn(
                              "w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium hover:bg-secondary/80 transition-colors text-left",
                              option.value === currentStatus && "bg-secondary"
                            )}
                          >
                            <OptIcon className="w-3 h-3" />
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
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                status.color
              )}>
                <StatusIcon className="w-3 h-3" />
              </div>
            )}
            {hasBon && (
              <div className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                <Hash className="w-2.5 h-2.5" />
                <span>{intervention.extraBon}</span>
              </div>
            )}
          </div>
        </div>

        {/* Date with day of week and time - Compact */}
        {interventionDate && (
          <div className="flex items-center gap-1.5 text-[11px] mb-1">
            <Calendar className="w-3 h-3 shrink-0 text-primary" />
            <span className="font-medium text-foreground">{interventionDate.date}</span>
            {interventionDate.time && (
              <span className="text-primary font-medium">• {interventionDate.time}</span>
            )}
          </div>
        )}

        {/* Location - Compact (only show one) */}
        {(hasExtraAdresse || intervention.location) && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
            <MapPin className="w-3 h-3 shrink-0 text-primary" />
            <span className="truncate">{hasExtraAdresse ? intervention.extraAdresse : intervention.location}</span>
          </div>
        )}

        {/* Concierge/Immeuble - Compact inline */}
        {(hasExtraContact || hasExtraNoImm) && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1 flex-wrap">
            {hasExtraContact && (
              <div className="flex items-center gap-0.5">
                <Building2 className="w-2.5 h-2.5 text-primary/70" />
                <span className="truncate max-w-[100px]">{intervention.extraContact}</span>
              </div>
            )}
            {hasExtraNoImm && (
              <div className="flex items-center gap-0.5">
                <Home className="w-2.5 h-2.5 text-primary/70" />
                <span>Imm: {intervention.extraNoImm}</span>
              </div>
            )}
          </div>
        )}

        {/* Access codes - Compact inline */}
        {(hasExtraCle || hasExtraCode) && (
          <div className="flex items-center gap-1.5 text-[10px] mb-1 flex-wrap">
            {hasExtraCle && (
              <div className="flex items-center gap-0.5 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                <Key className="w-2.5 h-2.5" />
                <span>{intervention.extraCle}</span>
              </div>
            )}
            {hasExtraCode && (
              <div className="flex items-center gap-0.5 text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" />
                <span>{intervention.extraCode}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer: Assigned + Type + Progress - Compact */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/30 mt-1.5">
          {/* Assigned workers */}
          <div className="flex items-center gap-1 text-[10px] min-w-0 flex-1">
            {supabaseAssignments.length > 0 ? (
              <>
                <Users className={cn("w-3 h-3 shrink-0", techTextColor || "text-primary")} />
                <span className="truncate text-muted-foreground">
                  {supabaseAssignments.slice(0, 2).map((a, idx) => {
                    const cIdx = getColorIndexForName(a.user_name);
                    return (
                      <span 
                        key={a.id} 
                        className={cn(
                          "font-medium",
                          TECH_TEXT_COLORS[cIdx]
                        )}
                      >
                        {a.user_name.split(' ')[0]}{idx < Math.min(supabaseAssignments.length - 1, 1) ? ', ' : ''}
                      </span>
                    );
                  })}
                  {supabaseAssignments.length > 2 && ` +${supabaseAssignments.length - 2}`}
                </span>
              </>
            ) : assigneeName ? (
              <>
                <User className={cn("w-3 h-3 shrink-0", techTextColor || "text-muted-foreground")} />
                <span className={cn("truncate font-medium", techTextColor)}>{assigneeName.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3 shrink-0 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400 font-medium">Non assigné</span>
              </>
            )}
          </div>

          {/* Type + Progress */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] font-medium px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
              {typeLabels[intervention.type] || intervention.type}
            </span>
            
            {totalTasks > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
