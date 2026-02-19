import * as React from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, Wind, MapPin, Calendar,
  AlertTriangle, User, Car, Navigation, Zap, Clock, Users,
  Wrench, CheckCircle2, Circle, AlertCircle, ArrowRight, Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { decodeHtmlEntities } from '@/lib/htmlUtils';
import { useWebhookRefresh } from '@/hooks/useWebhookRefresh';
import logoEnes from '@/assets/logo-enes.png';

// ─── Constants ───────────────────────────────────────────────────────
const ENES_ORIGIN = { lat: 46.5107, lon: 6.5004 };
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ─── Types ───────────────────────────────────────────────────────────
interface WeatherData { temp: number; description: string; humidity: number; wind: number; }
interface TodayIntervention {
  intervention_id: number | null;
  intervention_ref: string;
  intervention_label: string;
  client_name: string | null;
  location: string | null;
  priority: string;
  user_name: string;
  description: string | null;
  isAssigned: boolean;
  time_planned: string | null;
}
interface TechSummary {
  name: string;
  interventions: TodayIntervention[];
  colorIdx: number;
}
interface DayAssignment {
  intervention_label: string;
  intervention_ref?: string;
  intervention_id?: number | null;
  client_name: string | null;
  location: string | null;
  priority: string;
  date_planned: string;
  user_name?: string;
  description?: string | null;
}

