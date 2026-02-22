import * as React from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, Wind, MapPin,
  Zap, Clock, Users, Wrench, CheckCircle2, Circle,
  AlertCircle, Building2, BarChart3, ListChecks, TrendingUp, Timer,
  Hash, Home, Phone
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
  briefing: string | null;
  isAssigned: boolean;
  time_planned: string | null;
  date_planned_full: string | null;
  duration_hours: number | null;
  bon_gerance?: string | null;
  operational_status: string | null;
  estimated_hours: number | null;
  intervention_type: string | null;
  no_immeuble: string | null;
  proprietaire: string | null;
  concierge: string | null;
  appartement: string | null;
}

interface TechSummary {
  name: string;
  interventions: TodayIntervention[];
  colorIdx: number;
}

interface TechWeekStat {
  name: string;
  colorIdx: number;
  totalWeek: number;
  doneWeek: number;
  todayCount: number;
}

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

// ─── THEME: Light/white with blue accents (like dashboard) ──────────
const THEME = {
  bg: 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 45%, #e8eef6 100%)',
  headerBg: '#ffffff',
  headerBorder: '#e2e8f0',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  sectionTitle: '#2563eb',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  clockColor: '#2563eb',
  clockGlow: 'rgba(37,99,235,0.25)',
  accent: '#2563eb',
  accentLight: '#3b82f6',
  divider: '#e2e8f0',
};

