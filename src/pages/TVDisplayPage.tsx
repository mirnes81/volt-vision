import * as React from 'react';
import { Monitor, Users, Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, MapPin, Clock, Calendar, Zap, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import logoEnes from '@/assets/logo-enes.png';

// ─── Types ───────────────────────────────────────────────────────────
interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
  humidity: number;
  wind: number;
}

type TVMode = 'selector' | 'exposition' | 'workers';

// ─── Weather helpers ─────────────────────────────────────────────────
function weatherIcon(desc: string) {
  const d = desc.toLowerCase();
  if (d.includes('neige') || d.includes('snow')) return <CloudSnow className="h-12 w-12 text-blue-200" />;
  if (d.includes('pluie') || d.includes('rain')) return <CloudRain className="h-12 w-12 text-blue-300" />;
  if (d.includes('nuag') || d.includes('cloud') || d.includes('couvert')) return <Cloud className="h-12 w-12 text-gray-300" />;
  return <Sun className="h-12 w-12 text-yellow-400" />;
}

// ─── Weather hook ────────────────────────────────────────────────────
function useWeather() {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchWeather(lat: number, lon: number) {
      try {
        // Open-Meteo — free, no API key
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
        );
        const data = await res.json();
        const current = data.current;
        const wmoDesc = wmoCodeToText(current.weather_code);

        // Reverse geocode city name
        let city = 'Position actuelle';
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
          const geoData = await geo.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || city;
        } catch { /* ignore */ }

        if (!cancelled) {
          setWeather({
            temp: Math.round(current.temperature_2m),
            description: wmoDesc,
            icon: '',
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
        () => fetchWeather(46.2044, 6.1432) // Fallback: Genève
      );
    } else {
      fetchWeather(46.2044, 6.1432);
    }

    return () => { cancelled = true; };
  }, []);

  return weather;
}

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

// ─── Clock hook ──────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
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

