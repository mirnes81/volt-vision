import { useState, useEffect } from 'react';
import { Search, Filter, ClipboardList } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { InterventionCard } from '@/components/intervention/InterventionCard';
import { Input } from '@/components/ui/input';
import { getTodayInterventions } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const filters = [
  { value: 'all', label: 'Tous' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'a_planifier', label: 'À faire' },
  { value: 'urgent', label: 'Urgents' },
];

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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

  const filteredInterventions = interventions.filter((i) => {
    // Search filter
    const matchesSearch = 
      search === '' ||
      i.ref.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase()) ||
      i.clientName.toLowerCase().includes(search.toLowerCase()) ||
      i.location.toLowerCase().includes(search.toLowerCase());

    // Status filter
    let matchesFilter = true;
    if (activeFilter === 'urgent') {
      matchesFilter = i.priority === 'urgent';
    } else if (activeFilter !== 'all') {
      matchesFilter = i.status === activeFilter;
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="pb-4">
      <Header title="Mes interventions" />

      <div className="px-4 space-y-4">
        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 rounded-xl"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 btn-press",
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : filteredInterventions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune intervention trouvée</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {filteredInterventions.map((intervention) => (
              <InterventionCard key={intervention.id} intervention={intervention} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
