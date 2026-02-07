import * as React from 'react';
import { 
  Shield, ScanLine, Package, Users, Clock, Bell, 
  AlertTriangle, Settings, ChevronRight, FileText,
  UserCog, Timer, Smartphone, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentWorker } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminMenuItem {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  component?: string;
  badge?: string;
  color: string;
}

const adminMenuItems: AdminMenuItem[] = [
  {
    title: 'Scan Bons de Régie',
    description: 'Scanner et extraire les données des bons clients',
    icon: ScanLine,
    href: '/voucher-scan',
    badge: 'IA',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    title: 'Catalogues Fournisseurs',
    description: 'Gérer les catalogues Hager, EM et autres',
    icon: Package,
    href: '/catalogs',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    title: 'Urgences',
    description: 'Créer et gérer les interventions urgentes',
    icon: AlertTriangle,
    href: '/emergencies',
    badge: 'Bonus',
    color: 'text-red-500 bg-red-500/10',
  },
  {
    title: 'Permissions Employés',
    description: 'Gérer les droits d\'accès par utilisateur',
    icon: UserCog,
    component: 'permissions',
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    title: 'Paramètres Heures',
    description: 'Limites journalières et alertes de dépassement',
    icon: Timer,
    component: 'hours-settings',
    color: 'text-green-500 bg-green-500/10',
  },
  {
    title: 'Validation Heures',
    description: 'Valider les heures de travail des employés',
    icon: Clock,
    href: '/time-tracking',
    color: 'text-teal-500 bg-teal-500/10',
  },
  {
    title: 'Notifications',
    description: 'Configurer les notifications push et alertes',
    icon: Bell,
    component: 'notifications',
    color: 'text-yellow-500 bg-yellow-500/10',
  },
  {
    title: 'Utilisateurs Dolibarr',
    description: 'Voir la liste des utilisateurs actifs',
    icon: Users,
    component: 'users',
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    title: 'Configuration API',
    description: 'Paramètres de connexion Dolibarr',
    icon: Settings,
    href: '/settings',
    color: 'text-gray-500 bg-gray-500/10',
  },
  {
    title: 'Application PWA',
    description: 'Statut et mise à jour de l\'application',
    icon: Smartphone,
    component: 'pwa',
    color: 'text-pink-500 bg-pink-500/10',
  },
];

export default function AdminPage() {
  const { worker } = useAuth();
  const currentWorker = getCurrentWorker() as any;
  const isAdmin = currentWorker?.isAdmin || currentWorker?.admin || worker?.admin;
  const [activeSection, setActiveSection] = React.useState<string | null>(null);

  // Lazy load components
  const EmployeePermissions = React.lazy(() => 
    import('@/components/settings/EmployeePermissions').then(m => ({ default: m.EmployeePermissions }))
  );
  const NotificationSettings = React.lazy(() => 
    import('@/components/settings/NotificationSettings').then(m => ({ default: m.NotificationSettings }))
  );
  const ReminderSettings = React.lazy(() => 
    import('@/components/settings/ReminderSettings').then(m => ({ default: m.ReminderSettings }))
  );

  if (!isAdmin) {
    return (
      <div className="pb-4">
        <Header title="Administration" />
        <div className="px-4 pt-8 text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground">
            Cette section est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  const handleItemClick = (item: AdminMenuItem) => {
    if (item.component) {
      setActiveSection(activeSection === item.component ? null : item.component);
    }
  };

  return (
    <div className="pb-4">
      <Header title="Administration" />

      <div className="px-4 space-y-4 pt-4 pb-24">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Panneau d'Administration</CardTitle>
                <CardDescription>
                  Gérez tous les paramètres et outils de l'application
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {adminMenuItems.map((item) => {
            const isActive = activeSection === item.component;
            const IconComponent = item.icon;
            
            const content = (
              <div
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                  "bg-card hover:bg-secondary/50",
                  isActive && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => handleItemClick(item)}
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.title}</p>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                {item.href ? (
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 transition-colors",
                    isActive ? "bg-primary border-primary" : "border-muted-foreground/30"
                  )} />
                )}
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.title} to={item.href}>
                  {content}
                </Link>
              );
            }

            return (
              <React.Fragment key={item.title}>
                {content}
              </React.Fragment>
            );
          })}
        </div>

        {/* Expandable Sections */}
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        }>
          {activeSection === 'permissions' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <EmployeePermissions />
            </div>
          )}

          {activeSection === 'hours-settings' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <HoursSettingsSection />
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <NotificationSettings />
              <ReminderSettings />
            </div>
          )}

          {activeSection === 'users' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <DolibarrUsersSection />
            </div>
          )}

          {activeSection === 'pwa' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <PWAStatusSection />
            </div>
          )}
        </React.Suspense>
      </div>
    </div>
  );
}

