import * as React from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, MapPin, Calendar, AlertTriangle, ChevronRight, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import logoEnes from '@/assets/logo-enes.png';

// ─── Types ───────────────────────────────────────────────────────────
interface WeatherData {
  temp: number;
  description: string;
  city: string;
  humidity: number;
  wind: number;
}

interface DayAssignment {
  intervention_label: string;
  client_name: string | null;
  location: string | null;
  priority: string;
  date_planned: string;
}

interface TechWeekPlan {
  userName: string;
  days: Map<string, DayAssignment[]>; // key = YYYY-MM-DD
}

// ─── Clock hook ──────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

// ─── Weather helpers ─────────────────────────────────────────────────
function wmoCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
    45: 'Brouillard', 48: 'Brouillard givrant',
    51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine forte',
    61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte',
    71: 'Neige légère', 73: 'Neige modérée', 75: 'Neige forte',
    80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses fortes',
    95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent',
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

// ─── Weather hook ────────────────────────────────────────────────────
function useWeather() {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchWeather(lat: number, lon: number) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
        );
        const data = await res.json();
        const current = data.current;

        let city = 'Position actuelle';
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
          const geoData = await geo.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || city;
        } catch { /* ignore */ }

        if (!cancelled) {
          setWeather({
            temp: Math.round(current.temperature_2m),
            description: wmoCodeToText(current.weather_code),
            city,
            humidity: current.relative_humidity_2m,
            wind: Math.round(current.wind_speed_10m),
          });
        }
      } catch (err) {
        console.error('Weather fetch failed:', err);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(46.2044, 6.1432)
      );
    } else {
      fetchWeather(46.2044, 6.1432);
    }

    return () => { cancelled = true; };
  }, []);

  return weather;
}

