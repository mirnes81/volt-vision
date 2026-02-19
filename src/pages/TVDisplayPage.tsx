import * as React from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, Wind, MapPin,
  Zap, Clock, Users, Wrench, CheckCircle2, Circle,
  AlertCircle, Building2, BarChart3, ListChecks, TrendingUp, Timer
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
  date_planned_full: string | null;
  duration_hours: number | null;
  bon_gerance?: string | null;
  operational_status: string | null;  // statut opérationnel
}

interface TechSummary {
  name: string;
  interventions: TodayIntervention[];
  colorIdx: number;
}

// Weekly stats per technician
interface TechWeekStat {
  name: string;
  colorIdx: number;
  totalWeek: number;       // total assigned this week
  doneWeek: number;        // completed (operational status = terminé)
  todayCount: number;      // today specifically
}

// Pending interventions (not finished, from all assignments)
interface PendingIntervention {
  intervention_ref: string;
  intervention_label: string;
  client_name: string | null;
  location: string | null;
  priority: string;
  user_name: string;
  date_label: string;
  colorIdx: number;
}

// ─── Tech color palette ───────────────────────────────────────────────
const TECH_PALETTE = [
  { accent: '#3b82f6', light: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  { accent: '#10b981', light: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  { accent: '#8b5cf6', light: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  { accent: '#f59e0b', light: '#fcd34d', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  { accent: '#06b6d4', light: '#67e8f9', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' },
  { accent: '#f43f5e', light: '#fda4af', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
  { accent: '#14b8a6', light: '#5eead4', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)' },
  { accent: '#f97316', light: '#fdba74', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
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
    95: 'Orage', 96: 'Orage grêle', 99: 'Orage violent',
  };
  return map[code] || 'Variable';
}

function WeatherIcon({ desc }: { desc: string }) {
  const d = desc.toLowerCase();
  if (d.includes('neige')) return <CloudSnow className="h-7 w-7 text-blue-200" />;
  if (d.includes('pluie') || d.includes('averse') || d.includes('bruine')) return <CloudRain className="h-7 w-7 text-blue-300" />;
  if (d.includes('nuag') || d.includes('couvert') || d.includes('brouillard')) return <Cloud className="h-7 w-7 text-gray-300" />;
  return <Sun className="h-7 w-7 text-yellow-400" />;
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

// ─── Main data hook ──────────────────────────────────────────────────
function useTVData() {
  const [techSummaries, setTechSummaries] = React.useState<TechSummary[]>([]);
  const [unassignedToday, setUnassignedToday] = React.useState<TodayIntervention[]>([]);
  const [techWeekStats, setTechWeekStats] = React.useState<TechWeekStat[]>([]);
  const [pendingInterventions, setPendingInterventions] = React.useState<PendingIntervention[]>([]);
  const [stats, setStats] = React.useState({ total: 0, urgent: 0, techs: 0, weeklyHours: 0 });
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      const today = new Date();
      const cetNow = new Date(today.getTime() + 3600000);
      const todayStr = cetNow.toISOString().split('T')[0];

      // Week boundaries (Monday to Sunday)
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const mondayStr = new Date(monday.getTime() + 3600000).toISOString().split('T')[0];
      const sundayStr = new Date(monday.getTime() + 7 * 86400000 + 3600000).toISOString().split('T')[0];

      const [assignResult, dolibarrResult, dateOverridesResult, operStatusResult, weekHoursResult] = await Promise.all([
        supabase
          .from('intervention_assignments')
          .select('user_name, intervention_label, intervention_ref, intervention_id, client_name, location, priority, date_planned, description')
          .eq('tenant_id', TENANT_ID)
          .order('user_name'),
        supabase.functions.invoke('dolibarr-api', { body: { action: 'get-interventions', params: {} } }).catch(() => ({ data: null })),
        supabase.from('intervention_date_overrides').select('intervention_id, override_date').eq('tenant_id', TENANT_ID),
        supabase.from('intervention_operational_status').select('intervention_id, operational_status').eq('tenant_id', TENANT_ID),
        supabase.from('weekly_work_summary').select('total_minutes, user_id').eq('tenant_id', TENANT_ID),
      ]);

      // Build date overrides map
      const dateOverrides = new Map<number, string>();
      for (const row of (dateOverridesResult?.data || [])) {
        dateOverrides.set(row.intervention_id, row.override_date);
      }

      // Operational status map (intervention_id -> status)
      const opStatusMap = new Map<number, string>();
      for (const row of (operStatusResult?.data || [])) {
        opStatusMap.set(row.intervention_id, row.operational_status);
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
          dolibarrDateMap.set(intId, new Date(new Date(override).getTime() + 3600000).toISOString().split('T')[0]);
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

      // Tech name -> color index (stable, sorted alphabetically)
      const allTechNames = Array.from(new Set((assignResult.data || []).map(r => r.user_name || '').filter(Boolean))).sort();
      const techColorMap = new Map<string, number>();
      allTechNames.forEach((name, idx) => techColorMap.set(name, idx % TECH_PALETTE.length));

      // Process all assignments
      const assignedInterventionIds = new Set<number>();
      const techTodayMap = new Map<string, TodayIntervention[]>();
      const techWeekMap = new Map<string, { total: number; done: number; todayCount: number }>();
      const pendingList: PendingIntervention[] = [];

      for (const row of (assignResult.data || [])) {
        const intId = row.intervention_id ? Number(row.intervention_id) : null;
        if (intId) assignedInterventionIds.add(intId);

        const name = row.user_name || 'Non assigné';
        if (!techWeekMap.has(name)) techWeekMap.set(name, { total: 0, done: 0, todayCount: 0 });

        let dateKey: string | null = null;
        const dolibarrDate = intId ? dolibarrDateMap.get(intId) : undefined;

        if (dolibarrDate) {
          dateKey = dolibarrDate;
        } else if (row.date_planned) {
          dateKey = new Date(new Date(row.date_planned).getTime() + 3600000).toISOString().split('T')[0];
        }

        // Weekly count: only current week
        if (dateKey && dateKey >= mondayStr && dateKey < sundayStr) {
          techWeekMap.get(name)!.total++;
          const opStatus = intId ? opStatusMap.get(intId) : null;
          if (opStatus === 'termine') techWeekMap.get(name)!.done++;
          if (dateKey === todayStr) techWeekMap.get(name)!.todayCount++;
        }

        // Skip past dates for today column
        if (!dateKey || dateKey !== todayStr) {
          // Add to pending if it's in the future or today and not done
          if (dateKey && dateKey >= todayStr) {
            const opStatus = intId ? opStatusMap.get(intId) : null;
            if (opStatus !== 'termine') {
              const dayDiff = Math.round((new Date(dateKey).getTime() - new Date(todayStr).getTime()) / 86400000);
              let dateLabel = 'Aujourd\'hui';
              if (dayDiff === 1) dateLabel = 'Demain';
              else if (dayDiff > 1) dateLabel = new Date(dateKey).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });

              pendingList.push({
                intervention_ref: row.intervention_ref || '',
                intervention_label: decodeHtmlEntities(row.intervention_label || 'Intervention'),
                client_name: row.client_name ? decodeHtmlEntities(row.client_name) : null,
                location: row.location ? decodeHtmlEntities(row.location) : null,
                priority: row.priority || 'normal',
                user_name: name,
                date_label: dateLabel,
                colorIdx: techColorMap.get(name) ?? 0,
              });
            }
          }
          continue;
        }

        // Today's assignments per tech
        if (!techTodayMap.has(name)) techTodayMap.set(name, []);

        let timePlanned: string | null = null;
        if (row.date_planned) {
          const dp = new Date(row.date_planned);
          const h = dp.getHours(), m = dp.getMinutes();
          if (h > 0 || m > 0) timePlanned = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        const dolibarrInt = intId ? dolibarrDataMap.get(intId) : null;
        const rawDesc = (row as any).description || dolibarrInt?.description || dolibarrInt?.note_public || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

        // Duration from Dolibarr (durationHours or computed from dateo/datee)
        let durationHours: number | null = null;
        if (dolibarrInt) {
          const ef = dolibarrInt.array_options || {};
          if (ef.options_dureeestimee) {
            durationHours = parseFloat(ef.options_dureeestimee) || null;
          } else if (dolibarrInt.dateo && dolibarrInt.datee) {
            const diffMs = (Number(dolibarrInt.datee) - Number(dolibarrInt.dateo)) * 1000;
            if (diffMs > 0) durationHours = Math.round((diffMs / 3600000) * 10) / 10;
          }
        }

        // Full planned date/time string
        let datePlannedFull: string | null = null;
        if (row.date_planned) {
          const dp = new Date(row.date_planned);
          datePlannedFull = dp.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
        }

        const bonGerance = dolibarrInt?.array_options?.options_bongerance || null;

        techTodayMap.get(name)!.push({
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
          date_planned_full: datePlannedFull,
          duration_hours: durationHours,
          bon_gerance: bonGerance,
          operational_status: intId ? (opStatusMap.get(intId) || null) : null,
        });
      }

      // Unassigned today
      const yesterdayStr = new Date(cetNow.getTime() - 86400000).toISOString().split('T')[0];
      const unassigned: TodayIntervention[] = [];
      for (const int of dolibarrInterventions) {
        const intId = Number(int.id);
        if (assignedInterventionIds.has(intId)) continue;
        if (int.fk_statut === '3' || int.fk_statut === 3) continue;
        const dateStr = dolibarrDateMap.get(intId);
        if (!dateStr || (dateStr !== todayStr && dateStr !== yesterdayStr)) continue;
        const rawDesc = (int.description || int.note_public || '').replace(/<[^>]*>/g, '').trim();
        // Compute date & time from dolibarr data for unassigned
        const ef = int.array_options || {};
        const customTs = Number(ef.options_interventiondateheur || 0);
        const rawTs = customTs > 0 ? customTs : Number(int.dateo || 0);
        let unassignedDateFull: string | null = null;
        let unassignedTime: string | null = null;
        if (rawTs > 0) {
          const d = new Date((rawTs + 3600) * 1000);
          unassignedDateFull = d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
          const h = d.getHours(), m = d.getMinutes();
          if (h > 0 || m > 0) unassignedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        // Duration from dolibarr
        let unassignedDuration: number | null = null;
        if (ef.options_dureeestimee) {
          unassignedDuration = parseFloat(ef.options_dureeestimee) || null;
        } else if (int.dateo && int.datee) {
          const diffMs = (Number(int.datee) - Number(int.dateo)) * 1000;
          if (diffMs > 0) unassignedDuration = Math.round((diffMs / 3600000) * 10) / 10;
        }
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
          time_planned: unassignedTime,
          date_planned_full: unassignedDateFull,
          duration_hours: unassignedDuration,
          bon_gerance: ef.options_bongerance || null,
          operational_status: opStatusMap.get(intId) || null,
        });
      }

      // Build tech summaries for today
      const summaries: TechSummary[] = allTechNames
        .filter(name => techTodayMap.has(name))
        .map(name => ({
          name,
          interventions: (techTodayMap.get(name) || []).sort((a, b) => {
            const pa = a.priority === 'critical' ? 0 : a.priority === 'urgent' ? 1 : 2;
            const pb = b.priority === 'critical' ? 0 : b.priority === 'urgent' ? 1 : 2;
            return pa - pb;
          }),
          colorIdx: techColorMap.get(name) ?? 0,
        }));

      // Build weekly stats (all techs that have any assignment this week)
      const weekStats: TechWeekStat[] = allTechNames
        .map(name => {
          const w = techWeekMap.get(name) || { total: 0, done: 0, todayCount: 0 };
          return {
            name,
            colorIdx: techColorMap.get(name) ?? 0,
            totalWeek: w.total,
            doneWeek: w.done,
            todayCount: w.todayCount,
          };
        })
        .filter(t => t.totalWeek > 0)
        .sort((a, b) => b.totalWeek - a.totalWeek);

      // Sort pending: urgent first, then by date
      const sortedPending = pendingList.sort((a, b) => {
        const pa = a.priority === 'critical' ? 0 : a.priority === 'urgent' ? 1 : 2;
        const pb = b.priority === 'critical' ? 0 : b.priority === 'urgent' ? 1 : 2;
        return pa - pb;
      }).slice(0, 20);

      const totalToday = summaries.reduce((s, t) => s + t.interventions.length, 0) + unassigned.length;
      const urgentCount = summaries.reduce((s, t) => s + t.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical').length, 0);
      const weeklyHours = Math.round((weekHoursResult.data || []).reduce((s, w) => s + (w.total_minutes || 0), 0) / 60);

      setTechSummaries(summaries);
      setUnassignedToday(unassigned);
      setTechWeekStats(weekStats);
      setPendingInterventions(sortedPending);
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

  return { techSummaries, unassignedToday, techWeekStats, pendingInterventions, stats, loading, refresh: fetchData };
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
    <div className="relative overflow-hidden h-10 flex items-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="absolute whitespace-nowrap text-sm font-medium"
        style={{ animation: `ticker ${duration}s linear infinite`, color: 'rgba(148,163,184,0.7)' }}>
        {text}
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'critical') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
      <AlertCircle className="h-2.5 w-2.5" /> Critique
    </span>
  );
  if (priority === 'urgent') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.25)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' }}>
      <Zap className="h-2.5 w-2.5" /> Urgent
    </span>
  );
  return null;
}

// ─── Operational Status Badge ────────────────────────────────────────
function OpStatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'a_faire') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
      <Circle className="h-2.5 w-2.5" /> À faire
    </span>
  );
  if (status === 'en_cours') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)' }}>
      <Zap className="h-2.5 w-2.5" /> En cours
    </span>
  );
  if (status === 'a_terminer') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.35)' }}>
      <AlertCircle className="h-2.5 w-2.5" /> À terminer
    </span>
  );
  if (status === 'pas_termine') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)' }}>
      <AlertCircle className="h-2.5 w-2.5" /> Pas terminé
    </span>
  );
  if (status === 'a_revenir') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.2)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.35)' }}>
      <AlertCircle className="h-2.5 w-2.5" /> À revenir
    </span>
  );
  if (status === 'termine') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.35)' }}>
      <CheckCircle2 className="h-2.5 w-2.5" /> Terminé
    </span>
  );
  return null;
}

