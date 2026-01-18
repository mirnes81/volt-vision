import * as React from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { User, Calendar, ChevronDown, ChevronUp, Clock, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WorkerSummary {
  user_id: string;
  user_name: string;
  total_minutes: number;
  regular_minutes: number;
  overtime_minutes: number;
  approved_minutes: number;
  pending_minutes: number;
  entry_count: number;
}

interface WorkerHoursSummaryProps {
  tenantId?: string;
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function WorkerHoursSummary({ tenantId = DEFAULT_TENANT_ID }: WorkerHoursSummaryProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [weeklyData, setWeeklyData] = React.useState<WorkerSummary[]>([]);
  const [monthlyData, setMonthlyData] = React.useState<WorkerSummary[]>([]);
  const [expandedWorker, setExpandedWorker] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch weekly data
      const { data: weeklyEntries } = await supabase
        .from('work_time_entries')
        .select('user_id, duration_minutes, status, is_overtime')
        .eq('tenant_id', tenantId)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .not('duration_minutes', 'is', null);

      // Fetch monthly data
      const { data: monthlyEntries } = await supabase
        .from('work_time_entries')
        .select('user_id, duration_minutes, status, is_overtime')
        .eq('tenant_id', tenantId)
        .gte('clock_in', monthStart.toISOString())
        .lte('clock_in', monthEnd.toISOString())
        .not('duration_minutes', 'is', null);

      // Get user names from saas_profiles or use user_id
      const userIds = [...new Set([
        ...(weeklyEntries || []).map(e => e.user_id),
        ...(monthlyEntries || []).map(e => e.user_id)
      ])];

      // Try to get names from saas_profiles, fall back to constructing name
      const userNames: Record<string, string> = {};
      userIds.forEach(id => {
        userNames[id] = `Employé ${id}`;
      });

      // Aggregate weekly data by user
      const weeklyAgg = aggregateByUser(weeklyEntries || [], userNames);
      const monthlyAgg = aggregateByUser(monthlyEntries || [], userNames);

      setWeeklyData(weeklyAgg);
      setMonthlyData(monthlyAgg);
    } catch (error) {
      console.error('Error fetching worker hours summary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const aggregateByUser = (
    entries: Array<{ user_id: string; duration_minutes: number | null; status: string; is_overtime: boolean | null }>,
    userNames: Record<string, string>
  ): WorkerSummary[] => {
    const map = new Map<string, WorkerSummary>();

    entries.forEach(entry => {
      const mins = entry.duration_minutes || 0;
      const existing = map.get(entry.user_id) || {
        user_id: entry.user_id,
        user_name: userNames[entry.user_id] || `Employé ${entry.user_id}`,
        total_minutes: 0,
        regular_minutes: 0,
        overtime_minutes: 0,
        approved_minutes: 0,
        pending_minutes: 0,
        entry_count: 0,
      };

      existing.total_minutes += mins;
      existing.entry_count += 1;

      if (entry.is_overtime) {
        existing.overtime_minutes += mins;
      } else {
        existing.regular_minutes += mins;
      }

      if (entry.status === 'approved') {
        existing.approved_minutes += mins;
      } else if (entry.status === 'pending') {
        existing.pending_minutes += mins;
      }

      map.set(entry.user_id, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.total_minutes - a.total_minutes);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const renderWorkerCard = (worker: WorkerSummary, period: 'week' | 'month') => {
    const isExpanded = expandedWorker === `${worker.user_id}-${period}`;
    
    return (
      <Card 
        key={`${worker.user_id}-${period}`}
        className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpandedWorker(isExpanded ? null : `${worker.user_id}-${period}`)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{worker.user_name}</p>
              <p className="text-sm text-muted-foreground">{worker.entry_count} entrées</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-lg">{formatDuration(worker.total_minutes)}</p>
              {worker.overtime_minutes > 0 && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{formatDuration(worker.overtime_minutes)}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Régulier:</span>
              <span className="font-medium">{formatDuration(worker.regular_minutes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-muted-foreground">Heures sup.:</span>
              <span className="font-medium text-amber-600">{formatDuration(worker.overtime_minutes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Approuvé:</span>
              <span className="font-medium text-green-600">{formatDuration(worker.approved_minutes)}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-muted-foreground">En attente:</span>
              <span className="font-medium text-yellow-600">{formatDuration(worker.pending_minutes)}</span>
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="week" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="week" className="gap-2">
          <Calendar className="w-4 h-4" />
          Cette semaine
        </TabsTrigger>
        <TabsTrigger value="month" className="gap-2">
          <Calendar className="w-4 h-4" />
          Ce mois
        </TabsTrigger>
      </TabsList>

      <TabsContent value="week" className="space-y-3">
        {weeklyData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée pour cette semaine</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              Semaine du {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM', { locale: fr })} au {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}
            </div>
            {weeklyData.map(worker => renderWorkerCard(worker, 'week'))}
          </>
        )}
      </TabsContent>

      <TabsContent value="month" className="space-y-3">
        {monthlyData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée pour ce mois</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              {format(new Date(), 'MMMM yyyy', { locale: fr })}
            </div>
            {monthlyData.map(worker => renderWorkerCard(worker, 'month'))}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
