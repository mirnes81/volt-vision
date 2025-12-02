import { useState, useEffect } from 'react';
import { Zap, ClipboardList, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { InterventionCard } from '@/components/intervention/InterventionCard';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayInterventions } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { worker } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInterventions();
  }, []);

  const loadInterventions = async () => {
    try {
      const data = await getTodayInterventions();
      setInterventions(data);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const urgentCount = interventions.filter(i => i.priority === 'urgent').length;
  const inProgressCount = interventions.filter(i => i.status === 'en_cours').length;
  const totalHours = interventions.reduce((acc, i) => 
    acc + i.hours.reduce((h, hour) => h + (hour.durationHours || 0), 0), 0
  );

  const currentDate = new Date().toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="pb-4">
      <Header title="MV3 Pro" showNotifications />

      <div className="px-4 space-y-6">
        {/* Welcome Section */}
        <div className="pt-4">
          <p className="text-sm text-muted-foreground capitalize">{currentDate}</p>
          <h2 className="text-2xl font-bold mt-1">
            Bonjour, {worker?.firstName || 'Technicien'} 👋
          </h2>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{interventions.length}</p>
            <p className="text-xs text-muted-foreground">Interventions</p>
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
        </div>

        {/* Quick Actions */}
        <Link 
          to="/interventions"
          className="flex items-center justify-between bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-4 text-primary-foreground shadow-lg card-hover"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold">Mes interventions</p>
              <p className="text-sm opacity-80">{inProgressCount} en cours</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6" />
        </Link>

        {/* Today's Interventions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Aujourd'hui</h3>
            <Link to="/interventions" className="text-sm text-primary font-medium">
              Voir tout
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
              <p>Aucune intervention aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {interventions.slice(0, 3).map((intervention) => (
                <InterventionCard key={intervention.id} intervention={intervention} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