// Hours Settings Section Component
function HoursSettingsSection() {
  const [maxHoursInput, setMaxHoursInput] = React.useState('8h30');
  const [alertMinutesInput, setAlertMinutesInput] = React.useState('30');

  React.useEffect(() => {
    const { getHoursSettings } = require('@/lib/hoursSettings');
    const settings = getHoursSettings();
    const hours = Math.floor(settings.maxDailyHours / 60);
    const mins = settings.maxDailyHours % 60;
    setMaxHoursInput(`${hours}h${mins.toString().padStart(2, '0')}`);
    setAlertMinutesInput(settings.alertThresholdMinutes.toString());
  }, []);

  const handleSave = () => {
    const { saveHoursSettings, formatMinutesToHM } = require('@/lib/hoursSettings');
    const { toast } = require('@/components/ui/sonner');
    
    let maxMinutes = 510;
    const match = maxHoursInput.match(/^(\d+)[h:](\d+)$/i);
    if (match) {
      maxMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
    } else {
      const decimal = parseFloat(maxHoursInput);
      if (!isNaN(decimal)) {
        maxMinutes = Math.round(decimal * 60);
      }
    }
    
    const alertMins = parseInt(alertMinutesInput) || 30;
    saveHoursSettings({ maxDailyHours: maxMinutes, alertThresholdMinutes: alertMins });
    toast.success(`Limite: ${formatMinutesToHM(maxMinutes)}/jour, Alerte: ${alertMins} min avant`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Paramètres des heures
        </CardTitle>
        <CardDescription>
          Configurez les limites d'heures journalières pour les ouvriers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Heures maximum par jour</label>
          <input
            type="text"
            placeholder="Ex: 8h30"
            value={maxHoursInput}
            onChange={(e) => setMaxHoursInput(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Format: 8h30 ou 8:30
          </p>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Alerte avant dépassement (minutes)</label>
          <input
            type="number"
            min="0"
            max="120"
            value={alertMinutesInput}
            onChange={(e) => setAlertMinutesInput(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>
        
        <button
          onClick={handleSave}
          className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sauvegarder les paramètres
        </button>
      </CardContent>
    </Card>
  );
}

// Dolibarr Users Section
function DolibarrUsersSection() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchUsers() {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('dolibarr-api', {
          body: { action: 'get-users' },
        });
        if (!error && Array.isArray(data)) {
          setUsers(data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          Utilisateurs Dolibarr
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.map((user: any) => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {user.firstName} {user.name}
                    {user.admin === '1' && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Admin</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email || 'Pas d\'email'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Aucun utilisateur trouvé</p>
        )}
      </CardContent>
    </Card>
  );
}

// PWA Status Section
function PWAStatusSection() {
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    const { isInstalledPWA } = require('@/lib/pwaUtils');
    setIsInstalled(isInstalledPWA());
  }, []);

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.update();
        });
      });
      window.location.reload();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Application
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">Mode d'exécution</p>
            <p className="text-muted-foreground">
              {isInstalled ? 'Application installée' : 'Navigateur web'}
            </p>
          </div>
          <Badge variant={isInstalled ? 'default' : 'secondary'}>
            {isInstalled ? 'PWA' : 'Web'}
          </Badge>
        </div>
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">Mise à jour</p>
              <p className="text-muted-foreground">
                Forcer le rechargement des fichiers
              </p>
            </div>
            <button
              onClick={handleUpdate}
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
