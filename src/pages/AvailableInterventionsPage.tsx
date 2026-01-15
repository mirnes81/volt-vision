import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Clock, 
  Car, 
  Timer, 
  User, 
  Locate, 
  Loader2,
  HandHeart,
  RefreshCw,
  Navigation,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ReleasedIntervention, 
  getAvailableInterventions, 
  takeIntervention,
  sortByDistance,
  calculateDistance
} from '@/lib/releasedInterventions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const typeColors: Record<string, string> = {
  installation: '#10B981',
  depannage: '#EF4444',
  renovation: '#8B5CF6',
  tableau: '#F59E0B',
  cuisine: '#EC4899',
  oibt: '#3B82F6',
};

function estimateDuration(distanceKm: number): number {
  return Math.round(distanceKm / 35 * 60);
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? m : ''}`;
}

export default function AvailableInterventionsPage() {
  const navigate = useNavigate();
  const { worker } = useAuth();
  const [interventions, setInterventions] = useState<(ReleasedIntervention & { distance?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTaking, setIsTaking] = useState(false);

  const loadInterventions = useCallback(async () => {
    const data = await getAvailableInterventions();
    
    if (userLocation) {
      const sorted = sortByDistance(data, userLocation.lat, userLocation.lng);
      setInterventions(sorted);
    } else {
      setInterventions(data);
    }
    
    setIsLoading(false);
  }, [userLocation]);

  // Initial load
  useEffect(() => {
    loadInterventions();
  }, [loadInterventions]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('released_interventions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'released_interventions'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          loadInterventions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInterventions]);

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setIsLocating(false);
        toast.success('Position obtenue');
        
        // Re-sort interventions
        const sorted = interventions
          .map(i => ({
            ...i,
            distance: i.latitude && i.longitude 
              ? calculateDistance(loc.lat, loc.lng, i.latitude, i.longitude)
              : undefined
          }))
          .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        setInterventions(sorted);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Impossible d\'obtenir la position');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleTake = async () => {
    if (!selectedId || !worker) return;
    
    setIsTaking(true);
    const result = await takeIntervention(
      selectedId,
      worker.id,
      `${worker.firstName} ${worker.name}`
    );

    if (result.success) {
      toast.success('Intervention reprise !', {
        description: 'Elle a été attribuée à vous'
      });
      setSelectedId(null);
      loadInterventions();
    } else {
      toast.error('Erreur', { description: result.error || 'Déjà prise par quelqu\'un d\'autre' });
    }
    
    setIsTaking(false);
  };

  const openInMaps = (intervention: ReleasedIntervention) => {
    const addr = encodeURIComponent(intervention.location);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    let url: string;
    if (userLocation) {
      if (isIOS) {
        url = `http://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${addr}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${addr}&travelmode=driving`;
      }
    } else {
      if (isIOS) {
        url = `http://maps.apple.com/?daddr=${addr}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${addr}&travelmode=driving`;
      }
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HandHeart className="w-6 h-6 text-primary" />
            Interventions disponibles
          </h1>
          <p className="text-sm text-muted-foreground">
            {interventions.length} intervention{interventions.length > 1 ? 's' : ''} libérée{interventions.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadInterventions()}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant={userLocation ? "default" : "outline"}
            size="icon"
            onClick={locateUser}
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Locate className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Location hint */}
      {!userLocation && interventions.length > 0 && (
        <div className="bg-primary/10 rounded-xl p-3 text-sm flex items-center gap-2">
          <Locate className="w-4 h-4 text-primary shrink-0" />
          <span>Activez la localisation pour voir les interventions les plus proches en premier</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : interventions.length === 0 ? (
        <div className="text-center py-12">
          <HandHeart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-1">Aucune intervention disponible</h3>
          <p className="text-sm text-muted-foreground">
            Les interventions libérées par vos collègues apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {interventions.map((intervention) => {
            const duration = intervention.distance ? estimateDuration(intervention.distance) : null;
            
            return (
              <div
                key={intervention.id}
                className="bg-card rounded-2xl border border-border/50 shadow-card p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: typeColors[intervention.intervention_type] || '#6366F1' }}
                    />
                    <Badge variant="outline" className="text-xs">
                      {intervention.intervention_ref}
                    </Badge>
                    {intervention.priority === 'urgent' && (
                      <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                    )}
                  </div>
                  {intervention.distance !== undefined && (
                    <div className="flex items-center gap-2 bg-primary/10 px-2.5 py-1 rounded-full">
                      <Car className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-bold text-primary">
                        {formatDistance(intervention.distance)}
                      </span>
                      {duration && (
                        <>
                          <span className="text-primary/50">•</span>
                          <Timer className="w-3.5 h-3.5 text-primary/70" />
                          <span className="text-sm font-medium text-primary/70">
                            ~{formatDuration(duration)}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div>
                  <h3 className="font-semibold">{intervention.intervention_label}</h3>
                  <p className="text-sm text-muted-foreground">{intervention.client_name}</p>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{intervention.location}</span>
                </div>

                {/* Date */}
                {intervention.date_start && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      {format(parseISO(intervention.date_start), "EEE d MMM 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>
                )}

                {/* Released by */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5 w-fit">
                  <User className="w-3.5 h-3.5" />
                  <span>
                    Libérée par <strong>{intervention.released_by_name}</strong>
                    {' · '}
                    {format(parseISO(intervention.released_at), "HH:mm", { locale: fr })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 h-12"
                    onClick={() => openInMaps(intervention)}
                  >
                    <Navigation className="w-5 h-5 mr-2" />
                    Naviguer
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1 h-12"
                    onClick={() => setSelectedId(intervention.id)}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Reprendre
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprendre cette intervention ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous serez assigné à cette intervention. Les autres employés ne pourront plus la prendre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTaking}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleTake} disabled={isTaking}>
              {isTaking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}