import * as React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, User, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Intervention } from '@/types/intervention';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getDateOverride } from '@/components/intervention/DateEditDialog';
import { useInterventionsCache } from '@/hooks/useInterventionsCache';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { useWebhookRefresh } from '@/hooks/useWebhookRefresh';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const DAYS_FULL_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

type ViewMode = 'day' | 'week' | 'month' | 'thirty';

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  installation: { bg: 'bg-primary/10', border: 'border-l-primary', text: 'text-primary' },
  depannage: { bg: 'bg-destructive/10', border: 'border-l-destructive', text: 'text-destructive' },
  renovation: { bg: 'bg-warning/10', border: 'border-l-warning', text: 'text-warning' },
  tableau: { bg: 'bg-success/10', border: 'border-l-success', text: 'text-success' },
  cuisine: { bg: 'bg-purple-500/10', border: 'border-l-purple-500', text: 'text-purple-600' },
  oibt: { bg: 'bg-cyan-500/10', border: 'border-l-cyan-500', text: 'text-cyan-600' },
};

const statusLabels: Record<string, string> = {
  a_planifier: 'À planifier',
  en_cours: 'En cours',
  termine: 'Terminé',
  facture: 'Facturé',
};

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

  // Check if user is admin
  const workerData = localStorage.getItem('mv3_worker');
  const worker = workerData ? JSON.parse(workerData) : null;
  const isAdmin = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true || worker?.login?.toLowerCase() === 'admin';
  const workerId = worker?.id ? String(worker.id) : null;

  // Load ALL interventions, then filter using Supabase assignments
  const { interventions: allInterventions, isLoading, refresh } = useInterventionsCache(false);
  const { assignments } = useAssignments();

  // Load date overrides from Supabase (shared across devices, takes priority over localStorage)
  const [supabaseOverrides, setSupabaseOverrides] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    const loadOverrides = async () => {
      try {
        const { data } = await supabase
          .from('intervention_date_overrides')
          .select('intervention_id, override_date, updated_at')
          .eq('tenant_id', '00000000-0000-0000-0000-000000000001');
        if (data) {
          const map: Record<number, string> = {};
          data.forEach((o: any) => {
            map[o.intervention_id] = o.override_date;
            // Sync localStorage with Supabase values to keep them consistent
            localStorage.setItem(`intervention_date_override_${o.intervention_id}`, o.override_date);
          });
          setSupabaseOverrides(map);
        }
      } catch (err) {
        console.warn('[CalendarPage] Could not load Supabase date overrides:', err);
      }
    };
    loadOverrides();
  }, []);

  // Auto-refresh on Dolibarr webhook events
  useWebhookRefresh(refresh, {
    resourceTypes: ['intervention'],
    showToast: true,
  });

  // For non-admins: filter to show only interventions assigned via Supabase OR Dolibarr
  const interventions = React.useMemo(() => {
    if (isAdmin) return allInterventions;
    if (!workerId) return [];
    
    // Get intervention IDs assigned to this user in Supabase
    const assignedInterventionIds = new Set(
      assignments
        .filter(a => a.user_id === workerId)
        .map(a => a.intervention_id)
        .filter(Boolean)
    );
    
    return allInterventions.filter(int => 
      assignedInterventionIds.has(int.id) || 
      (int.assignedTo?.id && String(int.assignedTo.id) === workerId)
    );
  }, [allInterventions, assignments, isAdmin, workerId]);

  const days = language === 'de' ? DAYS_DE : language === 'it' ? DAYS_IT : DAYS_FR;
  const months = language === 'de' ? MONTHS_DE : language === 'it' ? MONTHS_IT : MONTHS_FR;

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'thirty') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 30 : -30));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
    if (viewMode === 'day') setSelectedDate(newDate);
  };

  // Get 30 days dates starting from current date
  const getThirtyDaysDates = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getWeekDates = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const dates = [];
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      dates.push({ date, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    const remaining = 42 - dates.length;
    for (let i = 1; i <= remaining; i++) {
      dates.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return dates;
  };

  // Get effective date for intervention: Supabase override > localStorage override > Dolibarr dateStart
  const getEffectiveDate = (int: Intervention): string | null => {
    const supabaseOverride = supabaseOverrides[int.id];
    if (supabaseOverride) return supabaseOverride;
    const localOverride = getDateOverride(int.id);
    if (localOverride) return localOverride;
    return int.dateStart || null;
  };

  // Filter interventions by date using effective date (local override or dateStart)
  const getInterventionsForDate = (date: Date) => {
    return interventions.filter(int => {
      const effectiveDate = getEffectiveDate(int);
      if (!effectiveDate) return false;
      const intDate = new Date(effectiveDate);
      return intDate.toDateString() === date.toDateString();
    });
  };

  // Get time from effective date
  const getInterventionTime = (intervention: Intervention): string | null => {
    const effectiveDate = getEffectiveDate(intervention);
    if (!effectiveDate) return null;
    const date = new Date(effectiveDate);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) return null;
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  };

  const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
  const isToday = (date: Date) => isSameDate(date, new Date());

  const weekDates = getWeekDates();
  const monthDates = getMonthDates();
  const thirtyDaysDates = getThirtyDaysDates();
  const selectedInterventions = React.useMemo(() => {
    return getInterventionsForDate(selectedDate).sort((a, b) => {
      const dateA = getEffectiveDate(a);
      const dateB = getEffectiveDate(b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [selectedDate, interventions]);

  // Desktop: Hours timeline
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7h to 18h

  const getInterventionPosition = (int: Intervention) => {
    const effectiveDate = getEffectiveDate(int);
    if (!effectiveDate) return null;
    const date = new Date(effectiveDate);
    const hour = date.getHours();
    const minute = date.getMinutes();
    if (hour < 7 || hour > 18) return null;
    return ((hour - 7) * 60 + minute) / (12 * 60) * 100;
  };

  if (isLoading) {
    return (
      <div className="pb-4">
        <Header title={t('calendar.title')} />
        <div className="px-4 space-y-4 pt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <Header title={t('calendar.title')} />

      <div className="px-4 lg:px-6 space-y-4 pt-4">
        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'day'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'week'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {t('calendar.week')}
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'month'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('thirty')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'thirty'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              30j
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              {t('calendar.today')}
            </Button>
            <Link to="/intervention/new" className="hidden lg:block">
              <Button size="sm" className="gap-1">
                <Plus className="w-4 h-4" />
                Nouvelle
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-center">
            {viewMode === 'day'
              ? `${DAYS_FULL_FR[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]} ${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : viewMode === 'week'
              ? `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : viewMode === 'thirty'
              ? `${thirtyDaysDates[0].getDate()} ${months[thirtyDaysDates[0].getMonth()]} - ${thirtyDaysDates[29].getDate()} ${months[thirtyDaysDates[29].getMonth()]}`
              : `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </h2>
          <button
            onClick={() => navigate('next')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Day View with Timeline */}
        {viewMode === 'day' && (
          <div className="hidden lg:block bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[80px_1fr] min-h-[600px]">
              {/* Time column */}
              <div className="border-r border-border bg-secondary/30">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-[50px] border-b border-border/50 px-2 py-1 text-xs text-muted-foreground font-medium"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>
              
              {/* Events column */}
              <div className="relative">
                {hours.map((hour) => (
                  <div key={hour} className="h-[50px] border-b border-border/30" />
                ))}
                
                {/* Interventions */}
                {selectedInterventions.map((int) => {
                  const position = getInterventionPosition(int);
                  if (position === null) return null;
                  const colors = typeColors[int.type] || typeColors.installation;
                  
                  return (
                    <Link
                      key={int.id}
                      to={`/intervention/${int.id}`}
                      className={cn(
                        "absolute left-2 right-2 min-h-[48px] rounded-lg border-l-4 p-2 transition-all hover:shadow-lg hover:scale-[1.02]",
                        colors.bg,
                        colors.border
                      )}
                      style={{ top: `${position}%` }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{int.label}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{getInterventionTime(int) || 'Toute la journée'}</span>
                            <span>•</span>
                            <span>{int.clientName}</span>
                          </div>
                        </div>
                        {int.priority === 'urgent' && (
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                      </div>
                    </Link>
                  );
                })}
                
                {/* Current time indicator */}
                {isToday(currentDate) && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-destructive z-10"
                    style={{
                      top: `${((new Date().getHours() - 7) * 60 + new Date().getMinutes()) / (12 * 60) * 100}%`
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-destructive -mt-1.5 -ml-1.5" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            {/* Desktop Week with Timeline */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
                <div className="p-2 bg-secondary/30" />
                {weekDates.map((date, i) => {
                  const dayInterventions = getInterventionsForDate(date);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "p-2 text-center border-l border-border",
                        isToday(date) && "bg-primary/5"
                      )}
                    >
                      <p className="text-xs text-muted-foreground">{days[i]}</p>
                      <p className={cn(
                        "text-lg font-bold mt-0.5",
                        isToday(date) && "text-primary"
                      )}>
                        {date.getDate()}
                      </p>
                      {dayInterventions.length > 0 && (
                        <span className="text-xs text-primary font-medium">
                          {dayInterventions.length} int.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="grid grid-cols-[80px_repeat(7,1fr)] max-h-[500px] overflow-y-auto">
                <div className="border-r border-border bg-secondary/30">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="h-[40px] border-b border-border/50 px-2 text-xs text-muted-foreground font-medium flex items-center"
                    >
                      {hour}:00
                    </div>
                  ))}
                </div>
                
                {weekDates.map((date, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={cn(
                      "relative border-l border-border",
                      isToday(date) && "bg-primary/5"
                    )}
                  >
                    {hours.map((hour) => (
                      <div key={hour} className="h-[40px] border-b border-border/30" />
                    ))}
                    
                    {getInterventionsForDate(date).map((int) => {
                      const position = getInterventionPosition(int);
                      if (position === null) return null;
                      const colors = typeColors[int.type] || typeColors.installation;
                      
                      return (
                        <Link
                          key={int.id}
                          to={`/intervention/${int.id}`}
                          className={cn(
                            "absolute left-0.5 right-0.5 min-h-[32px] rounded border-l-2 px-1 py-0.5 transition-all hover:z-10 hover:shadow-lg text-xs",
                            colors.bg,
                            colors.border
                          )}
                          style={{ top: `${position}%` }}
                        >
                          <p className="font-medium truncate">{int.label}</p>
                          <p className="text-muted-foreground truncate">{getInterventionTime(int)}</p>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Week View */}
            <div className="lg:hidden">
              <div className="grid grid-cols-7 border-b border-border">
                {days.map((day, i) => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDates.map((date, i) => {
                  const dayInterventions = getInterventionsForDate(date);
                  const isSelected = isSameDate(date, selectedDate);
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "p-2 min-h-[80px] border-r border-b border-border last:border-r-0 transition-colors text-left",
                        isSelected && "bg-primary/10",
                        isToday(date) && "bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                        isToday(date) && "bg-primary text-primary-foreground",
                        isSelected && !isToday(date) && "bg-secondary"
                      )}>
                        {date.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayInterventions.slice(0, 2).map((int, j) => {
                          const colors = typeColors[int.type] || typeColors.installation;
                          return (
                            <div
                              key={j}
                              className={cn("h-1.5 rounded-full", colors.bg.replace('/10', ''))}
                            />
                          );
                        })}
                        {dayInterventions.length > 2 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{dayInterventions.length - 2}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {days.map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDates.map(({ date, isCurrentMonth }, i) => {
                const dayInterventions = getInterventionsForDate(date);
                const isSelected = isSameDate(date, selectedDate);
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "p-1.5 lg:p-2 min-h-[50px] lg:min-h-[80px] border-r border-b border-border transition-colors text-left",
                      i % 7 === 6 && "border-r-0",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 lg:w-7 lg:h-7 rounded-full text-xs lg:text-sm font-medium",
                      isToday(date) && "bg-primary text-primary-foreground"
                    )}>
                      {date.getDate()}
                    </span>
                    
                    {/* Mobile: dots */}
                    <div className="lg:hidden flex gap-0.5 mt-0.5 justify-center">
                      {dayInterventions.slice(0, 3).map((int, j) => {
                        const colors = typeColors[int.type] || typeColors.installation;
                        return (
                          <div
                            key={j}
                            className={cn("w-1.5 h-1.5 rounded-full", colors.bg.replace('/10', ''))}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Desktop: mini cards */}
                    <div className="hidden lg:block mt-1 space-y-0.5">
                      {dayInterventions.slice(0, 2).map((int) => {
                        const colors = typeColors[int.type] || typeColors.installation;
                        return (
                          <div
                            key={int.id}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate border-l-2",
                              colors.bg,
                              colors.border
                            )}
                          >
                            {getInterventionTime(int) && (
                              <span className="font-medium">{getInterventionTime(int)} </span>
                            )}
                            {int.label}
                          </div>
                        );
                      })}
                      {dayInterventions.length > 2 && (
                        <p className="text-[10px] text-primary font-medium px-1">
                          +{dayInterventions.length - 2} autres
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Day Interventions (Mobile only for week/month view) */}
        {(viewMode === 'week' || viewMode === 'month') && (
          <div className="space-y-2 lg:hidden">
            <h3 className="font-semibold">
              {selectedDate.toLocaleDateString(language === 'de' ? 'de-CH' : language === 'it' ? 'it-CH' : 'fr-CH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            
            {selectedInterventions.length === 0 ? (
              <div className="bg-card rounded-xl p-6 text-center text-muted-foreground border border-border/50">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune intervention ce jour</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedInterventions.map((intervention) => {
                  const colors = typeColors[intervention.type] || typeColors.installation;
                  const time = getInterventionTime(intervention);
                  
                  return (
                    <Link
                      key={intervention.id}
                      to={`/intervention/${intervention.id}`}
                      className={cn(
                        "block bg-card rounded-xl p-4 border-l-4 border border-border/50 hover:border-primary/30 transition-all",
                        colors.border
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", colors.bg, colors.text)}>
                              {intervention.ref}
                            </span>
                            {intervention.priority === 'urgent' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="font-semibold truncate">{intervention.label}</p>
                          <p className="text-sm text-muted-foreground truncate">{intervention.clientName}</p>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {time && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground">{time}</span>
                              </div>
                            )}
                            {intervention.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{intervention.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full shrink-0",
                          intervention.status === 'termine' && "bg-success/10 text-success",
                          intervention.status === 'en_cours' && "bg-primary/10 text-primary",
                          intervention.status === 'a_planifier' && "bg-muted text-muted-foreground"
                        )}>
                          {statusLabels[intervention.status]}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Desktop Selected Day Sidebar */}
        {viewMode !== 'day' && (
          <div className="hidden lg:block bg-card rounded-2xl shadow-card border border-border/50 p-4">
            <h3 className="font-bold text-lg mb-4">
              {selectedDate.toLocaleDateString('fr-CH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            
            {selectedInterventions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucune intervention programmée</p>
                <Link to="/intervention/new" className="mt-4 inline-block">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="w-4 h-4" />
                    Créer une intervention
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedInterventions.map((int) => {
                  const colors = typeColors[int.type] || typeColors.installation;
                  const time = getInterventionTime(int);
                  
                  return (
                    <Link
                      key={int.id}
                      to={`/intervention/${int.id}`}
                      className={cn(
                        "block p-3 rounded-xl border-l-4 transition-all hover:shadow-md",
                        colors.bg,
                        colors.border
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {time && (
                              <span className="text-sm font-bold">{time}</span>
                            )}
                            {int.priority === 'urgent' && (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                          <p className="font-semibold truncate mt-0.5">{int.label}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <User className="w-3 h-3" />
                            <span>{int.clientName}</span>
                          </div>
                          {int.extraAdresse && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{int.extraAdresse}</span>
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                          int.status === 'termine' && "bg-success/20 text-success",
                          int.status === 'en_cours' && "bg-primary/20 text-primary",
                          int.status === 'a_planifier' && "bg-secondary text-muted-foreground"
                        )}>
                          {statusLabels[int.status]}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 30 Days View */}
        {viewMode === 'thirty' && (
          <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {thirtyDaysDates.map((date, idx) => {
                const dayInterventions = getInterventionsForDate(date);
                const today = isToday(date);
                const dayName = DAYS_FULL_FR[date.getDay() === 0 ? 6 : date.getDay() - 1];
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "p-3",
                      today && "bg-primary/5"
                    )}
                  >
                    {/* Date header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-semibold",
                          today && "text-primary"
                        )}>
                          {dayName}
                        </span>
                        <span className={cn(
                          "text-lg font-bold",
                          today && "bg-primary text-primary-foreground px-2 py-0.5 rounded-full"
                        )}>
                          {date.getDate()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {months[date.getMonth()]}
                        </span>
                      </div>
                      {dayInterventions.length > 0 && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {dayInterventions.length} intervention{dayInterventions.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    {/* Interventions for the day */}
                    {dayInterventions.length > 0 ? (
                      <div className="space-y-2 ml-2">
                        {dayInterventions.map((int) => {
                          const time = getInterventionTime(int);
                          const colors = typeColors[int.type] || typeColors.installation;
                          
                          return (
                            <Link
                              key={int.id}
                              to={`/intervention/${int.id}`}
                              className={cn(
                                "block p-2 rounded-lg border-l-4 transition-all hover:shadow-md",
                                colors.bg,
                                colors.border
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {time && (
                                  <span className="text-xs font-bold text-muted-foreground">{time}</span>
                                )}
                                {int.priority === 'urgent' && (
                                  <AlertTriangle className="w-3 h-3 text-destructive" />
                                )}
                                <span className="font-medium text-sm truncate flex-1">{int.label}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{int.clientName}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground ml-2 italic">Aucune intervention</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
