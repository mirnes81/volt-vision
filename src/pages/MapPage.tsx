import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mockInterventions } from '@/lib/mockData';
import { Intervention } from '@/types/intervention';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Map as MapIcon, 
  Navigation, 
  List, 
  Locate,
  Layers,
  X,
  Clock,
  MapPin,
  AlertTriangle,
  Loader2,
  Route,
  Car,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

const typeColors: Record<string, string> = {
  installation: '#10B981',
  depannage: '#EF4444',
  renovation: '#8B5CF6',
  tableau: '#F59E0B',
  cuisine: '#EC4899',
  oibt: '#3B82F6',
};

const priorityIcons = {
  normal: null,
  urgent: <AlertTriangle className="w-3 h-3 text-orange-500" />,
  critical: <AlertTriangle className="w-3 h-3 text-red-500" />,
};

const statusConfig: Record<string, { label: string; color: string }> = {
  a_planifier: { label: 'À planifier', color: 'bg-yellow-500' },
  en_cours: { label: 'En cours', color: 'bg-blue-500' },
  termine: { label: 'Terminé', color: 'bg-green-500' },
  facture: { label: 'Facturé', color: 'bg-purple-500' },
};

interface RouteInfo {
  interventionId: number;
  distance: number; // in km
  duration: number; // in minutes
  geometry?: GeoJSON.LineString;
}

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate driving time (avg 40km/h in city)
function estimateDuration(distanceKm: number): number {
  return Math.round(distanceKm / 40 * 60);
}

