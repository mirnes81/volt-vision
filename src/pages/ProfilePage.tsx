import { LogOut, User, Phone, Mail, Shield, HelpCircle, Moon, Sun, Globe, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { worker, logout } = useAuth();
  const { theme, setTheme, actualTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success(language === 'de' ? 'Abgemeldet' : language === 'it' ? 'Disconnesso' : 'Déconnexion réussie');
    navigate('/login');
  };

  const themes = [
    { value: 'light', icon: Sun, label: 'Clair' },
    { value: 'dark', icon: Moon, label: 'Sombre' },
  ];

  const languages = [
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
  ];

  return (
    <div className="pb-4">
      <Header title={t('profile.title')} />

      <div className="px-4 space-y-4 pt-4">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mx-auto mb-4 shadow-glow">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">{worker?.firstName} {worker?.name}</h2>
          <p className="text-muted-foreground">{worker?.login}</p>
        </div>

        {/* Contact Info */}
        <div className="space-y-2">
          {worker?.email && (
            <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t('profile.email')}</p>
                <p className="font-medium truncate">{worker.email}</p>
              </div>
            </div>
          )}
          {worker?.phone && (
            <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t('profile.phone')}</p>
                <p className="font-medium">{worker.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Theme Selection */}
        <div className="bg-card rounded-xl p-4 shadow-card border border-border/50">
          <p className="text-sm font-medium mb-3">{t('profile.theme')}</p>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value as 'light' | 'dark')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl transition-all",
                  actualTheme === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <t.icon className="w-5 h-5" />
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-card rounded-xl p-4 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('profile.language')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value as 'fr' | 'de' | 'it')}
                className={cn(
                  "p-2.5 rounded-xl text-sm font-medium transition-all",
                  language === lang.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Offline Status */}
        <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
            {navigator.onLine ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-warning" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{t('profile.offline')}</p>
            <p className="text-xs text-muted-foreground">{t('profile.offlineDesc')}</p>
          </div>
        </div>

        {/* Logout */}
        <Button variant="destructive" size="full" onClick={handleLogout} className="gap-3">
          <LogOut className="w-5 h-5" />
          {t('profile.logout')}
        </Button>

        <p className="text-center text-xs text-muted-foreground">MV3 Pro Électricien v2.0.0</p>
      </div>
    </div>
  );
}
