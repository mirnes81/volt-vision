import { useState, useEffect } from 'react';
import { Search, ClipboardList, RefreshCw, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { InterventionCard } from '@/components/intervention/InterventionCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAllInterventions, getMyInterventions } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const filters = [
  { value: 'all', label: 'Toutes' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'a_planifier', label: 'À planifier' },
  { value: 'termine', label: 'Terminées' },
  { value: 'urgent', label: 'Urgentes' },
];

const pageSizes = [
  { value: '50', label: '50 interventions' },
  { value: '100', label: '100 interventions' },
  { value: '200', label: '200 interventions' },
  { value: '300', label: '300 interventions' },
  { value: '500', label: '500 interventions' },
  { value: 'all', label: 'Toutes' },
];

export default function InterventionsPage() {
  const [allInterventions, setAllInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [pageSize, setPageSize] = useState('100');
  
  // Check if user is admin
  const workerData = localStorage.getItem('worker');
  const worker = workerData ? JSON.parse(workerData) : null;
  const isAdmin = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;

  useEffect(() => {
    loadInterventions();
  }, [showOnlyMine]);

  const loadInterventions = async () => {
    try {
      setIsLoading(true);
      const data = showOnlyMine ? await getMyInterventions() : await getAllInterventions();
      setAllInterventions(data);
      console.log(`Loaded ${data.length} interventions`);
    } catch (error) {
      console.error('Error loading interventions:', error);
      toast.error('Erreur de chargement des interventions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInterventions();
    setIsRefreshing(false);
    toast.success('Liste actualisée');
  };

  // Filter interventions by search and status
  const filteredInterventions = allInterventions.filter((i) => {
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

  // Apply pagination
  const displayLimit = pageSize === 'all' ? filteredInterventions.length : parseInt(pageSize);
  const displayedInterventions = filteredInterventions.slice(0, displayLimit);
  const hasMore = filteredInterventions.length > displayLimit;

  // Count by status for badges
  const counts = {
    all: allInterventions.length,
    en_cours: allInterventions.filter(i => i.status === 'en_cours').length,
    a_planifier: allInterventions.filter(i => i.status === 'a_planifier').length,
    termine: allInterventions.filter(i => i.status === 'termine' || i.status === 'facture').length,
    urgent: allInterventions.filter(i => i.priority === 'urgent').length,
  };

  return (
    <div className="pb-4">
      <Header 
        title="Interventions" 
        rightAction={
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Toggle mine/all - Only show for admins */}
        {isAdmin && (
          <div className="flex gap-2 mt-4">
            <Button
              variant={!showOnlyMine ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyMine(false)}
              className="flex-1"
            >
              Toutes ({counts.all})
            </Button>
            <Button
              variant={showOnlyMine ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyMine(true)}
              className="flex-1"
            >
              Mes interventions
            </Button>
          </div>
        )}

        {/* Search + Page size */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 rounded-xl"
            />
          </div>
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger className="w-[140px] h-12 rounded-xl">
              <SelectValue placeholder="Afficher" />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 btn-press flex items-center gap-1",
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {filter.label}
              {counts[filter.value as keyof typeof counts] > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
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

        {/* Info bar */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Affichage de {displayedInterventions.length} sur {filteredInterventions.length} interventions
          </span>
          {hasMore && (
            <span className="text-primary font-medium">
              +{filteredInterventions.length - displayLimit} masquées
            </span>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : displayedInterventions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune intervention trouvée</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 stagger-children">
              {displayedInterventions.map((intervention) => (
                <InterventionCard key={intervention.id} intervention={intervention} />
              ))}
            </div>
            
            {/* Load more button */}
            {hasMore && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const currentIndex = pageSizes.findIndex(s => s.value === pageSize);
                    if (currentIndex < pageSizes.length - 1) {
                      setPageSize(pageSizes[currentIndex + 1].value);
                    }
                  }}
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Afficher plus ({filteredInterventions.length - displayLimit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