// Tech color palette (vivid on white background)
const TECH_PALETTE = [
  { accent: '#2563eb', light: '#2563eb', bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.2)' },
  { accent: '#059669', light: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.2)' },
  { accent: '#7c3aed', light: '#7c3aed', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.2)' },
  { accent: '#d97706', light: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' },
  { accent: '#0891b2', light: '#0891b2', bg: 'rgba(8,145,178,0.06)', border: 'rgba(8,145,178,0.2)' },
  { accent: '#e11d48', light: '#e11d48', bg: 'rgba(225,29,72,0.06)', border: 'rgba(225,29,72,0.2)' },
  { accent: '#0d9488', light: '#0d9488', bg: 'rgba(13,148,136,0.06)', border: 'rgba(13,148,136,0.2)' },
  { accent: '#ea580c', light: '#ea580c', bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.2)' },
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
  if (d.includes('neige')) return <CloudSnow className="h-6 w-6" style={{ color: '#bfdbfe' }} />;
  if (d.includes('pluie') || d.includes('averse') || d.includes('bruine')) return <CloudRain className="h-6 w-6" style={{ color: '#93c5fd' }} />;
  if (d.includes('nuag') || d.includes('couvert') || d.includes('brouillard')) return <Cloud className="h-6 w-6" style={{ color: '#cbd5e1' }} />;
  return <Sun className="h-6 w-6" style={{ color: '#fbbf24' }} />;
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
        supabase.from('intervention_operational_status').select('intervention_id, operational_status, estimated_hours').eq('tenant_id', TENANT_ID),
        supabase.from('weekly_work_summary').select('total_minutes, user_id').eq('tenant_id', TENANT_ID),
      ]);

      const dateOverrides = new Map<number, string>();
      for (const row of (dateOverridesResult?.data || [])) {
        dateOverrides.set(row.intervention_id, row.override_date);
      }

      const opStatusMap = new Map<number, string>();
      const estimatedHoursMap = new Map<number, number>();
      for (const row of (operStatusResult?.data || [])) {
        opStatusMap.set(row.intervention_id, row.operational_status);
        if (row.estimated_hours != null) estimatedHoursMap.set(row.intervention_id, Number(row.estimated_hours));
      }

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

      const allTechNames = Array.from(new Set((assignResult.data || []).map(r => r.user_name || '').filter(Boolean))).sort();
      const techColorMap = new Map<string, number>();
      allTechNames.forEach((name, idx) => techColorMap.set(name, idx % TECH_PALETTE.length));

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

        if (dateKey && dateKey >= mondayStr && dateKey < sundayStr) {
          techWeekMap.get(name)!.total++;
          const opStatus = intId ? opStatusMap.get(intId) : null;
          if (opStatus === 'termine') techWeekMap.get(name)!.done++;
          if (dateKey === todayStr) techWeekMap.get(name)!.todayCount++;
        }

        if (!dateKey || dateKey !== todayStr) {
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

        if (!techTodayMap.has(name)) techTodayMap.set(name, []);

        const dolibarrInt = intId ? dolibarrDataMap.get(intId) : null;

        // Extract time
        let timePlanned: string | null = null;
        if (row.date_planned) {
          const dp = new Date(row.date_planned);
          const h = dp.getUTCHours(), m = dp.getUTCMinutes();
          if (h > 0 || m > 0) timePlanned = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        if (!timePlanned && dolibarrInt) {
          const ef2 = dolibarrInt.array_options || {};
          const customTs2 = Number(ef2.options_interventiondateheur || 0);
          const rawTs2 = customTs2 > 0 ? customTs2 : Number(dolibarrInt.dateo || 0);
          if (rawTs2 > 0) {
            const d2 = new Date(rawTs2 * 1000);
            const h2 = d2.getUTCHours(), m2 = d2.getUTCMinutes();
            if (h2 > 0 || m2 > 0) timePlanned = `${h2.toString().padStart(2, '0')}:${m2.toString().padStart(2, '0')}`;
          }
        }

        // FIX: Use decodeHtmlEntities for description & briefing (fixes special chars)
        const rawDesc = (row as any).description || dolibarrInt?.description || dolibarrInt?.note_public || '';
        const cleanDesc = decodeHtmlEntities(rawDesc);
        const rawBriefing = dolibarrInt?.note_private || '';
        const cleanBriefing = decodeHtmlEntities(rawBriefing);

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

        // Full planned date/time - from assignment OR Dolibarr
        let datePlannedFull: string | null = null;
        if (row.date_planned) {
          const dp = new Date(row.date_planned);
          datePlannedFull = dp.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
        } else if (intId && dolibarrDataMap.has(intId)) {
          const dInt = dolibarrDataMap.get(intId);
          const ef3 = dInt?.array_options || {};
          const ts3 = Number(ef3.options_interventiondateheur || 0) || Number(dInt?.dateo || 0);
          if (ts3 > 0) {
            const d3 = new Date((ts3 + 3600) * 1000);
            datePlannedFull = d3.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
            if (!timePlanned) {
              const h3 = d3.getHours(), m3 = d3.getMinutes();
              if (h3 > 0 || m3 > 0) timePlanned = `${h3.toString().padStart(2, '0')}:${m3.toString().padStart(2, '0')}`;
            }
          }
        }

        const bonGerance = dolibarrInt?.array_options?.options_bongerance || null;

        const dolibarrLabel = dolibarrInt ? decodeHtmlEntities(dolibarrInt.label || dolibarrInt.ref || '') : '';
        const finalLabel = (row.intervention_label && row.intervention_label !== 'Intervention')
          ? decodeHtmlEntities(row.intervention_label)
          : (dolibarrLabel || decodeHtmlEntities(row.intervention_label || 'Intervention'));

        const dolibarrAddress = dolibarrInt
          ? [dolibarrInt.address, dolibarrInt.zip, dolibarrInt.town].filter(Boolean).map(s => decodeHtmlEntities(s)).join(', ')
          : '';
        const finalLocation = dolibarrAddress || (row.location ? decodeHtmlEntities(row.location) : null);

        const ef = dolibarrInt?.array_options || {};
        const intType = ef.options_typetravaux || dolibarrInt?.type_label || null;
        const noImmeuble = ef.options_noimm || null;
        const proprietaire = ef.options_propimm ? decodeHtmlEntities(ef.options_propimm) : null;
        const concierge = ef.options_concierge ? decodeHtmlEntities(ef.options_concierge) : null;
        const appartement = ef.options_appartement ? decodeHtmlEntities(ef.options_appartement) : null;

        techTodayMap.get(name)!.push({
          intervention_id: intId,
          intervention_ref: row.intervention_ref || '',
          intervention_label: finalLabel,
          client_name: row.client_name ? decodeHtmlEntities(row.client_name) : null,
          location: finalLocation,
          priority: row.priority || 'normal',
          user_name: name,
          description: cleanDesc || null,
          briefing: cleanBriefing || null,
          isAssigned: true,
          time_planned: timePlanned,
          date_planned_full: datePlannedFull,
          duration_hours: durationHours,
          bon_gerance: bonGerance,
          operational_status: intId ? (opStatusMap.get(intId) || null) : null,
          estimated_hours: intId ? (estimatedHoursMap.get(intId) ?? null) : null,
          intervention_type: intType ? decodeHtmlEntities(intType) : null,
          no_immeuble: noImmeuble ? decodeHtmlEntities(noImmeuble) : null,
          proprietaire,
          concierge,
          appartement,
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
        const rawDesc2 = decodeHtmlEntities(int.description || int.note_public || '');
        const rawBriefing2 = decodeHtmlEntities(int.note_private || '');
        const uef = int.array_options || {};
        const customTs = Number(uef.options_interventiondateheur || 0);
        const rawTs = customTs > 0 ? customTs : Number(int.dateo || 0);
        let unassignedDateFull: string | null = null;
        let unassignedTime: string | null = null;
        if (rawTs > 0) {
          const d = new Date((rawTs + 3600) * 1000);
          unassignedDateFull = d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
          const h = d.getHours(), m = d.getMinutes();
          if (h > 0 || m > 0) unassignedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        let unassignedDuration: number | null = null;
        if (uef.options_dureeestimee) {
          unassignedDuration = parseFloat(uef.options_dureeestimee) || null;
        } else if (int.dateo && int.datee) {
          const diffMs = (Number(int.datee) - Number(int.dateo)) * 1000;
          if (diffMs > 0) unassignedDuration = Math.round((diffMs / 3600000) * 10) / 10;
        }
        const unassignedAddress = [int.address, int.zip, int.town].filter(Boolean).map(s => decodeHtmlEntities(String(s))).join(', ');
        unassigned.push({
          intervention_id: intId,
          intervention_ref: int.ref || '',
          intervention_label: decodeHtmlEntities(int.label || int.ref || 'Intervention'),
          client_name: int.thirdparty_name ? decodeHtmlEntities(int.thirdparty_name) : null,
          location: unassignedAddress || (int.address ? decodeHtmlEntities(int.address) : null),
          priority: 'normal',
          user_name: 'Non assigné',
          description: rawDesc2 || null,
          briefing: rawBriefing2 || null,
          isAssigned: false,
          time_planned: unassignedTime,
          date_planned_full: unassignedDateFull,
          duration_hours: unassignedDuration,
          bon_gerance: uef.options_bongerance || null,
          operational_status: opStatusMap.get(intId) || null,
          estimated_hours: estimatedHoursMap.get(intId) ?? null,
          intervention_type: uef.options_typetravaux ? decodeHtmlEntities(uef.options_typetravaux) : (int.type_label ? decodeHtmlEntities(int.type_label) : null),
          no_immeuble: uef.options_noimm ? decodeHtmlEntities(uef.options_noimm) : null,
          proprietaire: uef.options_propimm ? decodeHtmlEntities(uef.options_propimm) : null,
          concierge: uef.options_concierge ? decodeHtmlEntities(uef.options_concierge) : null,
          appartement: uef.options_appartement ? decodeHtmlEntities(uef.options_appartement) : null,
        });
      }

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

      const weekStats: TechWeekStat[] = allTechNames
        .map(name => {
          const w = techWeekMap.get(name) || { total: 0, done: 0, todayCount: 0 };
          return { name, colorIdx: techColorMap.get(name) ?? 0, totalWeek: w.total, doneWeek: w.done, todayCount: w.todayCount };
        })
        .filter(t => t.totalWeek > 0)
        .sort((a, b) => b.totalWeek - a.totalWeek);

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

// ─── Ticker ──────────────────────────────────────────────────────────
function Ticker({ messages }: { messages: string[] }) {
  const text = messages.join('     ◆     ');
  const duration = Math.max(messages.length * 6, 35);
  return (
    <div className="relative overflow-hidden h-9 flex items-center flex-shrink-0" style={{ background: '#1e293b', borderTop: `1px solid ${THEME.divider}` }}>
      <div className="absolute whitespace-nowrap text-xs font-semibold"
        style={{ animation: `ticker ${duration}s linear infinite`, color: '#94a3b8' }}>
        {text}
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

// ─── Status badge (compact) ──────────────────────────────────────────
function StatusDot({ status }: { status: string | null }) {
  const configs: Record<string, { color: string; label: string }> = {
    'a_faire':      { color: '#64748b', label: 'À faire' },
    'en_cours':     { color: '#2563eb', label: 'En cours' },
    'a_terminer':   { color: '#d97706', label: 'À terminer' },
    'pas_termine':  { color: '#dc2626', label: 'Pas terminé' },
    'a_revenir':    { color: '#7c3aed', label: 'À revenir' },
    'termine':      { color: '#059669', label: 'Terminé' },
  };
  const cfg = configs[status || 'a_faire'] || configs['a_faire'];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: cfg.color + '20', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

// ─── Priority badge ──────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'critical') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}>
      <AlertCircle className="h-2.5 w-2.5" /> CRITIQUE
    </span>
  );
  if (priority === 'urgent') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
      <Zap className="h-2.5 w-2.5" /> URGENT
    </span>
  );
  return null;
}

// ─── COMPACT Intervention Card ───────────────────────────────────────
function InterventionCard({ item, palette }: { item: TodayIntervention; palette: typeof TECH_PALETTE[0] }) {
  const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
  const isDone = item.operational_status === 'termine';

  return (
    <div className="rounded-lg overflow-hidden" style={{
      background: isDone ? '#f0fdf4' : isUrgent ? '#fef2f2' : '#ffffff',
      border: `1px solid ${isDone ? '#bbf7d0' : isUrgent ? '#fecaca' : palette.border}`,
      opacity: isDone ? 0.85 : 1,
    }}>
      {/* Row 1: Ref + Client + Heure + Statut — tout sur une ligne */}
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{
        background: isDone ? '#dcfce7' : palette.bg,
        borderBottom: `1px solid ${isDone ? '#bbf7d0' : palette.border}`,
      }}>
        {/* Ref */}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: palette.accent + '15', color: palette.accent }}>
          {item.intervention_ref}
        </span>

        {/* Client */}
        {item.client_name && (
          <span className="text-[12px] font-black truncate" style={{ color: THEME.textPrimary }}>
            {item.client_name}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Heure — toujours bien visible */}
        {item.time_planned && (
          <span className="inline-flex items-center gap-1 text-[12px] font-black px-2 py-0.5 rounded flex-shrink-0" style={{ background: '#2563eb', color: '#fff' }}>
            <Clock className="h-3 w-3" />
            {item.time_planned}
          </span>
        )}

        {/* Date */}
        {item.date_planned_full && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#f1f5f9', color: THEME.textSecondary }}>
            {item.date_planned_full}
          </span>
        )}

        {/* Heures prévues (admin) */}
        {item.estimated_hours != null && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.25)' }}>
            <Timer className="h-2.5 w-2.5" />
            {item.estimated_hours}h
          </span>
        )}

        {/* Durée Dolibarr */}
        {item.duration_hours && !item.estimated_hours && (
          <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(217,119,6,0.1)', color: '#d97706' }}>
            ~{item.duration_hours}h
          </span>
        )}

        {/* Statut */}
        <StatusDot status={item.operational_status} />

        {/* Priority */}
        <PriorityBadge priority={item.priority} />
      </div>

      {/* Row 2: Label + Adresse + Infos bâtiment + Description — compact */}
      <div className="px-2.5 py-1.5 flex flex-col gap-1">
        {/* Label + bon + type */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.intervention_label && item.intervention_label !== 'Intervention' && (
            <span className="text-[11px] font-semibold" style={{ color: isDone ? '#059669' : THEME.textSecondary }}>
              {isDone && '✓ '}{item.intervention_label}
            </span>
          )}
          {item.bon_gerance && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,119,6,0.1)', color: '#d97706' }}>
              BON #{item.bon_gerance}
            </span>
          )}
          {item.intervention_type && (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase" style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
              {item.intervention_type}
            </span>
          )}
        </div>

        {/* Adresse + infos bâtiment inline */}
        <div className="flex items-center gap-3 flex-wrap">
          {item.location && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: THEME.textSecondary }}>
              <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: '#fb923c' }} />
              <span className="truncate" style={{ maxWidth: '350px' }}>{item.location}</span>
            </span>
          )}
          {item.no_immeuble && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: THEME.textMuted }}>
              <Hash className="h-2.5 w-2.5" style={{ color: palette.accent }} /> Imm.{item.no_immeuble}
            </span>
          )}
          {item.proprietaire && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: THEME.textMuted }}>
              <Building2 className="h-2.5 w-2.5" style={{ color: '#d97706' }} /> {item.proprietaire}
            </span>
          )}
          {item.concierge && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: THEME.textMuted }}>
              <Phone className="h-2.5 w-2.5" style={{ color: '#059669' }} /> {item.concierge}
            </span>
          )}
        </div>

        {/* Description/Briefing — compact, 1-2 lines max */}
        {(item.description || item.briefing) && (
          <div className="text-[10px] leading-snug rounded px-2 py-1" style={{ background: '#f8fafc', borderLeft: `2px solid ${palette.accent}40`, color: THEME.textMuted }}>
            {item.description && <span>{item.description.slice(0, 150)}{item.description.length > 150 ? '…' : ''}</span>}
            {item.briefing && item.briefing !== item.description && (
              <span> — {item.briefing.slice(0, 100)}{item.briefing.length > 100 ? '…' : ''}</span>
            )}
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

  return (
    <div className="flex flex-col min-h-0 rounded-xl overflow-hidden flex-1" style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2.5 flex-shrink-0" style={{ background: palette.bg, borderBottom: `1px solid ${palette.border}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
          style={{ background: palette.accent, color: '#fff' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate" style={{ color: palette.accent }}>{tech.name}</div>
          <div className="text-[10px]" style={{ color: THEME.textMuted }}>
            {tech.interventions.length} intervention{tech.interventions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: palette.bg, color: palette.accent }}>
          {tech.interventions.length}
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {tech.interventions.length === 0 ? (
          <div className="flex items-center justify-center h-12 gap-2" style={{ color: THEME.textMuted }}>
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">RAS</span>
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
    <div className="flex flex-col min-h-0 rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.divider}`, background: '#f8fafc' }}>
        <BarChart3 className="h-3.5 w-3.5" style={{ color: THEME.accent }} />
        <span className="text-xs font-bold" style={{ color: THEME.textSecondary }}>Semaine en cours</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {stats.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: THEME.textMuted }}>Aucune donnée</div>
        ) : stats.map((tech) => {
          const palette = TECH_PALETTE[tech.colorIdx];
          const pct = tech.totalWeek > 0 ? Math.round((tech.doneWeek / tech.totalWeek) * 100) : 0;
          return (
            <div key={tech.name} className="rounded-lg p-2" style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold truncate" style={{ color: palette.accent }}>{tech.name}</span>
                <div className="flex items-center gap-2 text-[10px] flex-shrink-0">
                  <span style={{ color: '#059669' }}>{tech.doneWeek}✓</span>
                  <span style={{ color: THEME.textMuted }}>{tech.totalWeek - tech.doneWeek} rest.</span>
                  {tech.todayCount > 0 && <span className="font-bold" style={{ color: THEME.accent }}>{tech.todayCount} auj.</span>}
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: palette.accent, transition: 'width 0.5s' }} />
              </div>
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
    <div className="flex flex-col min-h-0 rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.divider}`, background: '#f8fafc' }}>
        <ListChecks className="h-3.5 w-3.5" style={{ color: '#ea580c' }} />
        <span className="text-xs font-bold" style={{ color: THEME.textSecondary }}>À réaliser</span>
        {pending.length > 0 && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c' }}>
            {pending.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-4 gap-1" style={{ color: THEME.textMuted }}>
            <CheckCircle2 className="h-6 w-6" style={{ color: '#059669', opacity: 0.5 }} />
            <span className="text-[10px]">Tout est terminé 🎉</span>
          </div>
        ) : pending.map((item, idx) => {
          const palette = TECH_PALETTE[item.colorIdx];
          const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
          return (
            <div key={idx} className="rounded-lg px-2 py-1.5" style={{
              background: isUrgent ? '#fef2f2' : '#ffffff',
              border: `1px solid ${isUrgent ? '#fecaca' : THEME.cardBorder}`,
            }}>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold truncate" style={{ color: isUrgent ? '#dc2626' : THEME.textPrimary }}>
                  {item.intervention_label}
                </span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: '#f1f5f9', color: THEME.textMuted }}>
                  {item.date_label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {item.client_name && <span className="text-[9px] truncate" style={{ color: THEME.textMuted }}>{item.client_name}</span>}
                <span className="text-[9px] font-bold ml-auto flex-shrink-0" style={{ color: palette.accent }}>{item.user_name}</span>
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
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg" style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ color }}>{icon}</div>
      <div className="text-xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[9px] font-medium text-center leading-tight" style={{ color: THEME.textMuted }}>{label}</div>
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
      msgs.push(`🚨 ${urgentItems.length} intervention(s) URGENTE(S)`);
      urgentItems.slice(0, 2).forEach(u => msgs.push(`⚡ URGENT : ${u.intervention_label}${u.client_name ? ` — ${u.client_name}` : ''}${u.user_name ? ` → ${u.user_name}` : ''}`));
    }
    msgs.push(`📋 ${stats.total} intervention(s) aujourd'hui — ${stats.techs} technicien(s)`);
    if (stats.weeklyHours > 0) msgs.push(`⏱️ ${stats.weeklyHours}h cette semaine`);
    const h = now.getHours();
    if (h < 10) msgs.push('☀️ Bonne journée à toute l\'équipe ENES !');
    else if (h >= 12 && h < 14) msgs.push('🍽️ Bon appétit !');
    else if (h >= 17) msgs.push('👏 Excellent travail aujourd\'hui !');
    msgs.push('⚡ ENES Électricité — Excellence & Fiabilité');
    return [...msgs, ...msgs];
  }, [techSummaries, stats, now]);

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none" style={{
      background: THEME.bg,
      color: THEME.textPrimary,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ═══ HEADER ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-2 gap-3" style={{ borderBottom: `1px solid ${THEME.headerBorder}`, background: THEME.headerBg }}>
        {/* Logo + Date */}
        <div className="flex items-center gap-3">
          <img src={logoEnes} alt="ENES" className="h-9 flex-shrink-0" />
          <div>
            <div className="text-lg font-black" style={{ color: THEME.textPrimary }}>ENES Électricité</div>
            <div className="text-[11px] capitalize" style={{ color: THEME.textMuted }}>{dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="flex items-center gap-2">
          <StatChip icon={<Wrench className="h-3.5 w-3.5" />} value={stats.total} label="Aujourd'hui" color={THEME.accent} />
          {stats.urgent > 0 && <StatChip icon={<Zap className="h-3.5 w-3.5" />} value={stats.urgent} label="Urgentes" color="#dc2626" />}
          <StatChip icon={<Users className="h-3.5 w-3.5" />} value={stats.techs} label="Techniciens" color="#059669" />
          {stats.weeklyHours > 0 && <StatChip icon={<Clock className="h-3.5 w-3.5" />} value={`${stats.weeklyHours}h`} label="Semaine" color="#d97706" />}
          <StatChip icon={<TrendingUp className="h-3.5 w-3.5" />} value={pendingInterventions.length} label="Restantes" color="#7c3aed" />
        </div>

        {/* Weather + Clock */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {weather && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: '#f8fafc', border: `1px solid ${THEME.cardBorder}` }}>
              <WeatherIcon desc={weather.description} />
              <div>
                <div className="text-lg font-black" style={{ color: THEME.textPrimary }}>{weather.temp}°C</div>
                <div className="text-[9px]" style={{ color: THEME.textMuted }}>{weather.description}</div>
              </div>
            </div>
          )}
          {/* Clock */}
          <div className="tabular-nums flex items-baseline gap-0.5">
            <span className="text-4xl font-black" style={{ color: THEME.clockColor }}>{hours}</span>
            <span className="text-4xl font-black" style={{ color: colonVisible ? THEME.clockColor : 'transparent', transition: 'color 0.1s' }}>:</span>
            <span className="text-4xl font-black" style={{ color: THEME.clockColor }}>{minutes}</span>
            <span className="text-base font-bold self-end mb-0.5 ml-0.5" style={{ color: THEME.accent, opacity: 0.5 }}>{seconds}</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex min-h-0 gap-0">

        {/* ── GAUCHE: Techniciens ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 p-3 gap-2" style={{ borderRight: `1px solid ${THEME.divider}` }}>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 flex-shrink-0" style={{ color: THEME.accent }} />
            <span className="text-xs font-bold" style={{ color: THEME.textSecondary }}>Interventions du jour</span>
            <div className="h-px flex-1" style={{ background: THEME.divider }} />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: THEME.textMuted }}>
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 border-2 rounded-full" style={{ borderColor: THEME.accent, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                <span className="text-xs">Chargement…</span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : techSummaries.length === 0 && unassignedToday.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: THEME.textMuted }}>
              <CheckCircle2 className="h-14 w-14" style={{ color: '#059669', opacity: 0.3 }} />
              <p className="text-base">Aucune intervention aujourd'hui</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-2 overflow-hidden">
              {techSummaries.map((tech) => (
                <TechColumn key={tech.name} tech={tech} />
              ))}
              {unassignedToday.length > 0 && (
                <div className="flex flex-col min-h-0 rounded-xl overflow-hidden flex-1" style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="px-3 py-2 flex items-center gap-2.5 flex-shrink-0" style={{ background: '#f8fafc', borderBottom: `1px solid ${THEME.divider}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                      <Circle className="h-4 w-4" style={{ color: THEME.textMuted }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold" style={{ color: THEME.textSecondary }}>Non assigné</div>
                      <div className="text-[10px]" style={{ color: THEME.textMuted }}>{unassignedToday.length} en attente</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
                    {unassignedToday.map((item, idx) => (
                      <InterventionCard
                        key={`unassigned-${item.intervention_ref}-${idx}`}
                        item={item}
                        palette={{ accent: '#64748b', light: '#64748b', bg: 'rgba(100,116,139,0.06)', border: '#e2e8f0' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DROITE: Widgets ── */}
        <div className="w-72 flex-shrink-0 flex flex-col p-3 gap-3 min-h-0" style={{ background: '#f1f5f9', borderLeft: `1px solid ${THEME.divider}` }}>
          <div className="flex-1 min-h-0 flex flex-col" style={{ flex: '1 1 50%' }}>
            <WeekStatsWidget stats={techWeekStats} />
          </div>
          <div className="flex-shrink-0 h-px" style={{ background: THEME.divider }} />
          <div className="flex-1 min-h-0 flex flex-col" style={{ flex: '1 1 50%' }}>
            <PendingWidget pending={pendingInterventions} />
          </div>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <Ticker messages={tickerMessages} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
