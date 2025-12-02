import { useState, useEffect } from 'react';
import { History, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockInterventions } from '@/lib/mockData';
import { Skeleton } from '@/components/ui/skeleton';

interface HistorySectionProps {
  intervention: Intervention;
}

export function HistorySection({ intervention }: HistorySectionProps) {
  const { t } = useLanguage();
  const [previousInterventions, setPreviousInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [intervention.location]);

  const loadHistory = async () => {
    setIsLoading(true);
    // Simulate API call - in real app, query by location/client
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find interventions at same location (excluding current)
    const history = mockInterventions.filter(
      i => i.id !== intervention.id && 
      (i.location === intervention.location || i.clientId === intervention.clientId)
    );
    
    setPreviousInterventions(history);
    setIsLoading(false);
  };

  const typeLabels: Record<string, string> = {
    installation: 'Installation',
    depannage: 'Dépannage',
    renovation: 'Rénovation',
    tableau: 'Tableau',
    cuisine: 'Cuisine',
    oibt: 'OIBT',
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Adresse</p>
            <p className="font-medium truncate">{intervention.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <History className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Historique</p>
            <p className="font-medium">{previousInterventions.length} intervention(s) précédente(s)</p>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground px-1">
          {t('history.previousInterventions')}
        </h4>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : previousInterventions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('history.noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {previousInterventions.map((prevIntervention) => (
              <Link
                key={prevIntervention.id}
                to={`/intervention/${prevIntervention.id}`}
                className="block bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {prevIntervention.ref}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 bg-secondary rounded-full">
                        {typeLabels[prevIntervention.type] || prevIntervention.type}
                      </span>
                    </div>
                    <p className="font-medium truncate">{prevIntervention.label}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {prevIntervention.dateCreation}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