// ─── Intervention Card ────────────────────────────────────────────────
function InterventionCard({ item, palette }: { item: TodayIntervention; palette: typeof TECH_PALETTE[0] }) {
  const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
  const isDone = item.operational_status === 'termine';
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{
      background: isDone ? 'rgba(16,185,129,0.05)' : isUrgent ? 'rgba(239,68,68,0.08)' : palette.bg,
      border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isUrgent ? 'rgba(239,68,68,0.5)' : palette.border}`,
      opacity: isDone ? 0.8 : 1,
    }}>

      {/* ── Bande technicien + date/heure ── */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-2 flex-wrap" style={{
        background: isDone ? 'rgba(16,185,129,0.1)' : palette.accent + '18',
        borderBottom: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : palette.border}`,
      }}>
        {/* Technicien assigné */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
            style={{ background: palette.accent + '50', color: palette.light }}>
            {item.user_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <span className="text-[11px] font-bold" style={{ color: palette.light }}>
            {item.user_name}
          </span>
        </div>
        {/* Date + heure */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.date_planned_full && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              📅 {item.date_planned_full}
            </span>
          )}
          {item.time_planned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}>
              <Clock className="h-2.5 w-2.5" /> {item.time_planned}
            </span>
          )}
          {item.duration_hours && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }}>
              <Timer className="h-2.5 w-2.5" /> ~{item.duration_hours}h
            </span>
          )}
        </div>
      </div>

      {/* ── Corps de la carte ── */}
      <div className="p-3 flex flex-col gap-1.5">
        {/* Ref + statut + priorité */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.bon_gerance ? (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.15)', color: '#fde047', border: '1px solid rgba(250,204,21,0.3)' }}>
              BON #{item.bon_gerance}
            </span>
          ) : item.intervention_ref && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              #{item.intervention_ref}
            </span>
          )}
          <OpStatusBadge status={item.operational_status} />
          <div className="ml-auto"><PriorityBadge priority={item.priority} /></div>
        </div>

        {/* Label */}
        <div className="text-sm font-bold leading-snug" style={{ color: isDone ? '#6ee7b7' : isUrgent ? '#fca5a5' : 'rgba(255,255,255,0.92)' }}>
          {isDone && '✓ '}{item.intervention_label}
        </div>

        {/* Client */}
        {item.client_name && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Building2 className="h-3 w-3 flex-shrink-0" style={{ color: palette.light }} />
            <span className="truncate font-semibold">{item.client_name}</span>
          </div>
        )}

        {/* Adresse chantier */}
        {item.location && (
          <div className="flex items-start gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
            <span className="line-clamp-2 leading-tight">{item.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tech Column ─────────────────────────────────────────────────────
function TechColumn({ tech }: { tech: TechSummary }) {
  const palette = TECH_PALETTE[tech.colorIdx];
  const initials = tech.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const urgentCount = tech.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical').length;

  return (
    <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden flex-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 0 }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${palette.bg}, rgba(0,0,0,0.2))`, borderBottom: `1px solid ${palette.border}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.accent}88)`, color: '#fff', boxShadow: `0 0 14px ${palette.accent}40` }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: palette.light }}>{tech.name}</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {tech.interventions.length} intervention{tech.interventions.length !== 1 ? 's' : ''}
            {urgentCount > 0 && <span style={{ color: '#fca5a5' }}> · {urgentCount} urgent{urgentCount > 1 ? 'es' : 'e'}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base font-black" style={{ background: palette.accent + '30', color: palette.light }}>
          {tech.interventions.length}
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {tech.interventions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <CheckCircle2 className="h-5 w-5" />
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

// ─── Widget: Semaine par technicien ──────────────────────────────────
function WeekStatsWidget({ stats }: { stats: TechWeekStat[] }) {
  return (
    <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(59,130,246,0.08)' }}>
        <BarChart3 className="h-4 w-4" style={{ color: '#60a5fa' }} />
        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.75)' }}>Interventions — semaine en cours</span>
      </div>
      {/* Rows */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {stats.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Aucune donnée cette semaine</div>
        ) : stats.map((tech) => {
          const palette = TECH_PALETTE[tech.colorIdx];
          const initials = tech.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          const remaining = tech.totalWeek - tech.doneWeek;
          const pct = tech.totalWeek > 0 ? Math.round((tech.doneWeek / tech.totalWeek) * 100) : 0;
          return (
            <div key={tech.name} className="rounded-xl p-3" style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
              {/* Name + avatar */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={{ background: palette.accent + '40', color: palette.light }}>
                  {initials}
                </div>
                <span className="text-sm font-bold truncate" style={{ color: palette.light }}>{tech.name}</span>
                {tech.todayCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                    {tech.todayCount} auj.
                  </span>
                )}
              </div>
              {/* Stats row */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-xl font-black tabular-nums" style={{ color: '#f1f5f9' }}>{tech.totalWeek}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>total</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
                  <span className="text-sm font-bold" style={{ color: '#34d399' }}>{tech.doneWeek}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>terminé{tech.doneWeek > 1 ? 'es' : 'e'}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex items-center gap-1">
                    <Circle className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />
                    <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>{remaining}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>rest.</span>
                  </div>
                )}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${palette.accent}, ${palette.light})` }} />
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{pct}% réalisé</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Widget: Interventions restantes ─────────────────────────────────
function PendingWidget({ pending }: { pending: PendingIntervention[] }) {
  return (
    <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(245,158,11,0.07)' }}>
        <ListChecks className="h-4 w-4" style={{ color: '#fbbf24' }} />
        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.75)' }}>À réaliser</span>
        {pending.length > 0 && (
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
            {pending.length}
          </span>
        )}
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: '#34d399', opacity: 0.6 }} />
            <span className="text-xs">Toutes les interventions sont terminées 🎉</span>
          </div>
        ) : pending.map((item, idx) => {
          const palette = TECH_PALETTE[item.colorIdx];
          const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
          const isToday = item.date_label === 'Aujourd\'hui';
          return (
            <div key={idx} className="rounded-xl p-2.5" style={{
              background: isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  {item.intervention_ref && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded mr-1" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                      #{item.intervention_ref}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                    background: isToday ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isToday ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                  }}>
                    {item.date_label}
                  </span>
                </div>
                {isUrgent && <PriorityBadge priority={item.priority} />}
              </div>
              <div className="text-xs font-bold leading-snug" style={{ color: isUrgent ? '#fca5a5' : 'rgba(255,255,255,0.8)' }}>
                {item.intervention_label}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {item.client_name && (
                  <span className="text-[10px] flex items-center gap-1 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <Building2 className="h-2.5 w-2.5 flex-shrink-0" style={{ color: palette.light }} />
                    {item.client_name}
                  </span>
                )}
                <span className="text-[10px] font-semibold ml-auto" style={{ color: palette.light }}>
                  {item.user_name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────
function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ color }}>{icon}</div>
      <div className="text-2xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] font-medium text-center leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const enterFullscreen = useFullscreen();
  const now = useClock();
  const weather = useWeather();
  const { techSummaries, unassignedToday, techWeekStats, pendingInterventions, stats, loading, refresh } = useTVData();
  useWebhookRefresh(refresh, { resourceTypes: ['intervention'], showToast: false });

  React.useEffect(() => { enterFullscreen(); }, [enterFullscreen]);

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const colonVisible = now.getSeconds() % 2 === 0;
  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const tickerMessages = React.useMemo(() => {
    const msgs: string[] = [];
    const urgentItems = techSummaries.flatMap(t => t.interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical'));
    if (urgentItems.length > 0) {
      msgs.push(`🚨 ${urgentItems.length} intervention(s) URGENTE(S) aujourd'hui`);
      urgentItems.slice(0, 2).forEach(u => msgs.push(`⚡ URGENT : ${u.intervention_label}${u.client_name ? ` — ${u.client_name}` : ''}${u.user_name ? ` → ${u.user_name}` : ''}`));
    }
    msgs.push(`📋 ${stats.total} intervention(s) planifiée(s) aujourd'hui — ${stats.techs} technicien(s) mobilisé(s)`);
    if (stats.weeklyHours > 0) msgs.push(`⏱️ ${stats.weeklyHours}h travaillées cette semaine par l'équipe`);
    const h = now.getHours();
    if (h < 10) msgs.push('☀️ Bonne journée à toute l\'équipe ENES Électricité !');
    else if (h >= 12 && h < 14) msgs.push('🍽️ Bon appétit à tous !');
    else if (h >= 17) msgs.push('👏 Excellent travail aujourd\'hui, toute l\'équipe !');
    msgs.push('⚡ ENES Électricité — Excellence & Fiabilité');
    return [...msgs, ...msgs];
  }, [techSummaries, stats, now]);

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none" style={{
      background: 'linear-gradient(160deg, #060d1f 0%, #0a1628 45%, #0d1f3a 100%)',
      color: '#fff',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ═══ HEADER ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)' }}>
        {/* Logo + Date */}
        <div className="flex items-center gap-4">
          <img src={logoEnes} alt="ENES" className="h-11 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.4))' }} />
          <div>
            <div className="text-xl font-black" style={{ color: '#f1f5f9' }}>ENES Électricité</div>
            <div className="text-xs capitalize" style={{ color: 'rgba(148,163,184,0.6)' }}>{dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="flex items-center gap-2.5">
          <StatChip icon={<Wrench className="h-4 w-4" />} value={stats.total} label="Aujourd'hui" color="#60a5fa" />
          {stats.urgent > 0 && <StatChip icon={<Zap className="h-4 w-4" />} value={stats.urgent} label="Urgentes" color="#f87171" />}
          <StatChip icon={<Users className="h-4 w-4" />} value={stats.techs} label="Techniciens" color="#34d399" />
          {stats.weeklyHours > 0 && <StatChip icon={<Clock className="h-4 w-4" />} value={`${stats.weeklyHours}h`} label="Cette semaine" color="#fbbf24" />}
          <StatChip icon={<TrendingUp className="h-4 w-4" />} value={pendingInterventions.length} label="À réaliser" color="#a78bfa" />
        </div>

        {/* Weather + Clock */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {weather && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <WeatherIcon desc={weather.description} />
              <div>
                <div className="text-xl font-black" style={{ color: '#f1f5f9' }}>{weather.temp}°C</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{weather.description}</div>
              </div>
              <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-1"><Wind className="h-2.5 w-2.5" /> {weather.wind} km/h</div>
                <div>{weather.humidity}% hum.</div>
              </div>
            </div>
          )}
          {/* Clock */}
          <div className="tabular-nums flex items-baseline gap-0.5">
            <span className="text-5xl font-black" style={{ color: '#93c5fd', textShadow: '0 0 25px rgba(96,165,250,0.5)' }}>{hours}</span>
            <span className="text-5xl font-black" style={{ color: colonVisible ? '#93c5fd' : 'transparent', transition: 'color 0.1s' }}>:</span>
            <span className="text-5xl font-black" style={{ color: '#93c5fd', textShadow: '0 0 25px rgba(96,165,250,0.5)' }}>{minutes}</span>
            <span className="text-xl font-bold self-end mb-1 ml-1" style={{ color: '#60a5fa', opacity: 0.6 }}>{seconds}</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN: 2 colonnes ═══ */}
      <div className="flex-1 flex min-h-0 gap-0">

        {/* ── GAUCHE (large): Colonnes techniciens ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 p-4 gap-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Subtitle */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Zap className="h-4 w-4 flex-shrink-0" style={{ color: '#60a5fa' }} />
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Interventions du jour</span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" style={{ animation: 'spin 1s linear infinite' }} />
                <span className="text-sm">Chargement…</span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : techSummaries.length === 0 && unassignedToday.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <CheckCircle2 className="h-16 w-16" style={{ color: '#34d399', opacity: 0.4 }} />
              <p className="text-lg">Aucune intervention planifiée aujourd'hui</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
              {techSummaries.map((tech) => (
                <TechColumn key={tech.name} tech={tech} />
              ))}
              {/* Unassigned column */}
              {unassignedToday.length > 0 && (
                <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden flex-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}>
                  <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                      <Circle className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Non assigné</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{unassignedToday.length} en attente</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                    {unassignedToday.map((item, idx) => (
                      <InterventionCard
                        key={`unassigned-${item.intervention_ref}-${idx}`}
                        item={item}
                        palette={{ accent: '#64748b', light: '#94a3b8', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DROITE (widgets): 320px ── */}
        <div className="w-80 flex-shrink-0 flex flex-col p-4 gap-4 min-h-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
          {/* Widget 1: Semaine par technicien */}
          <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <WeekStatsWidget stats={techWeekStats} />
          </div>
          {/* Divider */}
          <div className="flex-shrink-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          {/* Widget 2: À réaliser */}
          <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <PendingWidget pending={pendingInterventions} />
          </div>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <Ticker messages={tickerMessages} />
    </div>
  );
}