// ─── Tech color palette ───────────────────────────────────────────────
const TECH_PALETTE = [
  { gradient: 'from-blue-600 to-blue-800', accent: '#3b82f6', light: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  { gradient: 'from-emerald-600 to-emerald-800', accent: '#10b981', light: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  { gradient: 'from-violet-600 to-violet-800', accent: '#8b5cf6', light: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  { gradient: 'from-amber-600 to-amber-800', accent: '#f59e0b', light: '#fcd34d', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  { gradient: 'from-cyan-600 to-cyan-800', accent: '#06b6d4', light: '#67e8f9', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' },
  { gradient: 'from-rose-600 to-rose-800', accent: '#f43f5e', light: '#fda4af', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
  { gradient: 'from-teal-600 to-teal-800', accent: '#14b8a6', light: '#5eead4', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)' },
  { gradient: 'from-orange-600 to-orange-800', accent: '#f97316', light: '#fdba74', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
];

// ─── Clock hook ──────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

// ─── Weather ─────────────────────────────────────────────────────────
function wmoCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
    45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte',
    61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte',
    71: 'Neige légère', 73: 'Neige', 75: 'Neige forte',
    80: 'Averses', 81: 'Averses modérées', 82: 'Averses fortes',
    95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent',
  };
  return map[code] || 'Variable';
}

function WeatherIcon({ desc, size = 'md' }: { desc: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const d = desc.toLowerCase();
  if (d.includes('neige')) return <CloudSnow className={`${cls} text-blue-200`} />;
  if (d.includes('pluie') || d.includes('averse') || d.includes('bruine')) return <CloudRain className={`${cls} text-blue-300`} />;
  if (d.includes('nuag') || d.includes('couvert') || d.includes('brouillard')) return <Cloud className={`${cls} text-gray-300`} />;
  return <Sun className={`${cls} text-yellow-400`} />;
}

function useWeather() {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ENES_ORIGIN.lat}&longitude=${ENES_ORIGIN.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
        const data = await res.json();
        const c = data.current;
        if (!cancelled) setWeather({ temp: Math.round(c.temperature_2m), description: wmoCodeToText(c.weather_code), humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m) });
      } catch { /* ignore */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  return weather;
}

// ─── Traffic helper ──────────────────────────────────────────────────
function getTrafficLabel(hour: number): { label: string; color: string } {
  if (hour >= 7 && hour <= 9) return { label: '🚗 Heure de pointe matin', color: '#ef4444' };
  if (hour >= 16 && hour <= 18) return { label: '🚗 Heure de pointe soir', color: '#ef4444' };
  if (hour >= 11 && hour <= 13) return { label: '🚙 Trafic modéré', color: '#f59e0b' };
  return { label: '✅ Trafic fluide', color: '#10b981' };
}

// ─── Main data hook ──────────────────────────────────────────────────
function useTVData() {
  const [techSummaries, setTechSummaries] = React.useState<TechSummary[]>([]);
  const [unassignedToday, setUnassignedToday] = React.useState<TodayIntervention[]>([]);
  const [weekPlan, setWeekPlan] = React.useState<{ date: Date; dayLabel: string; count: number; techs: string[] }[]>([]);
  const [stats, setStats] = React.useState({ total: 0, urgent: 0, techs: 0, weeklyHours: 0 });
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      const today = new Date();
      // CET offset for Swiss timezone
      const cetNow = new Date(today.getTime() + 3600000);
      const todayStr = cetNow.toISOString().split('T')[0];

      // Build week days (today + 6)
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
      }

      const [assignResult, dolibarrResult, dateOverridesResult, weekHoursResult] = await Promise.all([
        supabase
          .from('intervention_assignments')
          .select('user_name, intervention_label, intervention_ref, intervention_id, client_name, location, priority, date_planned, description')
          .eq('tenant_id', TENANT_ID)
          .order('user_name'),
        supabase.functions.invoke('dolibarr-api', { body: { action: 'get-interventions', params: {} } }).catch(() => ({ data: null })),
        supabase.from('intervention_date_overrides').select('intervention_id, override_date').eq('tenant_id', TENANT_ID),
        supabase.from('weekly_work_summary').select('total_minutes').eq('tenant_id', TENANT_ID),
      ]);

      // Build date overrides map
      const dateOverrides = new Map<number, string>();
      for (const row of (dateOverridesResult?.data || [])) {
        dateOverrides.set(row.intervention_id, row.override_date);
      }

      // Build Dolibarr date map
      const dolibarrInterventions: any[] = Array.isArray(dolibarrResult?.data) ? dolibarrResult.data : [];
      const dolibarrDateMap = new Map<number, string>();
      const dolibarrDataMap = new Map<number, any>();

      for (const int of dolibarrInterventions) {
        const intId = Number(int.id);
        dolibarrDataMap.set(intId, int);

        const override = dateOverrides.get(intId);
        if (override) {
          const d = new Date(new Date(override).getTime() + 3600000);
          dolibarrDateMap.set(intId, d.toISOString().split('T')[0]);
          continue;
        }
        const ef = int.array_options || {};
        const customTs = Number(ef.options_interventiondateheur || 0);
        if (customTs > 0) {
          dolibarrDateMap.set(intId, new Date((customTs + 3600) * 1000).toISOString().split('T')[0]);
          continue;
        }
        const ts = Number(int.dateo || 0);
        if (ts > 0) {
          dolibarrDateMap.set(intId, new Date((ts + 3600) * 1000).toISOString().split('T')[0]);
        }
      }

      // Process assignments
      const assignedInterventionIds = new Set<number>();
      const techMap = new Map<string, TodayIntervention[]>();
      const weekDayMap = new Map<string, { count: number; techs: Set<string> }>();

      for (const row of (assignResult.data || [])) {
        const intId = row.intervention_id ? Number(row.intervention_id) : null;
        if (intId) assignedInterventionIds.add(intId);

        let dateKey: string;
        const dolibarrDate = intId ? dolibarrDateMap.get(intId) : undefined;

        if (dolibarrDate) {
          dateKey = dolibarrDate;
        } else if (!row.date_planned) {
          continue; // skip unplanned for TV view
        } else {
          const d = new Date(row.date_planned);
          dateKey = new Date(d.getTime() + 3600000).toISOString().split('T')[0];
        }

        // Only process future days (today + next 6)
        const dayDiff = Math.floor((new Date(dateKey).getTime() - new Date(todayStr).getTime()) / 86400000);
        if (dayDiff < 0 || dayDiff > 6) continue;

        // Track week plan
        if (!weekDayMap.has(dateKey)) weekDayMap.set(dateKey, { count: 0, techs: new Set() });
        weekDayMap.get(dateKey)!.count++;
        weekDayMap.get(dateKey)!.techs.add(row.user_name || '');

        // Only process TODAY for main view
        if (dateKey !== todayStr) continue;

        const name = row.user_name || 'Non assigné';
        if (!techMap.has(name)) techMap.set(name, []);

        // Extract time from date_planned if available
        let timePlanned: string | null = null;
        if (row.date_planned) {
          const dp = new Date(row.date_planned);
          const h = dp.getHours(), m = dp.getMinutes();
          if (h > 0 || m > 0) timePlanned = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        const dolibarrInt = intId ? dolibarrDataMap.get(intId) : null;
        const rawDesc = (row as any).description || dolibarrInt?.description || dolibarrInt?.note_public || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

        techMap.get(name)!.push({
          intervention_id: intId,
          intervention_ref: row.intervention_ref || '',
          intervention_label: decodeHtmlEntities(row.intervention_label || 'Intervention'),
          client_name: row.client_name ? decodeHtmlEntities(row.client_name) : null,
          location: row.location ? decodeHtmlEntities(row.location) : null,
          priority: row.priority || 'normal',
          user_name: name,
          description: cleanDesc || null,
          isAssigned: true,
          time_planned: timePlanned,
        });
      }

      // Unassigned Dolibarr interventions for today
      const yesterdayStr = new Date(cetNow.getTime() - 86400000).toISOString().split('T')[0];
      const unassigned: TodayIntervention[] = [];
      for (const int of dolibarrInterventions) {
        const intId = Number(int.id);
        if (assignedInterventionIds.has(intId)) continue;
        if (int.fk_statut === '3' || int.fk_statut === 3) continue;
        const dateStr = dolibarrDateMap.get(intId);
        if (!dateStr || (dateStr !== todayStr && dateStr !== yesterdayStr)) continue;

        const rawDesc = (int.description || int.note_public || '').replace(/<[^>]*>/g, '').trim();
        unassigned.push({
          intervention_id: intId,
          intervention_ref: int.ref || '',
          intervention_label: decodeHtmlEntities(int.label || int.ref || 'Intervention'),
          client_name: int.thirdparty_name ? decodeHtmlEntities(int.thirdparty_name) : null,
          location: int.address ? decodeHtmlEntities(int.address) : null,
          priority: 'normal',
          user_name: 'Non assigné',
          description: rawDesc || null,
          isAssigned: false,
          time_planned: null,
        });
      }

      // Build tech summaries (sorted by name, then assign color index)
      const summaries: TechSummary[] = Array.from(techMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, interventions], idx) => ({
          name,
          interventions: interventions.sort((a, b) => {
            const pa = a.priority === 'critical' ? 0 : a.priority === 'urgent' ? 1 : 2;
            const pb = b.priority === 'critical' ? 0 : b.priority === 'urgent' ? 1 : 2;
            return pa - pb;
          }),
          colorIdx: idx % TECH_PALETTE.length,
        }));

      // Build week plan
      const plan = days.map(d => {
        const dStr = new Date(d.getTime() + 3600000).toISOString().split('T')[0];
        const entry = weekDayMap.get(dStr);
        return {
          date: d,
          dayLabel: d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric' }),
          count: entry?.count || 0,
          techs: Array.from(entry?.techs || []).filter(Boolean),
        };
      });

      // Stats
      const totalToday = summaries.reduce((s, t) => s + t.interventions.length, 0) + unassigned.length;
      const urgentCount = summaries.reduce((s, t) => s + t.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical').length, 0);
      const weeklyHours = Math.round((weekHoursResult.data || []).reduce((s, w) => s + (w.total_minutes || 0), 0) / 60);

      setTechSummaries(summaries);
      setUnassignedToday(unassigned);
      setWeekPlan(plan);
      setStats({ total: totalToday, urgent: urgentCount, techs: summaries.length, weeklyHours });
    } catch (err) {
      console.error('[TV] Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 90_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { techSummaries, unassignedToday, weekPlan, stats, loading, refresh: fetchData };
}

// ─── Fullscreen ──────────────────────────────────────────────────────
function useFullscreen() {
  const enter = React.useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);
  return enter;
}

// ─── Scrolling Ticker ────────────────────────────────────────────────
function Ticker({ messages }: { messages: string[] }) {
  const text = messages.join('     ◆     ');
  const duration = Math.max(messages.length * 6, 35);
  return (
    <div className="relative overflow-hidden h-11 flex items-center" style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="absolute whitespace-nowrap text-base font-medium"
        style={{ animation: `ticker ${duration}s linear infinite`, color: 'rgba(148,163,184,0.8)' }}>
        {text}
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'critical') return (
    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
      <AlertCircle className="h-3 w-3" /> Critique
    </span>
  );
  if (priority === 'urgent') return (
    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.25)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' }}>
      <Zap className="h-3 w-3" /> Urgent
    </span>
  );
  return null;
}

// ─── Intervention Card for tech column ───────────────────────────────
function InterventionCard({ item, palette }: { item: TodayIntervention; palette: typeof TECH_PALETTE[0] }) {
  const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
  const borderColor = isUrgent ? 'rgba(239,68,68,0.5)' : palette.border;
  const bgColor = isUrgent ? 'rgba(239,68,68,0.08)' : palette.bg;

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {item.intervention_ref && (
            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 mr-1" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              #{item.intervention_ref}
            </span>
          )}
          {item.time_planned && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
              <Clock className="h-2.5 w-2.5" /> {item.time_planned}
            </span>
          )}
          <div className="text-sm font-bold leading-tight" style={{ color: isUrgent ? '#fca5a5' : 'rgba(255,255,255,0.92)' }}>
            {item.intervention_label}
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      {/* Client & location */}
      <div className="flex flex-col gap-0.5">
        {item.client_name && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <Building2 className="h-3 w-3 flex-shrink-0" style={{ color: palette.light }} />
            <span className="truncate font-medium">{item.client_name}</span>
          </div>
        )}
        {item.location && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
        )}
      </div>

      {/* Description snippet */}
      {item.description && (
        <div className="text-[10px] leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {item.description}
        </div>
      )}
    </div>
  );
}

