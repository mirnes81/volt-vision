import { useState, useEffect } from 'react';
import { Zap, ClipboardList, Clock, AlertTriangle, ChevronRight, Wifi, WifiOff, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { InterventionCard } from '@/components/intervention/InterventionCard';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentInterventions } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { worker } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadInterventions();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadInterventions = async () => {
    try {
      // Fetch only the 10 most recent interventions for dashboard
      const data = await getRecentInterventions(10);
      setInterventions(data);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const urgentCount = interventions.filter(i => i.priority === 'urgent' || i.priority === 'critical').length;
  const inProgressCount = interventions.filter(i => i.status === 'en_cours').length;
  const completedCount = interventions.filter(i => i.status === 'termine').length;
  const totalHours = interventions.reduce((acc, i) => 
    acc + i.hours.reduce((h, hour) => h + (hour.durationHours || 0), 0), 0
  );

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const today = new Date();
  const currentDate = `${dayNames[today.getDay()]} ${today.toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
  })}`;

  return (
    <div className="pb-4">
      <Header title="ENES Électricité" showNotifications />

      <div className="px-4 space-y-6">
        {/* Welcome Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground capitalize">{currentDate}</p>
              <h2 className="text-2xl font-bold mt-1">
                Bonjour, {worker?.firstName || 'Technicien'} 👋
              </h2>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isOnline ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{interventions.length}</p>
            <p className="text-xs text-muted-foreground">Récentes</p>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <p className="text-2xl font-bold">{urgentCount}</p>
            <p className="text-xs text-muted-foreground">Urgentes</p>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">Travaillées</p>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Terminées</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link 
            to="/intervention/new"
            className="flex flex-col items-center justify-center bg-gradient-to-r from-success to-emerald-500 rounded-2xl p-4 text-white shadow-lg card-hover"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-2">
              <Plus className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm">Nouvelle</p>
            <p className="text-xs opacity-80">Intervention</p>
          </Link>

          <Link 
            to="/interventions"
            className="flex flex-col items-center justify-center bg-gradient-to-r from-primary to-accent rounded-2xl p-4 text-primary-foreground shadow-lg card-hover"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-2">
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm">Interventions</p>
            <p className="text-xs opacity-80">{inProgressCount} en cours</p>
          </Link>
        </div>

        {/* Recent Interventions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">10 dernières interventions</h3>
            <Link to="/interventions" className="text-sm text-primary font-medium flex items-center gap-1">
              Voir tout
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : interventions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune intervention récente</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {interventions.map((intervention) => (
                <InterventionCard key={intervention.id} intervention={intervention} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