export default function MapPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourceRef = useRef<boolean>(false);
  
  const [mapboxToken, setMapboxToken] = useState<string>(() => 
    localStorage.getItem('mapbox_token') || ''
  );
  const [showTokenInput, setShowTokenInput] = useState(!localStorage.getItem('mapbox_token'));
  const [interventions] = useState<Intervention[]>(mockInterventions);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [showList, setShowList] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [routeInfos, setRouteInfos] = useState<Map<number, RouteInfo>>(new Map());
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const filteredInterventions = filterStatus
    ? interventions.filter(i => i.status === filterStatus)
    : interventions;

  const geolocatedInterventions = filteredInterventions.filter(i => i.coordinates);

  // Sort by distance if user location available
  const sortedInterventions = [...geolocatedInterventions].sort((a, b) => {
    const infoA = routeInfos.get(a.id);
    const infoB = routeInfos.get(b.id);
    if (infoA && infoB) return infoA.distance - infoB.distance;
    if (infoA) return -1;
    if (infoB) return 1;
    return 0;
  });

  const saveToken = () => {
    localStorage.setItem('mapbox_token', mapboxToken);
    setShowTokenInput(false);
    window.location.reload();
  };

  // Calculate distances for all interventions
  const calculateDistances = useCallback((userLat: number, userLng: number) => {
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

  // Fetch route from Mapbox Directions API
  const fetchRoute = useCallback(async (
    fromLng: number, fromLat: number,
    toLng: number, toLat: number,
    interventionId: number
  ) => {
    if (!mapboxToken) return null;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&access_token=${mapboxToken}`
      );
      
      if (!response.ok) throw new Error('Route fetch failed');
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          interventionId,
          distance: Math.round(route.distance / 100) / 10, // m to km
          duration: Math.round(route.duration / 60), // s to min
          geometry: route.geometry as GeoJSON.LineString
        };
      }
    } catch (error) {
      console.error('Route calculation error:', error);
    }
    return null;
  }, [mapboxToken]);

  // Show route on map
  const showRouteOnMap = useCallback((routeInfo: RouteInfo) => {
    if (!map.current || !routeInfo.geometry) return;

    // Remove existing route
    if (map.current.getSource('route')) {
      map.current.removeLayer('route-line');
      map.current.removeSource('route');
    }

    // Add route source and layer
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: routeInfo.geometry
      }
    });

    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3B82F6',
        'line-width': 5,
        'line-opacity': 0.8
      }
    });

    routeSourceRef.current = true;
    setActiveRoute(routeInfo);
  }, []);

  // Clear route from map
  const clearRoute = useCallback(() => {
    if (map.current && routeSourceRef.current) {
      if (map.current.getLayer('route-line')) {
        map.current.removeLayer('route-line');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
      routeSourceRef.current = false;
    }
    setActiveRoute(null);
  }, []);

  // Calculate and show route to intervention
  const calculateAndShowRoute = useCallback(async (intervention: Intervention) => {
    if (!userLocation || !intervention.coordinates) {
      toast.error('Position non disponible');
      return;
    }

    setIsCalculatingRoute(true);
    
    const routeInfo = await fetchRoute(
      userLocation.lng, userLocation.lat,
      intervention.coordinates.lng, intervention.coordinates.lat,
      intervention.id
    );

    if (routeInfo) {
      showRouteOnMap(routeInfo);
      
      // Fit map to show entire route
      if (map.current && routeInfo.geometry) {
        const bounds = new mapboxgl.LngLatBounds();
        routeInfo.geometry.coordinates.forEach(coord => {
          bounds.extend(coord as [number, number]);
        });
        map.current.fitBounds(bounds, { padding: 80 });
      }
      
      toast.success(`Itinéraire: ${routeInfo.distance} km • ${routeInfo.duration} min`);
    } else {
      toast.error('Impossible de calculer l\'itinéraire');
    }
    
    setIsCalculatingRoute(false);
  }, [userLocation, fetchRoute, showRouteOnMap]);

  // Start continuous location tracking
  const startLocationTracking = useCallback(() => {
    if (watchId !== null) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setUserLocation(newLocation);
        calculateDistances(latitude, longitude);

        // Update user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
      },
      (error) => console.error('Watch position error:', error),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    setWatchId(id);
  }, [watchId, calculateDistances]);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  useEffect(() => {
    if (!mapContainer.current || showTokenInput || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle === 'streets' 
          ? 'mapbox://styles/mapbox/light-v11'
          : 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [6.1432, 46.2044],
        zoom: 11,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      map.current.on('load', () => {
        addMarkers();
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setShowTokenInput(true);
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      userMarkerRef.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, showTokenInput, mapStyle]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      routeSourceRef.current = false;
      addMarkers();
    }
  }, [filteredInterventions, mapStyle]);

  const addMarkers = () => {
    if (!map.current) return;

    geolocatedInterventions.forEach(intervention => {
      if (!intervention.coordinates) return;

      const routeInfo = routeInfos.get(intervention.id);
      
      const el = document.createElement('div');
      el.className = 'intervention-marker';
      el.innerHTML = `
        <div style="position: relative;">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: ${typeColors[intervention.type] || '#6366F1'};
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          ${intervention.priority === 'urgent' ? `
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 16px;
              height: 16px;
              background: #EF4444;
              border-radius: 50%;
              border: 2px solid white;
              animation: pulse 2s infinite;
            "></div>
          ` : ''}
          ${routeInfo ? `
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              background: white;
              padding: 2px 6px;
              border-radius: 8px;
              font-size: 10px;
              font-weight: 600;
              color: #374151;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              white-space: nowrap;
            ">${routeInfo.distance} km</div>
          ` : ''}
        </div>
      `;

      el.addEventListener('mouseenter', () => {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) inner.style.transform = 'scale(1.1)';
      });
      el.addEventListener('mouseleave', () => {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) inner.style.transform = 'scale(1)';
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([intervention.coordinates.lng, intervention.coordinates.lat])
        .addTo(map.current!);

      el.addEventListener('click', () => {
        setSelectedIntervention(intervention);
        map.current?.flyTo({
          center: [intervention.coordinates!.lng, intervention.coordinates!.lat],
          zoom: 14,
          duration: 1000,
        });
      });

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (geolocatedInterventions.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      geolocatedInterventions.forEach(i => {
        if (i.coordinates) {
          bounds.extend([i.coordinates.lng, i.coordinates.lat]);
        }
      });
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      map.current?.fitBounds(bounds, { padding: 60 });
    }
  };

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        calculateDistances(latitude, longitude);
        
        if (map.current) {
          // Remove existing user marker
          userMarkerRef.current?.remove();

          // Add user marker
          const userEl = document.createElement('div');
          userEl.innerHTML = `
            <div style="position: relative;">
              <div style="
                width: 24px;
                height: 24px;
                background: #3B82F6;
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3), 0 4px 8px rgba(0,0,0,0.2);
              "></div>
              <div style="
                position: absolute;
                top: -2px;
                left: -2px;
                width: 28px;
                height: 28px;
                border: 2px solid rgba(59, 130, 246, 0.5);
                border-radius: 50%;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
            </div>
          `;
          
          userMarkerRef.current = new mapboxgl.Marker(userEl)
            .setLngLat([longitude, latitude])
            .addTo(map.current);

          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 13,
            duration: 1500,
          });

          // Start continuous tracking
          startLocationTracking();
        }
        
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

  const toggleMapStyle = () => {
    clearRoute();
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets');
  };

  const flyToIntervention = (intervention: Intervention) => {
    if (intervention.coordinates && map.current) {
      setSelectedIntervention(intervention);
      setShowList(false);
      map.current.flyTo({
        center: [intervention.coordinates.lng, intervention.coordinates.lat],
        zoom: 15,
        duration: 1200,
      });
    }
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

  if (showTokenInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-4">
        <MapIcon className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-center">Configuration Mapbox</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Pour afficher la carte, entrez votre token Mapbox public. 
          Vous pouvez l'obtenir sur <a href="https://mapbox.com" target="_blank" rel="noopener" className="text-primary underline">mapbox.com</a>
        </p>
        <div className="flex gap-2 w-full max-w-md">
          <Input
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            placeholder="pk.eyJ1..."
            className="flex-1"
          />
          <Button onClick={saveToken} disabled={!mapboxToken}>
            Enregistrer
          </Button>
        </div>
      </div>
    );
  }

  const selectedRouteInfo = selectedIntervention ? routeInfos.get(selectedIntervention.id) : null;

  return (
    <div className="relative h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] -mx-4 -mt-4 lg:mx-0 lg:mt-0 lg:rounded-xl overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          className="bg-background/95 backdrop-blur shadow-lg"
          onClick={() => setShowList(true)}
        >
          <List className="w-4 h-4 mr-2" />
          Liste ({geolocatedInterventions.length})
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

      {/* Active Route Info */}
      {activeRoute && (
        <div className="absolute top-16 left-4 z-10 bg-primary text-primary-foreground rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
          <Route className="w-5 h-5" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Car className="w-4 h-4" />
              <span className="font-semibold">{formatDistance(activeRoute.distance)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Timer className="w-4 h-4" />
              <span className="font-semibold">{formatDuration(activeRoute.duration)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={clearRoute}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute bottom-24 lg:bottom-8 right-4 z-10 flex flex-col gap-2">
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
        <Button
          variant="secondary"
          size="icon"
          className="bg-background/95 backdrop-blur shadow-lg h-12 w-12"
          onClick={toggleMapStyle}
        >
          <Layers className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend with distances */}
      <div className="absolute bottom-24 lg:bottom-8 left-4 z-10 bg-background/95 backdrop-blur rounded-lg shadow-lg p-3 max-w-[200px]">
        <p className="text-xs font-medium mb-2">Types</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs capitalize truncate">{type}</span>
            </div>
          ))}
        </div>
        {userLocation && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {watchId ? '📍 Suivi actif' : '📍 Position connue'}
            </p>
          </div>
        )}
      </div>

      {/* Selected Intervention Card */}
      {selectedIntervention && (
        <div className="absolute bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-md">
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
                {priorityIcons[selectedIntervention.priority]}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-2"
                onClick={() => {
                  setSelectedIntervention(null);
                  clearRoute();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <h3 className="font-semibold mb-1">{selectedIntervention.label}</h3>
            <p className="text-sm text-muted-foreground mb-2">{selectedIntervention.clientName}</p>

            {/* Distance & Duration */}
            {selectedRouteInfo && (
              <div className="flex items-center gap-4 mb-3 p-2 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">{formatDistance(selectedRouteInfo.distance)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">{formatDuration(selectedRouteInfo.duration)}</span>
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
                  {format(parseISO(selectedIntervention.dateStart), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              {userLocation ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => calculateAndShowRoute(selectedIntervention)}
                  disabled={isCalculatingRoute}
                >
                  {isCalculatingRoute ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Route className="w-4 h-4 mr-2" />
                  )}
                  Itinéraire
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const addr = encodeURIComponent(selectedIntervention.location);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Maps
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/intervention/${selectedIntervention.id}`)}
              >
                Voir détails
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* List Sheet */}
      <Sheet open={showList} onOpenChange={setShowList}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <span>Interventions ({geolocatedInterventions.length})</span>
              {userLocation && (
                <Badge variant="secondary" className="font-normal">
                  Triées par distance
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
                  className="p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => flyToIntervention(intervention)}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative"
                      style={{ backgroundColor: `${typeColors[intervention.type]}20` }}
                    >
                      <MapPin 
                        className="w-5 h-5" 
                        style={{ color: typeColors[intervention.type] }}
                      />
                      {routeInfo && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-background px-1.5 py-0.5 rounded text-[10px] font-semibold shadow border">
                          {formatDistance(routeInfo.distance)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">{intervention.ref}</span>
                        {intervention.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium truncate">{intervention.label}</h4>
                      <p className="text-sm text-muted-foreground truncate">{intervention.clientName}</p>
                      
                      {routeInfo && (
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {formatDistance(routeInfo.distance)}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatDuration(routeInfo.duration)}
                          </span>
                        </div>
                      )}
                      
                      {intervention.dateStart && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(intervention.dateStart), "d MMM 'à' HH:mm", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 shrink-0",
                      statusConfig[intervention.status]?.color
                    )} />
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Custom styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}