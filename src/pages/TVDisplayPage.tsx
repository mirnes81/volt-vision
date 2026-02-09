import * as React from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, MapPin, Calendar, AlertTriangle, User, Car, Navigation, TriangleAlert, Trophy, Zap, Clock, Users, TrendingUp, Wrench, ImageIcon, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { decodeHtmlEntities } from '@/lib/htmlUtils';
import logoEnes from '@/assets/logo-enes.png';

// ─── QR Code URL generator (using free qrserver API) ─────────────────
function getQrUrl(interventionRef: string, interventionLabel: string, interventionId?: number | null): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    ref: interventionRef,
    label: interventionLabel,
    ...(interventionId ? { id: String(interventionId) } : {}),
  });
  const targetUrl = `${baseUrl}/take-intervention?${params.toString()}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(targetUrl)}&bgcolor=0d1b3e&color=ffffff&format=svg`;
}

// ─── Constants ───────────────────────────────────────────────────────
const ENES_ORIGIN = { lat: 46.5107, lon: 6.5004, label: 'ENES – Cossonay' };
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ─── Types ───────────────────────────────────────────────────────────
interface WeatherData { temp: number; description: string; city: string; humidity: number; wind: number; }
interface DayAssignment { intervention_label: string; intervention_ref?: string; intervention_id?: number | null; client_name: string | null; location: string | null; priority: string; date_planned: string; user_name?: string; description?: string | null; }
interface TechWeekPlan { userName: string; days: Map<string, DayAssignment[]>; }
interface TravelInfo { location: string; client: string; durationMin: number; distanceKm: number; trafficFactor: number; estimatedWithTraffic: number; delayWarning: string | null; priority: string; }
interface LeaderboardEntry { name: string; interventions: number; hoursWorked: number; }
interface LiveCounters { todayTotal: number; todayUrgent: number; activeTechs: number; weeklyHours: number; }

// ─── Clock hook ──────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

// ─── Giant Digital Clock (LED / 7-segment style) ─────────────────────
function DigitalClock({ now }: { now: Date }) {
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const showColon = now.getSeconds() % 2 === 0;

  return (
    <div className="flex items-center gap-0.5">
      {/* Hours */}
      <div className="flex items-baseline">
        <span className="text-4xl font-black tabular-nums tracking-tight" style={{
          fontFamily: "'Inter', monospace",
          textShadow: '0 0 20px rgba(96,165,250,0.6), 0 0 40px rgba(96,165,250,0.3)',
          color: '#93c5fd',
        }}>
          {hours}
        </span>
        <span className="text-4xl font-black mx-0.5" style={{
          color: showColon ? '#93c5fd' : 'transparent',
          textShadow: showColon ? '0 0 20px rgba(96,165,250,0.6)' : 'none',
          transition: 'color 0.15s, text-shadow 0.15s',
        }}>:</span>
        <span className="text-4xl font-black tabular-nums tracking-tight" style={{
          fontFamily: "'Inter', monospace",
          textShadow: '0 0 20px rgba(96,165,250,0.6), 0 0 40px rgba(96,165,250,0.3)',
          color: '#93c5fd',
        }}>
          {minutes}
        </span>
        <span className="text-lg font-bold tabular-nums ml-1 self-end mb-1" style={{
          fontFamily: "'Inter', monospace",
          textShadow: '0 0 10px rgba(96,165,250,0.4)',
          color: '#60a5fa',
          opacity: 0.7,
        }}>
          {seconds}
        </span>
      </div>
    </div>
  );
}

// ─── Weather ─────────────────────────────────────────────────────────
function wmoCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
    45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine forte',
    61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte', 71: 'Neige légère', 73: 'Neige modérée', 75: 'Neige forte',
    80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses fortes', 95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent',
  };
  return map[code] || 'Inconnu';
}

function WeatherIcon({ desc, className }: { desc: string; className?: string }) {
  const d = desc.toLowerCase();
  if (d.includes('neige') || d.includes('snow')) return <CloudSnow className={className || "h-8 w-8 text-blue-200"} />;
  if (d.includes('pluie') || d.includes('rain') || d.includes('averse')) return <CloudRain className={className || "h-8 w-8 text-blue-300"} />;
  if (d.includes('nuag') || d.includes('cloud') || d.includes('couvert') || d.includes('brouillard')) return <Cloud className={className || "h-8 w-8 text-gray-300"} />;
  return <Sun className={className || "h-8 w-8 text-yellow-400"} />;
}

function useWeather() {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    async function fetchWeather(lat: number, lon: number) {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
        const data = await res.json();
        const current = data.current;
        let city = 'Cossonay';
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
          const geoData = await geo.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || city;
        } catch { /* ignore */ }
        if (!cancelled) {
          setWeather({ temp: Math.round(current.temperature_2m), description: wmoCodeToText(current.weather_code), city, humidity: current.relative_humidity_2m, wind: Math.round(current.wind_speed_10m) });
        }
      } catch (err) { console.error('Weather fetch failed:', err); }
    }
    fetchWeather(ENES_ORIGIN.lat, ENES_ORIGIN.lon);
    return () => { cancelled = true; };
  }, []);
  return weather;
}

