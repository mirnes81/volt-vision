import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTodayInterventions } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { cn } from '@/lib/utils';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

type ViewMode = 'week' | 'month';

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const days = language === 'de' ? DAYS_DE : language === 'it' ? DAYS_IT : DAYS_FR;
  const months = language === 'de' ? MONTHS_DE : language === 'it' ? MONTHS_IT : MONTHS_FR;

  useEffect(() => {
    loadInterventions();
  }, []);

  const loadInterventions = async () => {
    const data = await getTodayInterventions();
    setInterventions(data);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
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
    
    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      dates.push({ date, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month days
    const remaining = 42 - dates.length;
    for (let i = 1; i <= remaining; i++) {
      dates.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return dates;
  };

  const getInterventionsForDate = (date: Date) => {
    // In real app, filter by actual date
    // For demo, show some interventions on current day
    const isToday = date.toDateString() === new Date().toDateString();
    return isToday ? interventions : [];
  };

  const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
  const isToday = (date: Date) => isSameDate(date, new Date());

  const weekDates = getWeekDates();
  const monthDates = getMonthDates();
  const selectedInterventions = getInterventionsForDate(selectedDate);

  const typeColors: Record<string, string> = {
    installation: 'bg-primary',
    depannage: 'bg-destructive',
    renovation: 'bg-warning',
    tableau: 'bg-success',
    cuisine: 'bg-purple-500',
    oibt: 'bg-cyan-500',
  };

  return (
    <div className="pb-4">
      <Header title={t('calendar.title')} />

      <div className="px-4 space-y-4 pt-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'week'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
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
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {t('calendar.month')}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {t('calendar.today')}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">
            {viewMode === 'week'
              ? `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
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

        {/* Calendar Grid */}
        {viewMode === 'week' ? (
          <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-border">
              {days.map((day, i) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            {/* Week Days */}
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
                      {dayInterventions.slice(0, 2).map((int, j) => (
                        <div
                          key={j}
                          className={cn(
                            "h-1.5 rounded-full",
                            typeColors[int.type] || 'bg-primary'
                          )}
                        />
                      ))}
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
        ) : (
          <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
            {/* Month Header */}
            <div className="grid grid-cols-7 border-b border-border">
              {days.map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            {/* Month Grid */}
            <div className="grid grid-cols-7">
              {monthDates.map(({ date, isCurrentMonth }, i) => {
                const dayInterventions = getInterventionsForDate(date);
                const isSelected = isSameDate(date, selectedDate);
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "p-1.5 min-h-[50px] border-r border-b border-border transition-colors",
                      i % 7 === 6 && "border-r-0",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                      isToday(date) && "bg-primary text-primary-foreground"
                    )}>
                      {date.getDate()}
                    </span>
                    {dayInterventions.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 justify-center">
                        {dayInterventions.slice(0, 3).map((int, j) => (
                          <div
                            key={j}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              typeColors[int.type] || 'bg-primary'
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Day Interventions */}
        <div className="space-y-2">
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
              {selectedInterventions.map((intervention) => (
                <Link
                  key={intervention.id}
                  to={`/intervention/${intervention.id}`}
                  className="block bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-1 h-full min-h-[40px] rounded-full",
                      typeColors[intervention.type] || 'bg-primary'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{intervention.label}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>08:00 - 17:00</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{intervention.location}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
