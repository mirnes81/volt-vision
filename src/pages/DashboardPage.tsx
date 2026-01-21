import * as React from 'react';
import { Zap, ClipboardList, Clock, AlertTriangle, ChevronRight, Wifi, WifiOff, Plus, Calendar, TrendingUp, Users, MapPin, Play, CheckCircle2, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { InterventionCardCompact } from '@/components/intervention/InterventionCardCompact';
import { WeeklyHoursSummary } from '@/components/dashboard/WeeklyHoursSummary';
import { ProductivityCharts } from '@/components/dashboard/ProductivityCharts';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { useAuth } from '@/contexts/AuthContext';
import { useInterventionsCache } from '@/hooks/useInterventionsCache';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { Intervention } from '@/types/intervention';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DashboardPage() {
  const { worker } = useAuth();
  const isAdmin = worker?.isAdmin;
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  
  // Use shared cache - this reuses data already loaded elsewhere
  const { interventions: allInterventions, isLoading } = useInterventionsCache(false);
  
  // Use global assignments context
  const { getAssignmentsForIntervention } = useAssignments();
  
  // Get recent 10 for display
  const interventions = React.useMemo(() => allInterventions.slice(0, 10), [allInterventions]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Today's interventions
  const todayInterventions = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return allInterventions.filter(int => {
      if (!int.dateStart) return false;
      const date = new Date(int.dateStart);
      return date >= today && date < tomorrow;
    }).sort((a, b) => {
      if (!a.dateStart || !b.dateStart) return 0;
      return new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime();
    });
  }, [allInterventions]);

  // This week's interventions
  const weekInterventions = React.useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return allInterventions.filter(int => {
      if (!int.dateStart) return false;
      const date = new Date(int.dateStart);
      return date >= startOfWeek && date < endOfWeek;
    });
  }, [allInterventions]);

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

  // Type colors for mini cards
  const typeColors: Record<string, string> = {
    installation: 'bg-primary',
    depannage: 'bg-destructive',
    renovation: 'bg-warning',
    tableau: 'bg-success',
    cuisine: 'bg-purple-500',
    oibt: 'bg-cyan-500',
  };

  const getInterventionTime = (int: Intervention): string | null => {
    if (!int.dateStart) return null;
    const date = new Date(int.dateStart);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) return null;
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="pb-4">
      <Header title="ENES Électricité" showNotifications />

      <div className="px-4 lg:px-6 space-y-6">
        {/* Welcome Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground capitalize">{currentDate}</p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1">
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

        {/* Tabs for Dashboard Views */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Productivité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {/* Desktop Layout */}
            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* KPIs Cards */}
                <DashboardKPIs />

            {/* Quick Actions - Mobile */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Dernières interventions</h3>
                <Link to="/interventions" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
                  Voir tout
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {isLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : interventions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border/50">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune intervention récente</p>
                  <Link to="/intervention/new" className="mt-4 inline-block">
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Créer une intervention
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-2">
                  {interventions.slice(0, 8).map((intervention) => (
                    <InterventionCardCompact 
                      key={intervention.id} 
                      intervention={intervention} 
                      supabaseAssignments={getAssignmentsForIntervention(intervention.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar (Desktop only) */}
          <div className="hidden lg:block space-y-6 mt-6 lg:mt-0">
            {/* Quick Actions */}
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Actions rapides
              </h3>
              <div className="space-y-2">
                <Link to="/intervention/new" className="block">
                  <Button className="w-full gap-2 justify-start" size="lg">
                    <Plus className="w-5 h-5" />
                    Nouvelle intervention
                  </Button>
                </Link>
                <Link to="/interventions" className="block">
                  <Button variant="outline" className="w-full gap-2 justify-start" size="lg">
                    <ClipboardList className="w-5 h-5" />
                    Toutes les interventions
                  </Button>
                </Link>
                <Link to="/calendar" className="block">
                  <Button variant="outline" className="w-full gap-2 justify-start" size="lg">
                    <Calendar className="w-5 h-5" />
                    Voir le calendrier
                  </Button>
                </Link>
              </div>
            </div>

            {/* Weekly Hours Summary (Admin only) */}
            {isAdmin && <WeeklyHoursSummary />}

            {/* Today's Schedule */}
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Aujourd'hui
                </h3>
                <span className="text-sm text-muted-foreground">
                  {todayInterventions.length} intervention{todayInterventions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {todayInterventions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune intervention programmée</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayInterventions.slice(0, 5).map((int) => {
                    const time = getInterventionTime(int);
                    return (
                      <Link
                        key={int.id}
                        to={`/intervention/${int.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className={cn(
                          "w-1 h-10 rounded-full",
                          typeColors[int.type] || 'bg-primary'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{int.label}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {time && (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>{time}</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="truncate">{int.clientName}</span>
                          </div>
                        </div>
                        {int.priority === 'urgent' && (
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                  {todayInterventions.length > 5 && (
                    <Link to="/calendar" className="block text-center text-sm text-primary font-medium hover:underline py-2">
                      +{todayInterventions.length - 5} autres
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Week Overview */}
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Cette semaine
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{weekInterventions.length}</p>
                  <p className="text-xs text-muted-foreground">Interventions</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">
                    {weekInterventions.filter(i => i.priority === 'urgent').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Urgentes</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">
                    {weekInterventions.filter(i => i.status === 'termine').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Terminées</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">
                    {weekInterventions.filter(i => i.status === 'a_planifier').length}
                  </p>
                  <p className="text-xs text-muted-foreground">À planifier</p>
                </div>
              </div>
            </div>

            {/* Clients récurrents */}
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                Clients fréquents
              </h3>
              
              {(() => {
                const clientCounts = allInterventions.reduce((acc, int) => {
                  acc[int.clientName] = (acc[int.clientName] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                const topClients = Object.entries(clientCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5);
                
                if (topClients.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun client
                    </p>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {topClients.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                        <span className="text-sm font-medium truncate">{name}</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {count} int.
                        </span>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </div>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 space-y-6">
            {/* Productivity Charts */}
            <ProductivityCharts />

            {/* Additional Analytics */}
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                Résumé mensuel
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{allInterventions.length}</p>
                  <p className="text-xs text-muted-foreground">Interventions totales</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-success">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Terminées</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-warning">{urgentCount}</p>
                  <p className="text-xs text-muted-foreground">Urgentes</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-accent">{inProgressCount}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
              </div>
            </div>

            {/* Team Performance - Only for admin */}
            {isAdmin && (
              <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  Performance équipe
                </h3>
                <WeeklyHoursSummary />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