// ─── 7-day assignments hook ──────────────────────────────────────────
function useWeekAssignments() {
  const [techPlans, setTechPlans] = React.useState<TechWeekPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [weekDays, setWeekDays] = React.useState<Date[]>([]);

  const fetchAssignments = React.useCallback(async () => {
    try {
      // Calculate 7 days starting from today
      const today = new Date();
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
      }
      setWeekDays(days);

      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOf7Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();

      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('user_name, intervention_label, client_name, location, priority, date_planned')
        .eq('tenant_id', '00000000-0000-0000-0000-000000000001')
        .gte('date_planned', startOfToday)
        .lt('date_planned', endOf7Days)
        .order('user_name')
        .order('date_planned', { ascending: true });

      if (error) {
        console.error('TV 7-day planning error:', error);
        setLoading(false);
        return;
      }

      // Group by technician, then by day
      const techMap = new Map<string, TechWeekPlan>();
      
      for (const row of (data || [])) {
        const name = row.user_name || 'Non assigné';
        if (!techMap.has(name)) {
          techMap.set(name, { userName: name, days: new Map() });
        }
        const plan = techMap.get(name)!;
        
        const dateKey = row.date_planned 
          ? new Date(row.date_planned).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        if (!plan.days.has(dateKey)) {
          plan.days.set(dateKey, []);
        }
        plan.days.get(dateKey)!.push({
          intervention_label: row.intervention_label || 'Intervention',
          client_name: row.client_name,
          location: row.location,
          priority: row.priority || 'normal',
          date_planned: row.date_planned || '',
        });
      }

      setTechPlans(Array.from(techMap.values()));
    } catch (err) {
      console.error('TV week planning error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 120_000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  return { techPlans, weekDays, loading };
}

// ─── Fullscreen hook ─────────────────────────────────────────────────
function useFullscreen() {
  const enterFullscreen = React.useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
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

// ─── Day name helper ─────────────────────────────────────────────────
function formatDayHeader(date: Date, isToday: boolean): { dayName: string; dayNum: string } {
  const dayName = date.toLocaleDateString('fr-CH', { weekday: 'short' }).replace('.', '');
  const dayNum = date.getDate().toString();
  return { dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1), dayNum };
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const { enterFullscreen } = useFullscreen();
  const now = useClock();
  const weather = useWeather();
  const { techPlans, weekDays, loading } = useWeekAssignments();

  React.useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="h-screen bg-gradient-to-br from-[hsl(217,91%,8%)] via-[hsl(217,91%,14%)] to-[hsl(220,80%,18%)] text-white flex flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src={logoEnes} alt="ENES" className="h-10" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">ENES Électricité</h1>
            <p className="text-blue-300 text-xs capitalize">
              {now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Weather compact */}
        <div className="flex items-center gap-6">
          {weather && (
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10">
              <WeatherIcon desc={weather.description} className="h-6 w-6" />
              <span className="text-2xl font-bold">{weather.temp}°C</span>
              <div className="text-xs text-white/50 leading-tight">
                <div>{weather.description}</div>
                <div className="flex items-center gap-2">
                  <span><Wind className="h-3 w-3 inline" /> {weather.wind}km/h</span>
                  <span>{weather.humidity}%</span>
                </div>
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">
              {now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Planning Grid ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 p-3">
        {/* Section title */}
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <Calendar className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-bold">Planning sur 7 jours</h2>
          <span className="text-xs text-white/30 ml-auto">Rafraîchi toutes les 2 min</span>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-white/30">Chargement du planning…</div>
        ) : techPlans.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
            <Calendar className="h-16 w-16 opacity-30" />
            <p className="text-lg">Aucune intervention planifiée cette semaine</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            {/* Table header: days */}
            <div className="grid gap-1 sticky top-0 z-10 bg-gradient-to-br from-[hsl(217,91%,8%)] via-[hsl(217,91%,14%)] to-[hsl(220,80%,18%)]"
              style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}
            >
              <div className="p-2 text-xs font-bold text-white/40 uppercase flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Technicien
              </div>
              {weekDays.map((day) => {
                const isToday = day.toISOString().split('T')[0] === todayStr;
                const { dayName, dayNum } = formatDayHeader(day, isToday);
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-2 text-center rounded-lg ${isToday ? 'bg-blue-500/20 border border-blue-500/40' : ''}`}
                  >
                    <div className={`text-xs font-bold uppercase ${isToday ? 'text-blue-300' : 'text-white/50'}`}>
                      {dayName}
                    </div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-200' : 'text-white/70'}`}>
                      {dayNum}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tech rows */}
            <div className="space-y-1 mt-1">
              {techPlans.map((tech, techIdx) => {
                const color = TECH_COLORS[techIdx % TECH_COLORS.length];
                return (
                  <div
                    key={tech.userName}
                    className="grid gap-1"
                    style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}
                  >
                    {/* Tech name */}
                    <div className={`${color.bg} ${color.border} border rounded-lg p-2 flex items-center gap-2`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0`} />
                      <span className={`text-sm font-bold ${color.text} truncate`}>
                        {tech.userName}
                      </span>
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day) => {
                      const dateKey = day.toISOString().split('T')[0];
                      const isToday = dateKey === todayStr;
                      const assignments = tech.days.get(dateKey) || [];

                      return (
                        <div
                          key={dateKey}
                          className={`rounded-lg border p-1.5 min-h-[60px] ${
                            isToday
                              ? 'bg-blue-500/8 border-blue-500/25'
                              : assignments.length > 0
                                ? 'bg-white/5 border-white/10'
                                : 'bg-white/[0.02] border-white/5'
                          }`}
                        >
                          {assignments.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                              <span className="text-white/10 text-xs">—</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {assignments.map((a, aIdx) => (
                                <div
                                  key={aIdx}
                                  className={`rounded-md px-1.5 py-1 text-[11px] leading-tight ${
                                    a.priority === 'urgent' || a.priority === 'critical'
                                      ? 'bg-red-500/20 border border-red-500/30'
                                      : `${color.bg} border ${color.border}`
                                  }`}
                                >
                                  <div className="flex items-start gap-1">
                                    {(a.priority === 'urgent' || a.priority === 'critical') && (
                                      <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0">
                                      <div className={`font-semibold truncate ${
                                        a.priority !== 'normal' ? 'text-red-300' : 'text-white/80'
                                      }`}>
                                        {a.intervention_label}
                                      </div>
                                      {a.client_name && (
                                        <div className="text-white/40 truncate">{a.client_name}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <div className="bg-white/5 border-t border-white/10 px-6 py-2 flex items-center justify-between text-white/40 text-xs flex-shrink-0">
        <span>📞 info@enes-electricite.ch</span>
        <span>🌐 www.enes-electricite.ch</span>
        <span>📍 Genève, Suisse</span>
      </div>
    </div>
  );
}