// ─── Components ──────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (mode: TVMode) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(217,91%,15%)] to-[hsl(217,91%,30%)] flex items-center justify-center p-8">
      <div className="text-center space-y-12 max-w-4xl w-full">
        <div className="space-y-4">
          <img src={logoEnes} alt="ENES" className="h-24 mx-auto" />
          <h1 className="text-5xl font-bold text-white">ENES Électricité</h1>
          <p className="text-xl text-blue-200">Sélectionnez le mode d'affichage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button
            onClick={() => onSelect('exposition')}
            className="group bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-3xl p-12 text-white transition-all duration-300 hover:scale-105 border border-white/20"
          >
            <Monitor className="h-20 w-20 mx-auto mb-6 text-blue-300 group-hover:text-blue-200 transition-colors" />
            <h2 className="text-3xl font-bold mb-3">Mode Exposition</h2>
            <p className="text-blue-200 text-lg">Vitrine de l'entreprise pour clients et visiteurs</p>
          </button>

          <button
            onClick={() => onSelect('workers')}
            className="group bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-3xl p-12 text-white transition-all duration-300 hover:scale-105 border border-white/20"
          >
            <Users className="h-20 w-20 mx-auto mb-6 text-green-300 group-hover:text-green-200 transition-colors" />
            <h2 className="text-3xl font-bold mb-3">Mode Ouvriers</h2>
            <p className="text-blue-200 text-lg">Pointage matin, météo & planning du jour</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpositionMode({ onBack }: { onBack: () => void }) {
  const [slideIndex, setSlideIndex] = React.useState(0);
  const now = useClock();

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % EXPO_SLIDES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const slide = EXPO_SLIDES[slideIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(217,91%,12%)] to-[hsl(217,91%,25%)] text-white flex flex-col relative overflow-hidden">
      {/* Back button */}
      <button onClick={onBack} className="absolute top-6 left-6 text-white/40 hover:text-white/80 transition-colors z-10">
        <ArrowLeft className="h-8 w-8" />
      </button>

      {/* Top bar */}
      <div className="flex items-center justify-between px-12 py-6">
        <img src={logoEnes} alt="ENES" className="h-16" />
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums">
            {now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-blue-300 text-lg capitalize">
            {now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-12">
        <div className="text-center space-y-10 max-w-4xl animate-fade-in" key={slideIndex}>
          <div className="space-y-4">
            <Zap className="h-16 w-16 mx-auto text-yellow-400" />
            <h2 className="text-6xl font-extrabold">{slide.title}</h2>
            <p className="text-2xl text-blue-200">{slide.subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {slide.items.map((item, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-center gap-4 border border-white/10">
                <ChevronRight className="h-6 w-6 text-yellow-400 flex-shrink-0" />
                <span className="text-xl font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-3 pb-8">
        {EXPO_SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-3 rounded-full transition-all duration-500 ${i === slideIndex ? 'w-10 bg-yellow-400' : 'w-3 bg-white/30'}`}
          />
        ))}
      </div>

      {/* Contact bar */}
      <div className="bg-white/5 border-t border-white/10 px-12 py-4 flex items-center justify-between text-blue-200">
        <span className="text-lg">📞 info@enes-electricite.ch</span>
        <span className="text-lg">🌐 www.enes-electricite.ch</span>
        <span className="text-lg">📍 Genève, Suisse</span>
      </div>
    </div>
  );
}

function WorkersMode({ onBack }: { onBack: () => void }) {
  const now = useClock();
  const weather = useWeather();
  const qrUrl = 'https://app.enes-electricite.ch/login';

  // Generate a simple QR code SVG via a free API
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=1a365d`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(220,30%,8%)] to-[hsl(220,30%,18%)] text-white flex flex-col">
      {/* Back button */}
      <button onClick={onBack} className="absolute top-6 left-6 text-white/40 hover:text-white/80 transition-colors z-10">
        <ArrowLeft className="h-8 w-8" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-12 py-6 border-b border-white/10">
        <div className="flex items-center gap-6">
          <img src={logoEnes} alt="ENES" className="h-14" />
          <div>
            <h1 className="text-3xl font-bold">Bonjour l'équipe ! 👋</h1>
            <p className="text-blue-300 text-lg capitalize">
              {now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tabular-nums">
            {now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-8">
        {/* Left: QR Code */}
        <div className="flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Clock className="h-7 w-7 text-green-400" />
            Pointage du matin
          </h2>
          <div className="bg-white rounded-2xl p-4">
            <img src={qrImageUrl} alt="QR Code Pointage" className="w-64 h-64" />
          </div>
          <p className="text-blue-200 text-center text-lg">
            Scannez ce QR code avec<br />votre téléphone pour pointer
          </p>
          <div className="text-sm text-white/40 mt-2">
            → Ouvre l'application ENES
          </div>
        </div>

        {/* Center: Weather + Info */}
        <div className="flex flex-col gap-6">
          {/* Weather Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 flex-1 flex flex-col justify-center">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Thermometer className="h-6 w-6 text-orange-400" />
              Météo du jour
            </h2>
            {weather ? (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-6">
                  {weatherIcon(weather.description)}
                  <span className="text-7xl font-extrabold">{weather.temp}°C</span>
                </div>
                <div className="text-center">
                  <p className="text-2xl text-blue-200 capitalize">{weather.description}</p>
                  <p className="text-lg text-white/50 flex items-center justify-center gap-2 mt-2">
                    <MapPin className="h-4 w-4" /> {weather.city}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <Wind className="h-5 w-5 mx-auto mb-1 text-blue-300" />
                    <span className="text-lg font-semibold">{weather.wind} km/h</span>
                    <p className="text-sm text-white/50">Vent</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <Cloud className="h-5 w-5 mx-auto mb-1 text-blue-300" />
                    <span className="text-lg font-semibold">{weather.humidity}%</span>
                    <p className="text-sm text-white/50">Humidité</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/30 text-xl">Chargement météo...</div>
            )}
          </div>

          {/* Quick message */}
          <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 rounded-3xl border border-green-500/20 p-6">
            <h3 className="text-lg font-bold text-green-400 mb-2">📋 Consignes du jour</h3>
            <p className="text-green-200">
              Vérifiez vos EPI avant chaque intervention. Portez casque et gants sur les chantiers.
              Bonne journée à tous !
            </p>
          </div>
        </div>

        {/* Right: Daily planning placeholder */}
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 flex flex-col">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Calendar className="h-7 w-7 text-blue-400" />
            Planning du jour
          </h2>
          <div className="flex-1 space-y-3 overflow-auto">
            <PlanningPlaceholder />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white/5 border-t border-white/10 px-12 py-3 flex items-center justify-between text-white/40 text-sm">
        <span>ENES Électricité SA — Affichage TV</span>
        <span>app.enes-electricite.ch/tv</span>
      </div>
    </div>
  );
}

function PlanningPlaceholder() {
  // This will later pull from Supabase/Dolibarr assignments
  const mockPlanning = [
    { tech: 'Mirnes V.', tasks: ['Rés. Champel — Tableau élec.', 'Appt. Carouge — Dépannage'], color: 'bg-blue-500/20 border-blue-500/30' },
    { tech: 'Tech. 2', tasks: ['Immeuble Plainpalais — OIBT', 'Villa Cologny — Éclairage'], color: 'bg-green-500/20 border-green-500/30' },
    { tech: 'Tech. 3', tasks: ['Bureau Lancy — Réseau', 'Stock — Inventaire'], color: 'bg-purple-500/20 border-purple-500/30' },
  ];

  return (
    <>
      {mockPlanning.map((p, i) => (
        <div key={i} className={`rounded-2xl border p-4 ${p.color}`}>
          <div className="font-bold text-lg mb-2">{p.tech}</div>
          {p.tasks.map((t, j) => (
            <div key={j} className="text-white/70 text-sm flex items-center gap-2 ml-2">
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              {t}
            </div>
          ))}
        </div>
      ))}
      <div className="text-center text-white/20 text-sm mt-4 italic">
        Données de démonstration — se connecte aux assignations réelles
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function TVDisplayPage() {
  const [mode, setMode] = React.useState<TVMode>('selector');

  if (mode === 'exposition') return <ExpositionMode onBack={() => setMode('selector')} />;
  if (mode === 'workers') return <WorkersMode onBack={() => setMode('selector')} />;
  return <ModeSelector onSelect={setMode} />;
}