// ─── Traffic ─────────────────────────────────────────────────────────
function getTrafficFactor(hour: number): { factor: number; label: string } {
  if (hour >= 7 && hour <= 9) return { factor: 1.4, label: 'Heure de pointe matin' };
  if (hour >= 16 && hour <= 18) return { factor: 1.45, label: 'Heure de pointe soir' };
  if (hour >= 11 && hour <= 13) return { factor: 1.15, label: 'Trafic modéré midi' };
  if (hour >= 9 && hour < 11) return { factor: 1.1, label: 'Trafic fluide' };
  if (hour >= 13 && hour < 16) return { factor: 1.1, label: 'Trafic fluide' };
  return { factor: 1.0, label: 'Trafic libre' };
}

function getWeatherTrafficPenalty(weatherDesc: string | null): number {
  if (!weatherDesc) return 0;
  const d = weatherDesc.toLowerCase();
  if (d.includes('neige') || d.includes('verglas')) return 0.3;
  if (d.includes('pluie forte') || d.includes('averse forte') || d.includes('orage')) return 0.2;
  if (d.includes('pluie') || d.includes('averse') || d.includes('bruine')) return 0.1;
  if (d.includes('brouillard')) return 0.15;
  return 0;
}

// ─── Travel hook ─────────────────────────────────────────────────────
function useTravelInfo(todayAssignments: DayAssignment[], weatherDesc: string | null) {
  const [travels, setTravels] = React.useState<TravelInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const fetchTravel = React.useCallback(async () => {
    if (todayAssignments.length === 0) { setTravels([]); setLoading(false); return; }
    const uniqueLocations = new Map<string, DayAssignment>();
    for (const a of todayAssignments) {
      const loc = a.location?.trim();
      if (loc && !uniqueLocations.has(loc)) uniqueLocations.set(loc, a);
    }
    const results: TravelInfo[] = [];
    const now = new Date();
    const traffic = getTrafficFactor(now.getHours());
    const weatherPenalty = getWeatherTrafficPenalty(weatherDesc);

    for (const [loc, assignment] of uniqueLocations) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc + ', Suisse')}&format=json&limit=1`);
        const geoData = await geoRes.json();
        if (!geoData || geoData.length === 0) continue;
        const destLat = parseFloat(geoData[0].lat);
        const destLon = parseFloat(geoData[0].lon);
        const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${ENES_ORIGIN.lon},${ENES_ORIGIN.lat};${destLon},${destLat}?overview=false`);
        const routeData = await routeRes.json();
        if (routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          const baseDuration = Math.round(route.duration / 60);
          const distanceKm = Math.round(route.distance / 1000 * 10) / 10;
          const totalFactor = traffic.factor + weatherPenalty;
          const withTraffic = Math.round(baseDuration * totalFactor);
          const delay = withTraffic - baseDuration;
          let delayWarning: string | null = null;
          if (delay >= 15) delayWarning = `⚠️ +${delay} min de retard estimé`;
          else if (delay >= 5) delayWarning = `+${delay} min`;
          results.push({ location: loc, client: assignment.client_name || 'Client', durationMin: baseDuration, distanceKm, trafficFactor: totalFactor, estimatedWithTraffic: withTraffic, delayWarning, priority: assignment.priority });
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (err) { console.error(`Travel calc failed for ${loc}:`, err); }
    }
    results.sort((a, b) => b.estimatedWithTraffic - a.estimatedWithTraffic);
    setTravels(results);
    setLastUpdate(new Date());
    setLoading(false);
  }, [todayAssignments, weatherDesc]);

  React.useEffect(() => {
    fetchTravel();
    const interval = setInterval(fetchTravel, 300_000);
    return () => clearInterval(interval);
  }, [fetchTravel]);

  return { travels, loading, lastUpdate };
}

