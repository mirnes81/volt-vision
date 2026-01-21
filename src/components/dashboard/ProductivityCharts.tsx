import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface WeeklyData {
  week: string;
  weekLabel: string;
  heures: number;
  heuresSupp: number;
}

interface HoursDistribution {
  name: string;
  value: number;
  color: string;
}

export function ProductivityCharts() {
  const [weeklyData, setWeeklyData] = React.useState<WeeklyData[]>([]);
  const [distribution, setDistribution] = React.useState<HoursDistribution[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const now = new Date();
        const weeks: WeeklyData[] = [];
        
        // Fetch last 6 weeks of data
        for (let i = 5; i >= 0; i--) {
          const weekDate = subWeeks(now, i);
          const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
          
          const { data: entries } = await supabase
            .from('work_time_entries')
            .select('duration_minutes, is_overtime')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .gte('clock_in', weekStart.toISOString())
            .lte('clock_in', weekEnd.toISOString())
            .not('duration_minutes', 'is', null);

          const regularMinutes = (entries || [])
            .filter(e => !e.is_overtime)
            .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
          
          const overtimeMinutes = (entries || [])
            .filter(e => e.is_overtime)
            .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

          weeks.push({
            week: format(weekStart, 'dd/MM'),
            weekLabel: `Sem. ${format(weekStart, 'w')}`,
            heures: Math.round(regularMinutes / 60 * 10) / 10,
            heuresSupp: Math.round(overtimeMinutes / 60 * 10) / 10,
          });
        }

        setWeeklyData(weeks);

        // Calculate total distribution for current month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const { data: monthEntries } = await supabase
          .from('work_time_entries')
          .select('duration_minutes, is_overtime')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .gte('clock_in', monthStart.toISOString())
          .lte('clock_in', monthEnd.toISOString())
          .not('duration_minutes', 'is', null);

        const totalRegular = (monthEntries || [])
          .filter(e => !e.is_overtime)
          .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        
        const totalOvertime = (monthEntries || [])
          .filter(e => e.is_overtime)
          .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

        setDistribution([
          { 
            name: 'Heures normales', 
            value: Math.round(totalRegular / 60 * 10) / 10, 
            color: 'hsl(var(--primary))' 
          },
          { 
            name: 'Heures supp.', 
            value: Math.round(totalOvertime / 60 * 10) / 10, 
            color: 'hsl(var(--warning))' 
          },
        ]);

      } catch (error) {
        console.error('Error fetching productivity data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 h-64 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 h-64 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const totalHours = distribution.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Bar Chart - Weekly Hours */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Heures par semaine</h3>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}h`, '']}
                labelFormatter={(label) => `Semaine du ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar 
                dataKey="heures" 
                name="Normales"
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                stackId="hours"
              />
              <Bar 
                dataKey="heuresSupp" 
                name="Supp."
                fill="hsl(var(--warning))" 
                radius={[4, 4, 0, 0]}
                stackId="hours"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Normales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-warning" />
            <span className="text-muted-foreground">Supplémentaires</span>
          </div>
        </div>
      </div>

      {/* Pie Chart - Hours Distribution */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Répartition du mois</h3>
        </div>

        {totalHours === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Aucune donnée ce mois
          </div>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value}h`, '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs">
              {distribution.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-muted-foreground">{d.name}: {d.value}h</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
