import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ClipboardList, 
  Clock, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Timer
} from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface KPIData {
  weeklyInterventions: number;
  monthlyHours: number;
  activeTechnicians: number;
  completionRate: number;
  pendingValidation: number;
  overtimeHours: number;
  avgHoursPerDay: number;
  weeklyTrend: number; // percentage change from last week
}

export function DashboardKPIs() {
  const [kpis, setKpis] = React.useState<KPIData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchKPIs() {
      setIsLoading(true);
      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // Last week for trend calculation
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(weekEnd);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

        // Fetch this week's entries
        const { data: weekEntries } = await supabase
          .from('work_time_entries')
          .select('user_id, duration_minutes, status, is_overtime')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('clock_in', weekStart.toISOString())
          .lte('clock_in', weekEnd.toISOString())
          .not('duration_minutes', 'is', null);

        // Fetch last week's entries for trend
        const { data: lastWeekEntries } = await supabase
          .from('work_time_entries')
          .select('duration_minutes')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('clock_in', lastWeekStart.toISOString())
          .lte('clock_in', lastWeekEnd.toISOString())
          .not('duration_minutes', 'is', null);

        // Fetch monthly entries
        const { data: monthEntries } = await supabase
          .from('work_time_entries')
          .select('user_id, duration_minutes, is_overtime')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('clock_in', monthStart.toISOString())
          .lte('clock_in', monthEnd.toISOString())
          .not('duration_minutes', 'is', null);

        // Fetch intervention assignments for the week
        const { data: assignments } = await supabase
          .from('intervention_assignments')
          .select('id')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('date_planned', weekStart.toISOString())
          .lte('date_planned', weekEnd.toISOString());

        // Calculate KPIs
        const weeklyMinutes = (weekEntries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        const lastWeekMinutes = (lastWeekEntries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        const monthlyMinutes = (monthEntries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        
        const activeTechs = new Set((weekEntries || []).map(e => e.user_id)).size;
        const pendingCount = (weekEntries || []).filter(e => e.status === 'pending').length;
        const approvedCount = (weekEntries || []).filter(e => e.status === 'approved').length;
        const totalEntries = (weekEntries || []).length;
        
        const overtimeMinutes = (monthEntries || [])
          .filter(e => e.is_overtime)
          .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

        // Days worked this week (count unique dates)
        const daysWorked = now.getDay() === 0 ? 7 : now.getDay(); // Days elapsed in week
        const avgMinutesPerDay = daysWorked > 0 ? weeklyMinutes / daysWorked : 0;

        // Trend calculation
        const trend = lastWeekMinutes > 0 
          ? ((weeklyMinutes - lastWeekMinutes) / lastWeekMinutes) * 100 
          : 0;

        setKpis({
          weeklyInterventions: (assignments || []).length,
          monthlyHours: Math.round(monthlyMinutes / 60 * 10) / 10,
          activeTechnicians: activeTechs,
          completionRate: totalEntries > 0 ? Math.round((approvedCount / totalEntries) * 100) : 0,
          pendingValidation: pendingCount,
          overtimeHours: Math.round(overtimeMinutes / 60 * 10) / 10,
          avgHoursPerDay: Math.round(avgMinutesPerDay / 60 * 10) / 10,
          weeklyTrend: Math.round(trend),
        });

      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchKPIs();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card rounded-xl p-3 shadow-sm border border-border/50 h-20 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const kpiCards = [
    {
      icon: ClipboardList,
      label: 'Interventions',
      sublabel: 'cette semaine',
      value: kpis.weeklyInterventions,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Clock,
      label: 'Heures',
      sublabel: 'ce mois',
      value: `${kpis.monthlyHours}h`,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: Users,
      label: 'Techniciens',
      sublabel: 'actifs',
      value: kpis.activeTechnicians,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: TrendingUp,
      label: 'Tendance',
      sublabel: 'vs sem. dernière',
      value: `${kpis.weeklyTrend >= 0 ? '+' : ''}${kpis.weeklyTrend}%`,
      color: kpis.weeklyTrend >= 0 ? 'text-success' : 'text-destructive',
      bgColor: kpis.weeklyTrend >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
  ];

  const secondaryKpis = [
    {
      icon: CheckCircle2,
      label: 'Validation',
      value: `${kpis.completionRate}%`,
      color: kpis.completionRate >= 80 ? 'text-success' : 'text-warning',
    },
    {
      icon: AlertTriangle,
      label: 'En attente',
      value: kpis.pendingValidation,
      color: kpis.pendingValidation > 0 ? 'text-warning' : 'text-success',
    },
    {
      icon: Timer,
      label: 'H. supp.',
      value: `${kpis.overtimeHours}h`,
      color: 'text-warning',
    },
    {
      icon: Clock,
      label: 'Moy/jour',
      value: `${kpis.avgHoursPerDay}h`,
      color: 'text-primary',
    },
  ];

  return (
    <div className="space-y-2">
      {/* Main KPIs - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {kpiCards.map((kpi, index) => (
          <div 
            key={index}
            className="bg-card rounded-xl p-2.5 shadow-sm border border-border/50"
          >
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", kpi.bgColor)}>
                <kpi.icon className={cn("w-4 h-4", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs - Compact inline */}
      <div className="bg-card rounded-xl p-2.5 shadow-sm border border-border/50">
        <div className="grid grid-cols-4 gap-2">
          {secondaryKpis.map((kpi, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <kpi.icon className={cn("w-3.5 h-3.5", kpi.color)} />
                <span className={cn("text-sm font-bold", kpi.color)}>{kpi.value}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
