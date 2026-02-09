import * as React from 'react';
import { Zap, ArrowLeft, ChevronRight } from 'lucide-react';
import logoEnes from '@/assets/logo-enes.png';

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

// ─── Exposition Mode ─────────────────────────────────────────────────
function ExpositionMode() {
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

  React.useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  return <ExpositionMode />;
}
