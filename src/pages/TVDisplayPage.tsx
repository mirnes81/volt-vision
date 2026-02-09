import * as React from 'react';
import { Zap, ChevronRight, Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, MapPin, Calendar, AlertTriangle } from 'lucide-react';
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

interface TechPlanning {
  userName: string;
  assignments: { label: string; client: string | null; location: string | null; priority: string }[];
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

function WeatherIcon({ desc }: { desc: string }) {
  const d = desc.toLowerCase();
  if (d.includes('neige') || d.includes('snow')) return <CloudSnow className="h-10 w-10 text-blue-200" />;
  if (d.includes('pluie') || d.includes('rain') || d.includes('averse')) return <CloudRain className="h-10 w-10 text-blue-300" />;
  if (d.includes('nuag') || d.includes('cloud') || d.includes('couvert') || d.includes('brouillard')) return <Cloud className="h-10 w-10 text-gray-300" />;
  return <Sun className="h-10 w-10 text-yellow-400" />;
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

// ─── Today assignments hook ──────────────────────────────────────────
function useTodayAssignments() {
  const [planning, setPlanning] = React.useState<TechPlanning[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchAssignments = React.useCallback(async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data, error } = await supabase
        .from('intervention_assignments')
        .select('user_name, intervention_label, client_name, location, priority, date_planned')
        .eq('tenant_id', '00000000-0000-0000-0000-000000000001')
        .gte('date_planned', startOfDay)
        .lt('date_planned', endOfDay)
        .order('user_name');

      if (error) {
        const { data: fallback } = await supabase
          .from('intervention_assignments')
          .select('user_name, intervention_label, client_name, location, priority, date_planned')
          .eq('tenant_id', '00000000-0000-0000-0000-000000000001')
          .order('date_planned', { ascending: true })
          .limit(50);
        if (fallback) groupByTech(fallback);
        return;
      }

      groupByTech(data || []);
    } catch (err) {
      console.error('TV planning error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  function groupByTech(data: any[]) {
    const grouped = new Map<string, TechPlanning>();
    for (const row of data) {
      const name = row.user_name || 'Non assigné';
      if (!grouped.has(name)) grouped.set(name, { userName: name, assignments: [] });
      grouped.get(name)!.assignments.push({
        label: row.intervention_label || 'Intervention',
        client: row.client_name,
        location: row.location,
        priority: row.priority || 'normal',
      });
    }
    setPlanning(Array.from(grouped.values()));
  }

  React.useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 120_000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  return { planning, loading };
}

// ─── Exposition slides ───────────────────────────────────────────────
const EXPO_SLIDES = [
  {
    title: 'ENES Électricité',
    subtitle: 'Votre partenaire électrique de confiance',
    items: ['Installations électriques', 'Dépannages 24/7', 'Rénovations complètes', 'Domotique & Smart Home'],
  },
  {
    title: 'Nos Services',
    subtitle: 'Solutions professionnelles pour tous vos besoins',
    items: ['Tableaux électriques', 'Éclairage LED', 'Bornes de recharge', 'Contrôles OIBT'],
  },
  {
    title: 'Pourquoi ENES ?',
    subtitle: 'La qualité suisse au service de votre sécurité',
    items: ['Techniciens certifiés', 'Intervention rapide', 'Devis gratuit', 'Garantie sur tous les travaux'],
  },
];

const TECH_COLORS = [
  'bg-blue-500/20 border-blue-500/30',
  'bg-green-500/20 border-green-500/30',
  'bg-purple-500/20 border-purple-500/30',
  'bg-amber-500/20 border-amber-500/30',
  'bg-cyan-500/20 border-cyan-500/30',
  'bg-rose-500/20 border-rose-500/30',
];

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

// ─── Main Page ───────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const { enterFullscreen } = useFullscreen();
  const [slideIndex, setSlideIndex] = React.useState(0);
  const now = useClock();
  const weather = useWeather();
  const { planning, loading } = useTodayAssignments();

  React.useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % EXPO_SLIDES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const slide = EXPO_SLIDES[slideIndex];

  return (
    <div className="h-screen bg-gradient-to-br from-[hsl(217,91%,10%)] to-[hsl(217,91%,22%)] text-white flex flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src={logoEnes} alt="ENES" className="h-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ENES Électricité</h1>
            <p className="text-blue-300 text-sm capitalize">
              {now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums">
            {now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ─── Main grid: left = slides, right = météo + planning ── */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 min-h-0">

        {/* LEFT: Exposition slides (2 cols) */}
        <div className="col-span-2 flex flex-col justify-center items-center rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 p-8">
          <div className="text-center space-y-8 max-w-3xl animate-fade-in" key={slideIndex}>
            <div className="space-y-3">
              <Zap className="h-12 w-12 mx-auto text-yellow-400" />
              <h2 className="text-5xl font-extrabold">{slide.title}</h2>
              <p className="text-xl text-blue-200">{slide.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {slide.items.map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 flex items-center gap-3 border border-white/10">
                  <ChevronRight className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                  <span className="text-lg font-medium">{item}</span>
                </div>
              ))}
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 pt-2">
              {EXPO_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 rounded-full transition-all duration-500 ${i === slideIndex ? 'w-8 bg-yellow-400' : 'w-2.5 bg-white/30'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Météo + Planning (1 col) */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* Météo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-5 flex-shrink-0">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-blue-300 uppercase tracking-wider">
              <Thermometer className="h-4 w-4 text-orange-400" />
              Météo du jour
            </h3>
            {weather ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <WeatherIcon desc={weather.description} />
                  <div>
                    <span className="text-4xl font-extrabold">{weather.temp}°C</span>
                    <p className="text-blue-200 capitalize text-sm">{weather.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{weather.city}</span>
                  <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{weather.wind} km/h</span>
                  <span>{weather.humidity}% hum.</span>
                </div>
              </div>
            ) : (
              <div className="text-white/30 text-sm">Chargement…</div>
            )}
          </div>

          {/* Planning du jour */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-5 flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-blue-300 uppercase tracking-wider flex-shrink-0">
              <Calendar className="h-4 w-4 text-blue-400" />
              Planning du jour
            </h3>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-white/30 text-sm text-center py-4">Chargement…</div>
              ) : planning.length === 0 ? (
                <div className="text-center text-white/30 py-6 space-y-2">
                  <Calendar className="h-8 w-8 mx-auto opacity-40" />
                  <p className="text-sm">Aucune intervention aujourd'hui</p>
                </div>
              ) : (
                <>
                  {planning.map((tech, i) => (
                    <div key={tech.userName} className={`rounded-xl border p-3 ${TECH_COLORS[i % TECH_COLORS.length]}`}>
                      <div className="font-bold text-sm mb-1 flex items-center justify-between">
                        <span>{tech.userName}</span>
                        <span className="text-xs font-normal text-white/50">{tech.assignments.length}</span>
                      </div>
                      {tech.assignments.map((a, j) => (
                        <div key={j} className="text-white/70 text-xs flex items-start gap-1.5 ml-1 mb-0.5">
                          {a.priority === 'urgent' || a.priority === 'critical' ? (
                            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-2.5 w-2.5 flex-shrink-0 mt-0.5 text-white/40" />
                          )}
                          <div>
                            <span className={a.priority !== 'normal' ? 'text-red-300 font-medium' : ''}>
                              {a.label}
                            </span>
                            {a.client && <span className="text-white/40 ml-1">— {a.client}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="text-center text-white/20 text-[10px] mt-1">
                    Rafraîchi toutes les 2 min
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Consignes */}
          <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 rounded-2xl border border-green-500/20 p-4 flex-shrink-0">
            <h3 className="text-xs font-bold text-green-400 mb-1">📋 Consignes du jour</h3>
            <p className="text-green-200 text-xs leading-relaxed">
              Vérifiez vos EPI avant chaque intervention. Portez casque et gants sur les chantiers. Bonne journée !
            </p>
          </div>
        </div>
      </div>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <div className="bg-white/5 border-t border-white/10 px-8 py-2 flex items-center justify-between text-white/40 text-xs flex-shrink-0">
        <span>📞 info@enes-electricite.ch</span>
        <span>🌐 www.enes-electricite.ch</span>
        <span>📍 Genève, Suisse</span>
      </div>
    </div>
  );
}
