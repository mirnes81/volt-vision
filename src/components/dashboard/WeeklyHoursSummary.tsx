import * as React from 'react';
import { Clock, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Default tenant UUID for Dolibarr integration mode
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface TechnicianHours {
  user_id: string;
  user_name: string;
  total_minutes: number;
  approved_minutes: number;
  pending_minutes: number;
  entry_count: number;
}

export function WeeklyHoursSummary() {
  const [technicianHours, setTechnicianHours] = React.useState<TechnicianHours[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchWeeklyHours() {
      setIsLoading(true);
      try {
        // Calculate week start (Monday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch all entries for the week
        const { data: entries, error } = await supabase
          .from('work_time_entries')
          .select('user_id, duration_minutes, status')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('clock_in', startOfWeek.toISOString())
          .lte('clock_in', endOfWeek.toISOString())
          .not('clock_out', 'is', null);

        if (error) throw error;

        // Aggregate hours per technician (user_id is Dolibarr user ID as string)
        const hoursMap = new Map<string, TechnicianHours>();
        
        (entries || []).forEach(entry => {
          const existing = hoursMap.get(entry.user_id) || {
            user_id: entry.user_id,
            user_name: `Technicien ${entry.user_id}`,
            total_minutes: 0,
            approved_minutes: 0,
            pending_minutes: 0,
            entry_count: 0,
          };

          existing.total_minutes += entry.duration_minutes || 0;
          existing.entry_count += 1;
          
          if (entry.status === 'approved') {
            existing.approved_minutes += entry.duration_minutes || 0;
          } else if (entry.status === 'pending') {
            existing.pending_minutes += entry.duration_minutes || 0;
          }

          hoursMap.set(entry.user_id, existing);
        });

        // Sort by total hours descending
        const sorted = Array.from(hoursMap.values()).sort((a, b) => b.total_minutes - a.total_minutes);
        setTechnicianHours(sorted);

      } catch (error) {
        console.error('Error fetching weekly hours:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWeeklyHours();
  }, []);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const totalWeekMinutes = technicianHours.reduce((sum, t) => sum + t.total_minutes, 0);
  const totalPendingMinutes = technicianHours.reduce((sum, t) => sum + t.pending_minutes, 0);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Heures cette semaine
        </h3>
        <Link to="/time-tracking">
          <Button variant="ghost" size="sm" className="text-xs">
            Voir tout
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-primary">{formatHours(totalWeekMinutes)}</p>
          <p className="text-[10px] text-muted-foreground">Total équipe</p>
        </div>
        <div className={cn(
          "rounded-xl p-3 text-center",
          totalPendingMinutes > 0 ? "bg-warning/10" : "bg-success/10"
        )}>
          <p className={cn(
            "text-xl font-bold",
            totalPendingMinutes > 0 ? "text-warning" : "text-success"
          )}>
            {totalPendingMinutes > 0 ? formatHours(totalPendingMinutes) : '✓'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {totalPendingMinutes > 0 ? 'À valider' : 'Tout validé'}
          </p>
        </div>
      </div>

      {/* Technicians list */}
      {technicianHours.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun pointage cette semaine</p>
          <p className="text-xs mt-1">Utilisez le bouton "Pointer" sur la page Heures</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {technicianHours.map((tech) => {
            const hoursPercent = (tech.total_minutes / (42.5 * 60)) * 100; // 42.5h = full week
            const hasPending = tech.pending_minutes > 0;
            
            return (
              <div 
                key={tech.user_id} 
                className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {tech.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{tech.user_name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-primary">
                        {formatHours(tech.total_minutes)}
                      </span>
                      {hasPending && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, hoursPercent)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {tech.entry_count} pts
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
