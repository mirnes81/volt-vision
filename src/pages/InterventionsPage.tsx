import * as React from 'react';
import { Search, ClipboardList, RefreshCw, WifiOff, Database, Cloud, Zap } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { InterventionCard } from '@/components/intervention/InterventionCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useInterventionsCache } from '@/hooks/useInterventionsCache';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const filters = [
  { value: 'all', label: 'Toutes' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'a_planifier', label: 'À planifier' },
  { value: 'termine', label: 'Terminées' },
  { value: 'urgent', label: 'Urgentes' },
];

const PAGE_SIZE = 25;

// Cache source indicator - Compact
const CacheIndicator = ({ source, isOffline }: { source: string | null; isOffline: boolean }) => {
  if (isOffline) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-medium">
        <WifiOff className="w-2.5 h-2.5" />
        <span>Hors ligne</span>
      </div>
    );
  }
  
  const icons = {
    memory: <Zap className="w-2.5 h-2.5" />,
    session: <Zap className="w-2.5 h-2.5" />,
    indexeddb: <Database className="w-2.5 h-2.5" />,
    network: <Cloud className="w-2.5 h-2.5" />,
  };
  
  const labels = {
    memory: 'Cache',
    session: 'Cache',
    indexeddb: 'Local',
    network: 'Réseau',
  };
  
  if (!source) return null;
  
  return (
    <div className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
      source === 'network' ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
    )}>
      {icons[source as keyof typeof icons]}
      <span>{labels[source as keyof typeof labels]}</span>
    </div>
  );
};

export default function InterventionsPage() {
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Check if user is admin
  const workerData = localStorage.getItem('mv3_worker');
  const worker = workerData ? JSON.parse(workerData) : null;
  const isAdmin = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
  
  // Non-admins always see only their interventions
  // Admins can toggle between all and their own
  const [showOnlyMine, setShowOnlyMine] = React.useState(!isAdmin);

  // Use cached interventions with offline support
  const { interventions, isLoading, isRefreshing, isOffline, cacheSource, refresh } = useInterventionsCache(showOnlyMine);
  
  // Use global assignments context
  const { getAssignmentsForIntervention } = useAssignments();

  const handleRefresh = async () => {
    if (isOffline) {
      toast.error('Impossible de rafraîchir hors ligne');
      return;
    }
    await refresh();
    toast.success('Liste actualisée');
  };

  // Memoized filtering
  const filteredInterventions = React.useMemo(() => {
    return interventions.filter((i) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        search === '' ||
        i.ref.toLowerCase().includes(searchLower) ||
        i.label.toLowerCase().includes(searchLower) ||
        i.clientName.toLowerCase().includes(searchLower) ||
        i.location.toLowerCase().includes(searchLower) ||
        (i.extraBon && i.extraBon.toLowerCase().includes(searchLower)) ||
        (i.extraAdresse && i.extraAdresse.toLowerCase().includes(searchLower)) ||
        (i.extraContact && i.extraContact.toLowerCase().includes(searchLower));

      // Status filter
      let matchesFilter = true;
      if (activeFilter === 'urgent') {
        matchesFilter = i.priority === 'urgent';
      } else if (activeFilter === 'termine') {
        matchesFilter = i.status === 'termine' || i.status === 'facture';
      } else if (activeFilter !== 'all') {
        matchesFilter = i.status === activeFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [interventions, search, activeFilter]);

  // Reset to page 1 when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, showOnlyMine]);

  // Memoized pagination
  const { displayedInterventions, totalPages } = React.useMemo(() => {
    const total = Math.ceil(filteredInterventions.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const displayed = filteredInterventions.slice(startIndex, startIndex + PAGE_SIZE);
    return { displayedInterventions: displayed, totalPages: total };
  }, [filteredInterventions, currentPage]);

  // Memoized counts
  const counts = React.useMemo(() => ({
    all: interventions.length,
    en_cours: interventions.filter(i => i.status === 'en_cours').length,
    a_planifier: interventions.filter(i => i.status === 'a_planifier').length,
    termine: interventions.filter(i => i.status === 'termine' || i.status === 'facture').length,
    urgent: interventions.filter(i => i.priority === 'urgent').length,
  }), [interventions]);

  return (
    <div className="pb-2">
      <Header 
        title="Interventions" 
        rightAction={
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </Button>
        }
      />

      <div className="px-3 space-y-2">
        {/* Toggle mine/all - Only show for admins - Compact */}
        {isAdmin && (
          <div className="flex gap-1.5 mt-2">
            <Button
              variant={!showOnlyMine ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyMine(false)}
              className="flex-1 h-8 text-xs"
            >
              Toutes ({counts.all})
            </Button>
            <Button
              variant={showOnlyMine ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyMine(true)}
              className="flex-1 h-8 text-xs"
            >
              Mes interventions
            </Button>
          </div>
        )}

        {/* Search - Compact */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>

        {/* Filters - Compact */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 btn-press flex items-center gap-1",
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {filter.label}
              {counts[filter.value as keyof typeof counts] > 0 && (
                <span className={cn(
                  "text-[10px] px-1 py-0.5 rounded-full min-w-[16px] text-center",
                  activeFilter === filter.value 
                    ? "bg-primary-foreground/20" 
                    : "bg-muted-foreground/20"
                )}>
                  {counts[filter.value as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Info bar with pagination and cache indicator - Compact */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground py-1">
          <div className="flex items-center gap-1.5">
            <span>
              {currentPage}/{totalPages || 1} ({filteredInterventions.length})
            </span>
            <CacheIndicator source={cacheSource} isOffline={isOffline} />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-6 px-2 text-[10px]"
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-6 px-2 text-[10px]"
            >
              →
            </Button>
          </div>
        </div>

        {/* List - Compact */}
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : displayedInterventions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune intervention trouvée</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 stagger-children">
              {displayedInterventions.map((intervention) => (
                <InterventionCard 
                  key={intervention.id} 
                  intervention={intervention}
                  supabaseAssignments={getAssignmentsForIntervention(intervention.id)}
                />
              ))}
            </div>
            
            {/* Bottom pagination - Compact */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3 pb-16">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 text-xs"
                >
                  ← Préc
                </Button>
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-7 text-xs"
                >
                  Suiv →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
