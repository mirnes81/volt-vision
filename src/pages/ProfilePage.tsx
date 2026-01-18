import * as React from 'react';
import { LogOut, User, Phone, Mail, Shield, HelpCircle, Moon, Sun, Globe, Wifi, WifiOff, Settings, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { isDolibarrConfigured } from '@/lib/dolibarrConfig';
import { supabase } from '@/integrations/supabase/client';

interface DolibarrUser {
  id: number;
  login: string;
  name: string;
  firstName: string;
  email: string;
  admin: string;
}

export default function ProfilePage() {
  const { worker, logout } = useAuth();
  const { theme, setTheme, actualTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  
  const [dolibarrUsers, setDolibarrUsers] = React.useState<DolibarrUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  // Fetch all Dolibarr users on mount
  React.useEffect(() => {
    async function fetchDolibarrUsers() {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase.functions.invoke('dolibarr-api', {
          body: { action: 'get-users' },
        });
        
        if (error) throw error;
        
        console.log('[ProfilePage] Dolibarr users:', data);
        if (Array.isArray(data)) {
          setDolibarrUsers(data);
        }
      } catch (err) {
        console.error('[ProfilePage] Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    
    if (isDolibarrConfigured()) {
      fetchDolibarrUsers();
    }
  }, []);

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

        {/* Dolibarr Users Emails */}
        {isDolibarrConfigured() && (
          <div className="bg-card rounded-xl p-4 shadow-card border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Utilisateurs Dolibarr</p>
            </div>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : dolibarrUsers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {dolibarrUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {user.firstName} {user.name}
                        {user.admin === '1' && (
                          <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Admin</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email || 'Pas d\'email'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun utilisateur trouvé</p>
            )}
          </div>
        )}

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

        {/* Dolibarr Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="w-full bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Configuration Dolibarr</p>
            <p className="text-xs text-muted-foreground">
              {isDolibarrConfigured() ? 'Connecté' : 'Non configuré'}
            </p>
          </div>
        </button>

        {/* Logout */}
        <Button variant="destructive" size="full" onClick={handleLogout} className="gap-3">
          <LogOut className="w-5 h-5" />
          {t('profile.logout')}
        </Button>

        <p className="text-center text-xs text-muted-foreground">ENES Électricité v2.0.0</p>
      </div>
    </div>
  );
}