// ─── Tech Column ─────────────────────────────────────────────────────
function TechColumn({ tech }: { tech: TechSummary }) {
  const palette = TECH_PALETTE[tech.colorIdx];
  const initials = tech.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const urgentCount = tech.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical').length;

  return (
    <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)` }}>
      {/* Tech header */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${palette.bg}, rgba(0,0,0,0.2))`, borderBottom: `1px solid ${palette.border}` }}>
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0" style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.accent}88)`, color: '#fff', boxShadow: `0 0 16px ${palette.accent}40` }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: palette.light }}>{tech.name}</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {tech.interventions.length} intervention{tech.interventions.length !== 1 ? 's' : ''}
            {urgentCount > 0 && <span style={{ color: '#fca5a5' }}> · {urgentCount} urgent{urgentCount > 1 ? 'es' : 'e'}</span>}
          </div>
        </div>
        {/* Count badge */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base font-black" style={{ background: palette.accent + '30', color: palette.light }}>
          {tech.interventions.length}
        </div>
      </div>

      {/* Interventions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
        {tech.interventions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-xs">Aucune intervention</span>
          </div>
        ) : (
          tech.interventions.map((item, idx) => (
            <InterventionCard key={`${item.intervention_ref}-${idx}`} item={item} palette={palette} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Week mini-timeline ───────────────────────────────────────────────
function WeekTimeline({ weekPlan }: { weekPlan: { date: Date; dayLabel: string; count: number; techs: string[] }[] }) {
  const todayIdx = 0; // weekPlan[0] is always today
  const maxCount = Math.max(...weekPlan.map(d => d.count), 1);

  return (
    <div className="flex gap-2 items-end h-full">
      {weekPlan.map((day, idx) => {
        const isToday = idx === todayIdx;
        const heightPct = day.count > 0 ? Math.max(20, (day.count / maxCount) * 100) : 8;
        return (
          <div key={idx} className="flex flex-col items-center gap-1 flex-1">
            {/* Count */}
            {day.count > 0 && (
              <span className="text-[10px] font-bold" style={{ color: isToday ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}>
                {day.count}
              </span>
            )}
            {/* Bar */}
            <div className="w-full rounded-t-md transition-all duration-500" style={{
              height: `${heightPct}%`,
              background: isToday
                ? 'linear-gradient(to top, #1d4ed8, #3b82f6)'
                : day.count > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
              boxShadow: isToday ? '0 0 12px rgba(59,130,246,0.5)' : 'none',
              minHeight: 6,
            }} />
            {/* Day label */}
            <span className="text-[10px] font-medium capitalize" style={{ color: isToday ? '#93c5fd' : 'rgba(255,255,255,0.3)' }}>
              {day.dayLabel.split(' ')[0]}
            </span>
            {isToday && <div className="w-1 h-1 rounded-full" style={{ background: '#3b82f6' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────
function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ color }}>{icon}</div>
      <div className="text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[11px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const enterFullscreen = useFullscreen();
  const now = useClock();
  const weather = useWeather();
  const { techSummaries, unassignedToday, weekPlan, stats, loading, refresh } = useTVData();
  useWebhookRefresh(refresh, { resourceTypes: ['intervention'], showToast: false });

  React.useEffect(() => { enterFullscreen(); }, [enterFullscreen]);

  const traffic = getTrafficLabel(now.getHours());

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const colonVisible = now.getSeconds() % 2 === 0;

  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Ticker messages
  const tickerMessages = React.useMemo(() => {
    const msgs: string[] = [];
    const urgentItems = techSummaries.flatMap(t => t.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical'));
    if (urgentItems.length > 0) {
      msgs.push(`🚨 ${urgentItems.length} intervention(s) URGENTE(S) aujourd'hui`);
      urgentItems.slice(0, 2).forEach(u => msgs.push(`⚡ URGENT : ${u.intervention_label}${u.client_name ? ` — ${u.client_name}` : ''}${u.user_name ? ` → ${u.user_name}` : ''}`));
    }
    msgs.push(`📋 ${stats.total} intervention(s) planifiée(s) — ${stats.techs} technicien(s) mobilisé(s) aujourd'hui`);
    if (stats.weeklyHours > 0) msgs.push(`⏱️ ${stats.weeklyHours}h travaillées cette semaine`);
    const h = now.getHours();
    if (h < 10) msgs.push('☀️ Bonne journée à toute l\'équipe ENES Électricité !');
    else if (h >= 12 && h < 14) msgs.push('🍽️ Bon appétit à tous !');
    else if (h >= 17) msgs.push('👏 Excellent travail aujourd\'hui, toute l\'équipe !');
    msgs.push('⚡ ENES Électricité — Excellence & Fiabilité');
    return [...msgs, ...msgs];
  }, [techSummaries, stats, now]);

  // Column layout: determine how many tech columns to show
  const maxCols = Math.min(techSummaries.length, 5);

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none" style={{
      background: 'linear-gradient(160deg, #060d1f 0%, #0a1628 40%, #0d1f3a 100%)',
      color: '#fff',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ═══ TOP HEADER BAR ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 gap-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>

        {/* Logo + Date */}
        <div className="flex items-center gap-5 min-w-0">
          <img src={logoEnes} alt="ENES" className="h-12 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.4))' }} />
          <div>
            <div className="text-2xl font-black tracking-tight" style={{ color: '#f1f5f9' }}>ENES Électricité</div>
            <div className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>{todayFormatted}</div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="flex items-center gap-3">
          <StatChip icon={<Wrench className="h-5 w-5" />} value={stats.total} label="Aujourd'hui" color="#60a5fa" />
          {stats.urgent > 0 && <StatChip icon={<Zap className="h-5 w-5" />} value={stats.urgent} label="Urgentes" color="#f87171" />}
          <StatChip icon={<Users className="h-5 w-5" />} value={stats.techs} label="Techniciens" color="#34d399" />
          {stats.weeklyHours > 0 && <StatChip icon={<Clock className="h-5 w-5" />} value={`${stats.weeklyHours}h`} label="Cette semaine" color="#fbbf24" />}
        </div>

        {/* Weather + Clock */}
        <div className="flex items-center gap-5 flex-shrink-0">
          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <WeatherIcon desc={weather.description} size="md" />
              <div>
                <div className="text-2xl font-black" style={{ color: '#f1f5f9' }}>{weather.temp}°C</div>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{weather.description}</div>
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-1"><Wind className="h-3 w-3" /> {weather.wind} km/h</div>
                <div>{weather.humidity}% hum.</div>
              </div>
            </div>
          )}

          {/* Traffic pill */}
          <div className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: traffic.color, border: `1px solid ${traffic.color}30` }}>
            {traffic.label}
          </div>

          {/* Digital clock */}
          <div className="tabular-nums flex items-baseline gap-0.5">
            <span className="text-6xl font-black" style={{ color: '#93c5fd', textShadow: '0 0 30px rgba(96,165,250,0.5)' }}>{hours}</span>
            <span className="text-6xl font-black" style={{ color: colonVisible ? '#93c5fd' : 'transparent', transition: 'color 0.1s' }}>:</span>
            <span className="text-6xl font-black" style={{ color: '#93c5fd', textShadow: '0 0 30px rgba(96,165,250,0.5)' }}>{minutes}</span>
            <span className="text-2xl font-bold self-end mb-1.5 ml-1" style={{ color: '#60a5fa', opacity: 0.6 }}>{seconds}</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex min-h-0 gap-0">

        {/* LEFT: Week mini bar chart */}
        <div className="flex-shrink-0 w-48 flex flex-col p-4 gap-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Calendar className="h-4 w-4" style={{ color: '#60a5fa' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>7 prochains jours</span>
          </div>
          <div className="flex-1 min-h-0">
            <WeekTimeline weekPlan={weekPlan} />
          </div>

          {/* Upcoming days list */}
          <div className="flex-shrink-0 space-y-1.5">
            {weekPlan.slice(1, 4).filter(d => d.count > 0).map((day, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="capitalize font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{day.dayLabel}</span>
                <span className="font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Tech columns */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 p-4 gap-3">
          {/* Section title */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: '#60a5fa' }} />
              <span className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Interventions du jour</span>
            </div>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {stats.total} intervention{stats.total !== 1 ? 's' : ''} · {stats.techs} technicien{stats.techs !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" style={{ animation: 'spin 1s linear infinite' }} />
                <span className="text-sm">Chargement des données…</span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : techSummaries.length === 0 && unassignedToday.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <Calendar className="h-20 w-20" />
              <p className="text-xl">Aucune intervention planifiée aujourd'hui</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
              {/* Tech columns */}
              {techSummaries.map((tech) => (
                <div key={tech.name} className="flex-1 min-w-0 flex flex-col min-h-0" style={{ minWidth: 0, maxWidth: maxCols <= 3 ? '33%' : maxCols <= 4 ? '25%' : '20%' }}>
                  <TechColumn tech={tech} />
                </div>
              ))}

              {/* Unassigned column */}
              {unassignedToday.length > 0 && (
                <div className="flex-1 min-w-0 flex flex-col min-h-0" style={{ minWidth: 0, maxWidth: '20%' }}>
                  <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <Circle className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Non assigné</div>
                        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{unassignedToday.length} en attente</div>
                      </div>
                    </div>
                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {unassignedToday.map((item, idx) => (
                        <div key={idx} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {item.intervention_ref && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 inline-block" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                              #{item.intervention_ref}
                            </span>
                          )}
                          <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.intervention_label}</div>
                          {item.client_name && (
                            <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              <Building2 className="h-3 w-3" /> {item.client_name}
                            </div>
                          )}
                          {item.location && (
                            <div className="text-[11px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              <MapPin className="h-3 w-3" /> {item.location}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM TICKER ═══ */}
      <Ticker messages={tickerMessages} />
    </div>
  );
}