// ─── Week assignments hook (ALL non-completed) ──────────────────────
function useWeekAssignments() {
  const [techPlans, setTechPlans] = React.useState<TechWeekPlan[]>([]);
  const [allTodayAssignments, setAllTodayAssignments] = React.useState<DayAssignment[]>([]);
  const [overdueCount, setOverdueCount] = React.useState(0);
  const [unplannedCount, setUnplannedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [weekDays, setWeekDays] = React.useState<Date[]>([]);

  const fetchAssignments = React.useCallback(async () => {
    try {
      const today = new Date();
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(today.getDate() + i); days.push(d); }
      setWeekDays(days);

      const todayStr = today.toISOString().split('T')[0];

      // Fetch assignments AND Dolibarr interventions in PARALLEL
      const [assignResult, dolibarrResult] = await Promise.all([
        supabase
          .from('intervention_assignments')
          .select('user_name, intervention_label, intervention_ref, intervention_id, client_name, location, priority, date_planned, description')
          .eq('tenant_id', TENANT_ID)
          .order('user_name')
          .order('date_planned', { ascending: true }),
        supabase.functions.invoke('dolibarr-api', {
          body: { action: 'get-interventions', params: {} },
        }).catch(() => ({ data: null, error: 'fetch failed' })),
      ]);

      if (assignResult.error) { console.error('TV planning error:', assignResult.error); setLoading(false); return; }

      // Build a map of intervention_id -> description from Dolibarr
      const descriptionMap = new Map<number, string>();
      if (dolibarrResult?.data && Array.isArray(dolibarrResult.data)) {
        for (const int of dolibarrResult.data) {
          const id = Number(int.id);
          const desc = int.description || int.note_public || int.note_private || '';
          if (id && desc) {
            // Strip HTML tags
            const cleanDesc = desc.replace(/<[^>]*>/g, '').trim();
            if (cleanDesc) descriptionMap.set(id, cleanDesc);
          }
        }
      }
      console.log(`[TV] Dolibarr descriptions loaded: ${descriptionMap.size} interventions`);

      const todayItems: DayAssignment[] = [];
      const techMap = new Map<string, TechWeekPlan>();
      let overdue = 0;
      let unplanned = 0;

      for (const row of (assignResult.data || [])) {
        const name = row.user_name || 'Non assigné';
        if (!techMap.has(name)) techMap.set(name, { userName: name, days: new Map() });
        const plan = techMap.get(name)!;

        let dateKey: string;
        if (!row.date_planned) {
          dateKey = '__unplanned__';
          unplanned++;
        } else {
          dateKey = new Date(row.date_planned).toISOString().split('T')[0];
          if (dateKey < todayStr) {
            overdue++;
            dateKey = '__overdue__';
          }
        }

        // Use Dolibarr description if assignment doesn't have one
        const dolibarrDesc = row.intervention_id ? descriptionMap.get(row.intervention_id) : undefined;
        const finalDescription = (row as any).description || dolibarrDesc || null;

        if (!plan.days.has(dateKey)) plan.days.set(dateKey, []);
        const assignment: DayAssignment = { intervention_label: row.intervention_label || 'Intervention', intervention_ref: row.intervention_ref || '', intervention_id: row.intervention_id, client_name: row.client_name, location: row.location, priority: row.priority || 'normal', date_planned: row.date_planned || '', user_name: name, description: finalDescription };
        plan.days.get(dateKey)!.push(assignment);
        if (dateKey === todayStr) todayItems.push(assignment);
      }

      setTechPlans(Array.from(techMap.values()));
      setAllTodayAssignments(todayItems);
      setOverdueCount(overdue);
      setUnplannedCount(unplanned);
    } catch (err) { console.error('TV week planning error:', err); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 120_000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  return { techPlans, weekDays, allTodayAssignments, overdueCount, unplannedCount, loading };
}

// ─── Live counters hook ──────────────────────────────────────────────
function useLiveCounters() {
  const [counters, setCounters] = React.useState<LiveCounters>({ todayTotal: 0, todayUrgent: 0, activeTechs: 0, weeklyHours: 0 });

  const fetchCounters = React.useCallback(async () => {
    try {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const endOf7Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();

      // Fetch today's assignments AND all 7-day assignments in parallel
      const [todayResult, weekAssignResult] = await Promise.all([
        supabase
          .from('intervention_assignments')
          .select('priority, user_name')
          .eq('tenant_id', TENANT_ID)
          .gte('date_planned', startOfToday)
          .lt('date_planned', endOfToday),
        supabase
          .from('intervention_assignments')
          .select('priority, user_name, date_planned')
          .eq('tenant_id', TENANT_ID)
          .lt('date_planned', endOf7Days),
      ]);

      const todayData = todayResult.data;
      const weekAssignData = weekAssignResult.data;

      const todayTotal = todayData?.length || 0;
      // Count ALL urgent/critical across 7 days (includes overdue)
      const todayUrgent = weekAssignData?.filter(d => d.priority === 'urgent' || d.priority === 'critical').length || 0;
      const activeTechs = new Set(weekAssignData?.map(d => d.user_name)).size;

      // Weekly hours from summary view
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const mondayStr = monday.toISOString().split('T')[0];

      const { data: weekData } = await supabase
        .from('weekly_work_summary')
        .select('total_minutes')
        .eq('tenant_id', TENANT_ID)
        .eq('week_start', mondayStr);

      const weeklyHours = Math.round((weekData || []).reduce((sum, w) => sum + (w.total_minutes || 0), 0) / 60);

      setCounters({ todayTotal, todayUrgent, activeTechs, weeklyHours });
    } catch (err) { console.error('Counters error:', err); }
  }, []);

  React.useEffect(() => {
    fetchCounters();
    const interval = setInterval(fetchCounters, 60_000); // every 1 min
    return () => clearInterval(interval);
  }, [fetchCounters]);

  return counters;
}

// ─── Leaderboard hook ────────────────────────────────────────────────
function useLeaderboard() {
  const [leaders, setLeaders] = React.useState<LeaderboardEntry[]>([]);

  const fetchLeaderboard = React.useCallback(async () => {
    try {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).toISOString().split('T')[0];

      // Get weekly hours per user
      const { data: hoursData } = await supabase
        .from('weekly_work_summary')
        .select('user_id, total_minutes')
        .eq('tenant_id', TENANT_ID)
        .eq('week_start', mondayStr);

      // Get weekly interventions per user
      const { data: assignData } = await supabase
        .from('intervention_assignments')
        .select('user_name, user_id')
        .eq('tenant_id', TENANT_ID)
        .gte('date_planned', mondayStr)
        .lt('date_planned', sundayStr);

      // Get user names from assignments
      const userMap = new Map<string, { name: string; interventions: number; hours: number }>();

      for (const a of (assignData || [])) {
        const key = a.user_id || a.user_name;
        if (!userMap.has(key)) userMap.set(key, { name: a.user_name, interventions: 0, hours: 0 });
        userMap.get(key)!.interventions++;
      }

      for (const h of (hoursData || [])) {
        const key = h.user_id;
        if (userMap.has(key)) {
          userMap.get(key)!.hours = Math.round((h.total_minutes || 0) / 60 * 10) / 10;
        }
      }

      const entries: LeaderboardEntry[] = Array.from(userMap.values())
        .map(v => ({ name: v.name, interventions: v.interventions, hoursWorked: v.hours }))
        .sort((a, b) => b.interventions - a.interventions)
        .slice(0, 5);

      setLeaders(entries);
    } catch (err) { console.error('Leaderboard error:', err); }
  }, []);

  React.useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 300_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return leaders;
}

// ─── Fullscreen ──────────────────────────────────────────────────────
function useFullscreen() {
  const enterFullscreen = React.useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);
  return { enterFullscreen };
}

// ─── Tech colors ─────────────────────────────────────────────────────
const TECH_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-400' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-300', dot: 'bg-purple-400' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400' },
  { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-300', dot: 'bg-rose-400' },
  { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-300', dot: 'bg-indigo-400' },
  { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-300', dot: 'bg-teal-400' },
];

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

function formatDayHeader(date: Date): { dayName: string; dayNum: string } {
  const dayName = date.toLocaleDateString('fr-CH', { weekday: 'short' }).replace('.', '');
  const dayNum = date.getDate().toString();
  return { dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1), dayNum };
}

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedCounter({ value, label, icon, color }: { value: number; label: string; icon: React.ReactNode; color: string }) {
  const [displayed, setDisplayed] = React.useState(0);

  React.useEffect(() => {
    if (value === displayed) return;
    const step = value > displayed ? 1 : -1;
    const timer = setInterval(() => {
      setDisplayed(prev => {
        const next = prev + step;
        if ((step > 0 && next >= value) || (step < 0 && next <= value)) {
          clearInterval(timer);
          return value;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [value, displayed]);

  return (
    <div className={`rounded-xl border p-3 ${color} flex flex-col items-center gap-1 min-w-0`}>
      {icon}
      <div className="text-2xl font-black tabular-nums">{displayed}</div>
      <div className="text-[10px] text-white/50 text-center leading-tight">{label}</div>
    </div>
  );
}

// ─── Ticker messages builder ─────────────────────────────────────────
function useTickerMessages(todayAssignments: DayAssignment[], counters: LiveCounters) {
  return React.useMemo(() => {
    const msgs: string[] = [];

    // Urgent interventions
    const urgents = todayAssignments.filter(a => a.priority === 'urgent' || a.priority === 'critical');
    if (urgents.length > 0) {
      msgs.push(`🚨 ${urgents.length} intervention(s) URGENTE(S) aujourd'hui !`);
      for (const u of urgents.slice(0, 3)) {
        msgs.push(`⚡ URGENT : ${u.intervention_label} — ${u.client_name || 'Client'} ${u.location ? `(${u.location})` : ''}`);
      }
    }

    // Daily recap
    msgs.push(`📋 ${counters.todayTotal} intervention(s) planifiée(s) aujourd'hui — ${counters.activeTechs} technicien(s) mobilisé(s)`);
    if (counters.weeklyHours > 0) {
      msgs.push(`⏱️ ${counters.weeklyHours}h travaillées cette semaine par l'équipe`);
    }

    // Motivational
    const now = new Date();
    const hour = now.getHours();
    if (hour < 10) msgs.push('☀️ Bonne journée à toute l\'équipe ENES !');
    else if (hour >= 12 && hour < 14) msgs.push('🍽️ Bon appétit à tous !');
    else if (hour >= 17) msgs.push('👏 Bravo pour le travail accompli aujourd\'hui !');

    msgs.push('🔧 ENES Électricité — Qualité & Fiabilité depuis le premier jour');

    // Repeat to make it scroll smoothly
    return [...msgs, ...msgs];
  }, [todayAssignments, counters]);
}

// ─── Scrolling Ticker Component ──────────────────────────────────────
function ScrollingTicker({ messages }: { messages: string[] }) {
  const text = messages.join('     •     ');

  return (
    <div className="relative overflow-hidden h-7 bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-blue-900/60 border-t border-white/10">
      <div
        className="absolute whitespace-nowrap h-full flex items-center text-xs font-medium text-blue-200/80"
        style={{
          animation: `ticker-scroll ${Math.max(messages.length * 5, 30)}s linear infinite`,
        }}
      >
        {text}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

// ─── Photo Carousel (recent interventions) ───────────────────────────
function PhotoCarousel({ assignments }: { assignments: DayAssignment[] }) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const items = React.useMemo(() => {
    // Use recent assignments as "cards" (no actual photos in DB yet)
    return assignments.slice(0, 8).map((a, i) => ({
      label: a.intervention_label,
      client: a.client_name || 'Client',
      location: a.location || '',
      priority: a.priority,
      color: TECH_COLORS[i % TECH_COLORS.length],
    }));
  }, [assignments]);

  React.useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col items-center justify-center h-full text-white/30 gap-2">
        <ImageIcon className="h-8 w-8 opacity-30" />
        <span className="text-xs">Pas de chantiers récents</span>
      </div>
    );
  }

  const item = items[currentIdx];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden h-full flex flex-col">
      <div className="px-3 py-1.5 bg-white/5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-bold text-white/70">Chantiers du jour</span>
        </div>
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIdx ? 'bg-blue-400 scale-125' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col justify-center transition-all duration-500" key={currentIdx}>
        <div className={`rounded-lg p-4 border ${item.priority !== 'normal' ? 'bg-red-500/10 border-red-500/25' : `${item.color.bg} ${item.color.border}`}`}>
          {item.priority !== 'normal' && (
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[10px] font-bold text-red-400 uppercase">Urgent</span>
            </div>
          )}
          <div className={`text-lg font-bold mb-1 ${item.priority !== 'normal' ? 'text-red-200' : 'text-white/90'}`}>
            {item.label}
          </div>
          <div className="text-sm text-white/60 mb-1">{item.client}</div>
          {item.location && (
            <div className="text-xs text-white/30 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {item.location}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Road Conditions Widget (Cossonay area) ─────────────────────────
function RoadConditionsWidget({ weather }: { weather: WeatherData | null }) {
  const now = new Date();
  const traffic = getTrafficFactor(now.getHours());
  const weatherPenalty = getWeatherTrafficPenalty(weather?.description ?? null);
  const totalFactor = traffic.factor + weatherPenalty;

  const severity = totalFactor >= 1.4 ? 'high' : totalFactor > 1.1 ? 'medium' : 'low';
  const colors = {
    high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400', icon: 'text-red-400' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400', icon: 'text-amber-400' },
    low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400', icon: 'text-emerald-400' },
  };
  const c = colors[severity];

  // Routes spécifiques dans un rayon de 5km autour de Cossonay (Rte de Morges 9A)
  const conditions: { road: string; distance: string; info: string }[] = [];
  
  if (weather) {
    const d = weather.description.toLowerCase();
    if (d.includes('neige') || d.includes('verglas')) {
      conditions.push({ road: 'Rte de Morges (RC 177)', distance: '0.1 km', info: '⚠️ Verglas/neige – prudence' });
      conditions.push({ road: 'Rte de la Gare, Cossonay', distance: '0.5 km', info: '⚠️ Chaussée glissante' });
      conditions.push({ road: 'Rte de Lausanne (RC 177)', distance: '1.5 km', info: '⚠️ Risque de verglas' });
      conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '⚠️ Bretelle glissante' });
      conditions.push({ road: 'A1 Lausanne↔Yverdon', distance: '3.5 km', info: '⚠️ Neige – vitesse réduite' });
    } else if (d.includes('pluie forte') || d.includes('orage')) {
      conditions.push({ road: 'Rte de Morges (RC 177)', distance: '0.1 km', info: '🌧️ Forte pluie – visibilité réduite' });
      conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '🌧️ Aquaplaning possible' });
      conditions.push({ road: 'A1 Lausanne↔Yverdon', distance: '3.5 km', info: '🌧️ Prudence – pluie forte' });
    } else if (d.includes('pluie') || d.includes('averse') || d.includes('bruine')) {
      conditions.push({ road: 'Rte de Morges (RC 177)', distance: '0.1 km', info: '🌧️ Chaussée humide' });
      conditions.push({ road: 'A1 Lausanne↔Yverdon', distance: '3.5 km', info: '🌧️ Routes mouillées' });
    } else if (d.includes('brouillard')) {
      conditions.push({ road: 'Rte de Morges (RC 177)', distance: '0.1 km', info: '🌫️ Brouillard – phares obligatoires' });
      conditions.push({ road: 'Rte de Penthalaz', distance: '2 km', info: '🌫️ Visibilité < 200m' });
      conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '🌫️ Brouillard dense possible' });
    }
  }

  const hour = now.getHours();
  if (hour >= 7 && hour <= 9) {
    conditions.push({ road: 'Rte de la Gare → centre', distance: '0.5 km', info: '🚗 Pointe matin – trafic dense (+40%)' });
    conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '🚗 File possible à la bretelle' });
    conditions.push({ road: 'A1 dir. Lausanne', distance: '3.5 km', info: '🚗 Bouchons fréquents' });
    conditions.push({ road: 'RC 177 → Morges', distance: '1 km', info: '🚗 Trafic soutenu' });
  } else if (hour >= 16 && hour <= 18) {
    conditions.push({ road: 'Rte de la Gare → centre', distance: '0.5 km', info: '🚗 Pointe soir – trafic dense (+45%)' });
    conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '🚗 Ralentissement bretelle' });
    conditions.push({ road: 'A1 dir. Yverdon', distance: '3.5 km', info: '🚗 Bouchons fréquents' });
    conditions.push({ road: 'RC 177 → Penthalaz', distance: '2 km', info: '🚗 Trafic soutenu' });
  } else if (hour >= 11 && hour <= 13) {
    conditions.push({ road: 'Centre Cossonay', distance: '0.3 km', info: '🚙 Trafic modéré – pause midi' });
    conditions.push({ road: 'RC 177 → Morges', distance: '1 km', info: '🚙 Fluide à modéré' });
  }

  if (conditions.length === 0) {
    conditions.push({ road: 'Rte de Morges (RC 177)', distance: '0.1 km', info: '✅ Fluide' });
    conditions.push({ road: 'Rte de la Gare', distance: '0.5 km', info: '✅ Fluide' });
    conditions.push({ road: 'RC 177 → Penthalaz', distance: '2 km', info: '✅ Fluide' });
    conditions.push({ road: 'Sortie A1 Cossonay (#18)', distance: '3.2 km', info: '✅ Fluide' });
    conditions.push({ road: 'A1 Lausanne↔Yverdon', distance: '3.5 km', info: '✅ Conditions normales' });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`rounded-lg border p-2 ${c.bg} ${c.border}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Car className={`h-3.5 w-3.5 ${c.icon}`} />
          <span className={`text-xs font-bold ${c.text}`}>{traffic.label}</span>
        </div>
        {weatherPenalty > 0 && (
          <div className="text-[9px] text-amber-400 mt-0.5">
            +{Math.round(weatherPenalty * 100)}% météo ({weather?.description})
          </div>
        )}
      </div>

      <div className="space-y-1 max-h-[220px] overflow-auto">
        {conditions.map((item, idx) => (
          <div key={idx} className="rounded-md border bg-white/5 border-white/10 p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-white/70 truncate">{item.road}</span>
              <span className="text-[9px] text-white/30 whitespace-nowrap">{item.distance}</span>
            </div>
            <div className="text-[9px] text-white/50 mt-0.5">{item.info}</div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-white/15 flex items-center gap-1">
        <Navigation className="h-2 w-2" /> Rayon 5km • {ENES_ORIGIN.label}
      </div>
    </div>
  );
}

// ─── Leaderboard Widget ──────────────────────────────────────────────
function LeaderboardWidget({ leaders }: { leaders: LeaderboardEntry[] }) {
  if (leaders.length === 0) {
    return (
      <div className="text-white/20 text-[10px] text-center py-3">Pas de données cette semaine</div>
    );
  }

  return (
    <div className="space-y-1">
      {leaders.map((l, i) => (
        <div key={l.name} className={`rounded-md border p-2 flex items-center gap-2 ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-white/5 border-white/10'}`}>
          <span className={`text-sm font-black w-5 text-center ${MEDAL_COLORS[i] || 'text-white/30'}`}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white/80 truncate">{l.name}</div>
            <div className="text-[9px] text-white/40">
              {l.interventions} interv. • {l.hoursWorked}h
            </div>
          </div>
          {i === 0 && <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const { enterFullscreen } = useFullscreen();
  const now = useClock();
  const weather = useWeather();
  const { techPlans, weekDays, allTodayAssignments, overdueCount, unplannedCount, loading } = useWeekAssignments();
  // Travel info removed - replaced by RoadConditionsWidget
  const counters = useLiveCounters();
  const leaders = useLeaderboard();
  const tickerMessages = useTickerMessages(allTodayAssignments, counters);

  React.useEffect(() => { enterFullscreen(); }, [enterFullscreen]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="h-screen bg-gradient-to-br from-[hsl(217,91%,8%)] via-[hsl(217,91%,14%)] to-[hsl(220,80%,18%)] text-white flex flex-col overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={logoEnes} alt="ENES" className="h-9" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">ENES Électricité</h1>
            <p className="text-blue-300 text-[10px] capitalize">
              {now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Live counters in header */}
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-4 gap-2">
            <AnimatedCounter value={counters.todayTotal} label="Aujourd'hui" icon={<Wrench className="h-4 w-4 text-blue-400" />} color="bg-blue-500/10 border-blue-500/25" />
            <AnimatedCounter value={counters.todayUrgent} label="Urgentes" icon={<Zap className="h-4 w-4 text-red-400" />} color="bg-red-500/10 border-red-500/25" />
            <AnimatedCounter value={counters.activeTechs} label="Techniciens" icon={<Users className="h-4 w-4 text-emerald-400" />} color="bg-emerald-500/10 border-emerald-500/25" />
            <AnimatedCounter value={counters.weeklyHours} label="Heures/sem" icon={<Clock className="h-4 w-4 text-amber-400" />} color="bg-amber-500/10 border-amber-500/25" />
          </div>

          {weather && (
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
              <WeatherIcon desc={weather.description} className="h-5 w-5" />
              <span className="text-xl font-bold">{weather.temp}°C</span>
              <div className="text-[10px] text-white/40 leading-tight">
                <div>{weather.description}</div>
                <div><Wind className="h-2.5 w-2.5 inline" /> {weather.wind}km/h</div>
              </div>
            </div>
          )}

          <div className="flex-shrink-0">
            <DigitalClock now={now} />
          </div>
        </div>
      </div>

      {/* ─── Main Content: 3 columns ─── */}
      <div className="flex-1 flex min-h-0 p-3 gap-3">

        {/* ═══ LEFT: 7-day planning ═══ */}
        <div className="w-[300px] flex-shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold">Planning 7 jours</h2>
          </div>

          <div className="flex-1 overflow-auto min-h-0 space-y-1.5 pr-1">
            {weekDays.map((day, dayIdx) => {
              const dayStr = day.toISOString().split('T')[0];
              const isToday = dayStr === todayStr;
              const dayName = day.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });

              // Collect all assignments for this day across all techs
              const dayAssignments: (DayAssignment & { techName: string })[] = [];
              for (const tech of techPlans) {
                const items = tech.days.get(dayStr);
                if (items) {
                  for (const a of items) {
                    dayAssignments.push({ ...a, techName: tech.userName });
                  }
                }
              }

              return (
                <div key={dayStr} className={`rounded-lg border p-2 ${
                  isToday ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/[0.03] border-white/10'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold capitalize ${isToday ? 'text-blue-200' : 'text-white/60'}`}>
                      {isToday ? '📍 ' : ''}{dayName}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      dayAssignments.length > 0
                        ? isToday ? 'bg-blue-500/30 text-blue-200' : 'bg-white/10 text-white/50'
                        : 'text-white/20'
                    }`}>
                      {dayAssignments.length}
                    </span>
                  </div>

                  {dayAssignments.length === 0 ? (
                    <div className="text-[9px] text-white/20 py-1">Aucune intervention</div>
                  ) : (
                    <div className="space-y-1">
                      {dayAssignments.slice(0, isToday ? 6 : 4).map((a, idx) => {
                        const isUrgent = a.priority === 'urgent' || a.priority === 'critical';
                        const techIdx = techPlans.findIndex(t => t.userName === a.techName);
                        const color = TECH_COLORS[(techIdx >= 0 ? techIdx : idx) % TECH_COLORS.length];
                        return (
                          <div key={`${a.intervention_ref}-${idx}`} className={`rounded-md px-2 py-1 border ${
                            isUrgent ? 'bg-red-500/15 border-red-500/30' : 'bg-white/[0.03] border-white/5'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {isUrgent && <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />}
                              <span className="text-[10px] font-bold text-white/80 truncate">{a.intervention_label}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
                              <span className={`text-[9px] ${color.text} truncate`}>{a.techName}</span>
                              {a.client_name && <span className="text-[9px] text-white/30 truncate ml-auto">{a.client_name}</span>}
                            </div>
                          </div>
                        );
                      })}
                      {dayAssignments.length > (isToday ? 6 : 4) && (
                        <div className="text-[9px] text-white/25 text-center">+{dayAssignments.length - (isToday ? 6 : 4)} autres</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Overdue section */}
            {overdueCount > 0 && (() => {
              const overdueItems: (DayAssignment & { techName: string })[] = [];
              for (const tech of techPlans) {
                const items = tech.days.get('__overdue__');
                if (items) {
                  for (const a of items) overdueItems.push({ ...a, techName: tech.userName });
                }
              }
              return (
                <div className="rounded-lg border p-2 bg-red-500/15 border-red-500/30">
                  <div className="text-xs font-bold text-red-300 mb-1">⚠️ En retard ({overdueItems.length})</div>
                  <div className="space-y-1">
                    {overdueItems.slice(0, 4).map((a, idx) => (
                      <div key={`ov-${idx}`} className="rounded-md px-2 py-1 bg-red-500/10 border border-red-500/20">
                        <span className="text-[10px] font-bold text-red-200 truncate block">{a.intervention_label}</span>
                        <span className="text-[9px] text-red-300/50">{a.techName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Unplanned section */}
            {unplannedCount > 0 && (() => {
              const unplannedItems: (DayAssignment & { techName: string })[] = [];
              for (const tech of techPlans) {
                const items = tech.days.get('__unplanned__');
                if (items) {
                  for (const a of items) unplannedItems.push({ ...a, techName: tech.userName });
                }
              }
              return (
                <div className="rounded-lg border p-2 bg-amber-500/15 border-amber-500/30">
                  <div className="text-xs font-bold text-amber-300 mb-1">📋 Non planifié ({unplannedItems.length})</div>
                  <div className="space-y-1">
                    {unplannedItems.slice(0, 3).map((a, idx) => (
                      <div key={`up-${idx}`} className="rounded-md px-2 py-1 bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] font-bold text-amber-200 truncate block">{a.intervention_label}</span>
                        <span className="text-[9px] text-amber-300/50">{a.techName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ═══ CENTER: Today's interventions (detailed) ═══ */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-shrink-0">
            <Zap className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold">Interventions du jour</h2>
            <span className="text-sm text-white/40 ml-auto">{allTodayAssignments.length} intervention{allTodayAssignments.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Chargement…</div>
          ) : allTodayAssignments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-2">
              <Calendar className="h-12 w-12 opacity-30" />
              <p className="text-sm">Aucune intervention aujourd'hui</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0 space-y-2 pr-1">
              {allTodayAssignments.map((a, idx) => {
                const techIdx = techPlans.findIndex(t => t.userName === a.user_name);
                const color = TECH_COLORS[(techIdx >= 0 ? techIdx : idx) % TECH_COLORS.length];
                const isUrgent = a.priority === 'urgent' || a.priority === 'critical';

                return (
                  <div key={`${a.intervention_ref}-${a.user_name}-${idx}`}
                    className={`rounded-xl border px-4 py-3 flex items-start gap-4 ${
                      isUrgent ? 'bg-red-500/15 border-red-500/30' : 'bg-white/[0.04] border-white/10'
                    }`}
                  >
                    {/* Priority icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isUrgent ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : (
                        <Wrench className="h-5 w-5 text-white/30" />
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {a.intervention_ref && (
                          <span className="inline-flex items-center bg-yellow-500/20 border border-yellow-400/40 text-yellow-200 text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            #{a.intervention_ref}
                          </span>
                        )}
                        <span className={`font-bold text-base ${isUrgent ? 'text-red-200' : 'text-white/90'}`}>
                          {a.intervention_label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        {a.client_name && (
                          <span className="text-sm text-white/60 flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-white/30" /> {a.client_name}
                          </span>
                        )}
                        {a.location && (
                          <span className="text-sm text-white/50 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-white/30" /> {a.location}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <div className="mt-2 bg-blue-500/15 border border-blue-400/30 rounded-lg px-3 py-2">
                          <div className="text-[11px] text-blue-300/60 font-semibold uppercase tracking-wider mb-0.5">📋 Description</div>
                          <div className="text-sm text-blue-100/90 leading-relaxed line-clamp-3">
                            {decodeHtmlEntities(a.description)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Technician badge */}
                    <div className={`flex-shrink-0 rounded-lg px-3 py-1.5 border ${color.bg} ${color.border} flex items-center gap-2`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                      <span className={`text-sm font-bold ${color.text} whitespace-nowrap`}>{a.user_name}</span>
                    </div>

                    {/* Priority badge */}
                    {isUrgent && (
                      <span className="flex-shrink-0 text-xs font-bold uppercase bg-red-500/25 text-red-300 px-2.5 py-1 rounded-full border border-red-500/40">
                        {a.priority === 'critical' ? 'Critique' : 'Urgent'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar: Travel + Leaderboard + Carousel */}
        <div className="w-[280px] flex-shrink-0 flex flex-col min-h-0 gap-3">
          {/* Travel */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Car className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-bold">Conditions routières</span>
            </div>
            <RoadConditionsWidget weather={weather} />
          </div>

          {/* Leaderboard */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold">Classement semaine</span>
            </div>
            <LeaderboardWidget leaders={leaders} />
          </div>

          {/* Photo carousel */}
          <div className="flex-1 min-h-0">
            <PhotoCarousel assignments={allTodayAssignments} />
          </div>
        </div>
      </div>

      {/* ─── Scrolling Ticker ─── */}
      <ScrollingTicker messages={tickerMessages} />
    </div>
  );
}
