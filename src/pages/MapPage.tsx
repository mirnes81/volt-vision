import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Intervention } from '@/types/intervention';
import { getAllInterventions } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Navigation, 
  List, 
  Locate,
  X,
  Clock,
  MapPin,
  AlertTriangle,
  Loader2,
  Car,
  Timer,
  Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import { useWorkerLocations, WorkerLocation } from '@/hooks/useWorkerLocationTracking';

const typeColors: Record<string, string> = {
  installation: '#10B981',
  depannage: '#EF4444',
  renovation: '#8B5CF6',
  tableau: '#F59E0B',
  cuisine: '#EC4899',
  oibt: '#3B82F6',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  a_planifier: { label: 'À planifier', color: 'bg-yellow-500' },
  en_cours: { label: 'En cours', color: 'bg-blue-500' },
  termine: { label: 'Terminé', color: 'bg-green-500' },
  facture: { label: 'Facturé', color: 'bg-purple-500' },
};

interface RouteInfo {
  interventionId: number;
  distance: number;
  duration: number;
}

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateDuration(distanceKm: number): number {
  return Math.round(distanceKm / 35 * 60); // ~35km/h avg city speed
}

// Custom marker icons
const createMarkerIcon = (color: string, isUrgent: boolean = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        ${isUrgent ? `
          <div style="
            position: absolute;
            top: -3px;
            right: -3px;
            width: 14px;
            height: 14px;
            background: #EF4444;
            border-radius: 50%;
            border: 2px solid white;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const userIcon = L.divIcon({
  className: 'user-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #3B82F6;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.3), 0 3px 8px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Worker marker icon
const createWorkerIcon = (name: string) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return L.divIcon({
    className: 'worker-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22C55E, #16A34A);
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        ">${initials}</div>
        <div style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: #22C55E;
          border-radius: 50%;
          border: 2px solid white;
          animation: pulse 2s infinite;
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

// Component to handle map center updates
function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1 });
    }
  }, [center, zoom, map]);
  
  return null;
}

// Component to fit bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [interventions, setInterventions] = React.useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedIntervention, setSelectedIntervention] = React.useState<Intervention | null>(null);
  const [selectedWorker, setSelectedWorker] = React.useState<WorkerLocation | null>(null);
  const [showList, setShowList] = React.useState(false);
  const [showWorkers, setShowWorkers] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null);
  const [userLocation, setUserLocation] = React.useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [routeInfos, setRouteInfos] = React.useState<Map<number, RouteInfo>>(new Map());
  const [flyToCenter, setFlyToCenter] = React.useState<[number, number] | null>(null);
  const [flyToZoom, setFlyToZoom] = React.useState<number | undefined>(undefined);

  // Get worker locations
  const { workers: onlineWorkers, isLoading: workersLoading } = useWorkerLocations();
  
  // Load interventions from API
  React.useEffect(() => {
    const loadInterventions = async () => {
      try {
        setIsLoading(true);
        const data = await getAllInterventions();
        setInterventions(data);
      } catch (error) {
        console.error('Erreur chargement interventions:', error);
        toast.error('Erreur de chargement des interventions');
      } finally {
        setIsLoading(false);
      }
    };
    loadInterventions();
  }, []);

  const filteredInterventions = filterStatus
    ? interventions.filter(i => i.status === filterStatus)
    : interventions;

  const geolocatedInterventions = filteredInterventions.filter(i => i.coordinates);

  // Calculate distances
  const calculateDistances = React.useCallback((userLat: number, userLng: number) => {
    const newRouteInfos = new Map<number, RouteInfo>();
    
    geolocatedInterventions.forEach(intervention => {
      if (intervention.coordinates) {
        const distance = calculateDistance(
          userLat, userLng,
          intervention.coordinates.lat, intervention.coordinates.lng
        );
        const duration = estimateDuration(distance);
        
        newRouteInfos.set(intervention.id, {
          interventionId: intervention.id,
          distance: Math.round(distance * 10) / 10,
          duration
        });
      }
    });
    
    setRouteInfos(newRouteInfos);
  }, [geolocatedInterventions]);

  // Sort by distance
  const sortedInterventions = React.useMemo(() => {
    return [...geolocatedInterventions].sort((a, b) => {
      const infoA = routeInfos.get(a.id);
      const infoB = routeInfos.get(b.id);
      if (infoA && infoB) return infoA.distance - infoB.distance;
      if (infoA) return -1;
      if (infoB) return 1;
      return 0;
    });
  }, [geolocatedInterventions, routeInfos]);

  // Calculate bounds
  const bounds = React.useMemo(() => {
    if (geolocatedInterventions.length === 0) return null;
    
    const coords = geolocatedInterventions
      .filter(i => i.coordinates)
      .map(i => [i.coordinates!.lat, i.coordinates!.lng] as [number, number]);
    
    if (userLocation) {
      coords.push(userLocation);
    }
    
    if (coords.length === 0) return null;
    return L.latLngBounds(coords);
  }, [geolocatedInterventions, userLocation]);

  // Default center (Geneva)
  const defaultCenter: [number, number] = [46.2044, 6.1432];

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const loc: [number, number] = [latitude, longitude];
        setUserLocation(loc);
        calculateDistances(latitude, longitude);
        setFlyToCenter(loc);
        setFlyToZoom(14);
        setIsLocating(false);
        toast.success('Position obtenue');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Impossible d\'obtenir la position');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const flyToIntervention = (intervention: Intervention) => {
    if (intervention.coordinates) {
      setSelectedIntervention(intervention);
      setShowList(false);
      setFlyToCenter([intervention.coordinates.lat, intervention.coordinates.lng]);
      setFlyToZoom(16);
    }
  };

  const openInMaps = (intervention: Intervention) => {
    const addr = encodeURIComponent(intervention.location);
    
    // Try to detect platform for appropriate maps app
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let url: string;
    if (userLocation) {
      // With origin
      if (isIOS) {
        url = `http://maps.apple.com/?saddr=${userLocation[0]},${userLocation[1]}&daddr=${addr}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${addr}&travelmode=driving`;
      }
    } else {
      // Without origin
      if (isIOS) {
        url = `http://maps.apple.com/?daddr=${addr}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${addr}&travelmode=driving`;
      }
    }
    
    window.open(url, '_blank');
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? m : ''}`;
  };

  const selectedRouteInfo = selectedIntervention ? routeInfos.get(selectedIntervention.id) : null;

  // Route line between user and selected intervention
  const routeLine = React.useMemo(() => {
    if (!userLocation || !selectedIntervention?.coordinates) return null;
    return [
      userLocation,
      [selectedIntervention.coordinates.lat, selectedIntervention.coordinates.lng] as [number, number]
    ];
  }, [userLocation, selectedIntervention]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={11}
        className="h-full w-full"
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={flyToCenter} zoom={flyToZoom} />
        {bounds && !flyToCenter && <FitBounds bounds={bounds} />}
        
        {/* Route line */}
        {routeLine && (
          <Polyline 
            positions={routeLine} 
            color="#3B82F6" 
            weight={4} 
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
        
        {/* User marker */}
        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>Ma position</Popup>
          </Marker>
        )}
        
        {/* Intervention markers */}
        {geolocatedInterventions.map(intervention => {
          if (!intervention.coordinates) return null;
          const routeInfo = routeInfos.get(intervention.id);
          const isSelected = selectedIntervention?.id === intervention.id;
          
          return (
            <Marker
              key={intervention.id}
              position={[intervention.coordinates.lat, intervention.coordinates.lng]}
              icon={createMarkerIcon(
                typeColors[intervention.type] || '#6366F1',
                intervention.priority === 'urgent'
              )}
              eventHandlers={{
                click: () => {
                  setSelectedIntervention(intervention);
                  setSelectedWorker(null);
                  setFlyToCenter([intervention.coordinates!.lat, intervention.coordinates!.lng]);
                  setFlyToZoom(15);
                }
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-semibold">{intervention.label}</p>
                  <p className="text-sm text-gray-600">{intervention.clientName}</p>
                  {routeInfo && (
                    <p className="text-sm font-medium text-blue-600 mt-1">
                      {formatDistance(routeInfo.distance)} • {formatDuration(routeInfo.duration)}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Worker markers */}
        {showWorkers && onlineWorkers.map(worker => (
          <Marker
            key={worker.id}
            position={[worker.latitude, worker.longitude]}
            icon={createWorkerIcon(worker.user_name)}
            eventHandlers={{
              click: () => {
                setSelectedWorker(worker);
                setSelectedIntervention(null);
                setFlyToCenter([worker.latitude, worker.longitude]);
                setFlyToZoom(15);
              }
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <p className="font-semibold">{worker.user_name}</p>
                <p className="text-xs text-green-600">🟢 En ligne</p>
                <p className="text-xs text-gray-500 mt-1">
                  Mis à jour {formatDistanceToNow(new Date(worker.updated_at), { locale: fr, addSuffix: true })}
                </p>
                {worker.current_intervention_ref && (
                  <p className="text-xs text-blue-600 mt-1">
                    📍 {worker.current_intervention_ref}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          className="bg-background/95 backdrop-blur shadow-lg"
          onClick={() => setShowList(true)}
        >
          <List className="w-4 h-4 mr-2" />
          Liste ({geolocatedInterventions.length})
        </Button>

        {/* Workers toggle */}
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            "bg-background/95 backdrop-blur shadow-lg",
            showWorkers && "ring-2 ring-green-500"
          )}
          onClick={() => setShowWorkers(!showWorkers)}
        >
          <Users className="w-4 h-4 mr-2" />
          Équipe ({onlineWorkers.length})
        </Button>

        <div className="flex gap-1 bg-background/95 backdrop-blur rounded-lg shadow-lg p-1">
          {Object.entries(statusConfig).map(([key, { label, color }]) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2",
                filterStatus === key && "bg-primary/20"
              )}
              onClick={() => setFilterStatus(filterStatus === key ? null : key)}
            >
              <div className={cn("w-2 h-2 rounded-full mr-1", color)} />
              <span className="hidden sm:inline text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-24 lg:bottom-8 right-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "bg-background/95 backdrop-blur shadow-lg h-12 w-12",
            userLocation && "ring-2 ring-primary"
          )}
          onClick={locateUser}
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Locate className={cn("w-5 h-5", userLocation && "text-primary")} />
          )}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-24 lg:bottom-8 left-4 z-[1000] bg-background/95 backdrop-blur rounded-lg shadow-lg p-3 max-w-[200px]">
        <p className="text-xs font-medium mb-2">Légende</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full shrink-0" 
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] capitalize truncate">{type}</span>
            </div>
          ))}
        </div>
        {showWorkers && onlineWorkers.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <p className="text-xs font-medium mb-1">Équipe en ligne</p>
            {onlineWorkers.map(w => (
              <div key={w.id} className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-[10px] truncate">{w.user_name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Selected Intervention Card */}
      {selectedIntervention && (
        <div className="absolute bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-md">
          <div className="bg-background rounded-2xl shadow-2xl border p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: typeColors[selectedIntervention.type] }}
                />
                <Badge variant="outline" className="text-xs">
                  {selectedIntervention.ref}
                </Badge>
                {selectedIntervention.priority === 'urgent' && (
                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-2"
                onClick={() => setSelectedIntervention(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <h3 className="font-semibold mb-1">{selectedIntervention.label}</h3>
            <p className="text-sm text-muted-foreground mb-2">{selectedIntervention.clientName}</p>

            {/* Distance & Duration */}
            {selectedRouteInfo && (
              <div className="flex items-center gap-4 mb-3 p-2.5 bg-primary/10 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">{formatDistance(selectedRouteInfo.distance)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">~{formatDuration(selectedRouteInfo.duration)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{selectedIntervention.location}</span>
            </div>

            {selectedIntervention.dateStart && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {format(parseISO(selectedIntervention.dateStart), "EEE d MMM 'à' HH:mm", { locale: fr })}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-12"
                onClick={() => openInMaps(selectedIntervention)}
              >
                <Navigation className="w-5 h-5 mr-2" />
                Naviguer
              </Button>
              <Button
                size="lg"
                className="flex-1 h-12"
                onClick={() => navigate(`/intervention/${selectedIntervention.id}`)}
              >
                Détails
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Worker Card */}
      {selectedWorker && (
        <div className="absolute bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-md">
          <div className="bg-background rounded-2xl shadow-2xl border p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                  {selectedWorker.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedWorker.user_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    En ligne
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-2"
                onClick={() => setSelectedWorker(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                Mis à jour {formatDistanceToNow(new Date(selectedWorker.updated_at), { locale: fr, addSuffix: true })}
              </span>
            </div>

            {selectedWorker.current_intervention_ref && (
              <div className="flex items-center gap-1 text-sm text-blue-600 mb-3">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Intervention: {selectedWorker.current_intervention_ref}</span>
              </div>
            )}

            <div className="p-2 bg-muted rounded-lg text-xs text-muted-foreground">
              📍 Position: {selectedWorker.latitude.toFixed(5)}, {selectedWorker.longitude.toFixed(5)}
              {selectedWorker.accuracy && ` (±${Math.round(selectedWorker.accuracy)}m)`}
            </div>
          </div>
        </div>
      )}

      <Sheet open={showList} onOpenChange={setShowList}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <span>Interventions ({geolocatedInterventions.length})</span>
              {userLocation && (
                <Badge variant="secondary" className="font-normal text-xs">
                  Par distance
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-5rem)]">
            {sortedInterventions.map((intervention) => {
              const routeInfo = routeInfos.get(intervention.id);
              return (
                <div
                  key={intervention.id}
                  className="p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
                  onClick={() => flyToIntervention(intervention)}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative"
                      style={{ backgroundColor: `${typeColors[intervention.type]}15` }}
                    >
                      <MapPin 
                        className="w-5 h-5" 
                        style={{ color: typeColors[intervention.type] }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">{intervention.ref}</span>
                        {intervention.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium truncate">{intervention.label}</h4>
                      <p className="text-sm text-muted-foreground truncate">{intervention.clientName}</p>
                      
                      {routeInfo && (
                        <div className="flex items-center gap-3 mt-1.5 p-1.5 bg-primary/10 rounded-lg w-fit">
                          <span className="text-xs text-primary font-bold flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {formatDistance(routeInfo.distance)}
                          </span>
                          <span className="text-xs text-primary/70 font-medium flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            ~{formatDuration(routeInfo.duration)}
                          </span>
                        </div>
                      )}
                      
                      {intervention.dateStart && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          📅 {format(parseISO(intervention.dateStart), "EEE d MMM 'à' HH:mm", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full mt-2 shrink-0",
                      statusConfig[intervention.status]?.color
                    )} />
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}