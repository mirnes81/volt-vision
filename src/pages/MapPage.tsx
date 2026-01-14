import { useEffect, useRef, useState } from 'react';
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
  Filter,
  Locate,
  Layers,
  X,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2
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

const MAPBOX_TOKEN = 'pk.eyJ1IjoibG92YWJsZS1kZW1vIiwiYSI6ImNtNXFjNHZxeTBmenkycHIyOXlkMnRvNWsifQ.example';

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

const statusConfig = {
  a_planifier: { label: 'À planifier', color: 'bg-yellow-500' },
  en_cours: { label: 'En cours', color: 'bg-blue-500' },
  termine: { label: 'Terminé', color: 'bg-green-500' },
  facture: { label: 'Facturé', color: 'bg-purple-500' },
};

export default function MapPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
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

  const filteredInterventions = filterStatus
    ? interventions.filter(i => i.status === filterStatus)
    : interventions;

  const geolocatedInterventions = filteredInterventions.filter(i => i.coordinates);

  const saveToken = () => {
    localStorage.setItem('mapbox_token', mapboxToken);
    setShowTokenInput(false);
    window.location.reload();
  };

  useEffect(() => {
    if (!mapContainer.current || showTokenInput || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle === 'streets' 
          ? 'mapbox://styles/mapbox/light-v11'
          : 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [6.1432, 46.2044], // Geneva center
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
      map.current?.remove();
    };
  }, [mapboxToken, showTokenInput, mapStyle]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      addMarkers();
    }
  }, [filteredInterventions, mapStyle]);

  const addMarkers = () => {
    if (!map.current) return;

    geolocatedInterventions.forEach(intervention => {
      if (!intervention.coordinates) return;

      const el = document.createElement('div');
      el.className = 'intervention-marker';
      el.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
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
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.1)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
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

    // Fit bounds to show all markers
    if (geolocatedInterventions.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      geolocatedInterventions.forEach(i => {
        if (i.coordinates) {
          bounds.extend([i.coordinates.lng, i.coordinates.lat]);
        }
      });
      map.current?.fitBounds(bounds, { padding: 60 });
    }
  };

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        if (map.current) {
          // Add user marker
          const userEl = document.createElement('div');
          userEl.innerHTML = `
            <div style="
              width: 20px;
              height: 20px;
              background: #3B82F6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
            "></div>
          `;
          
          new mapboxgl.Marker(userEl)
            .setLngLat([longitude, latitude])
            .addTo(map.current);

          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 13,
            duration: 1500,
          });
        }
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const toggleMapStyle = () => {
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

  return (
    <div className="relative h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] -mx-4 -mt-4 lg:mx-0 lg:mt-0 lg:rounded-xl overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
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

      {/* Map Controls */}
      <div className="absolute bottom-24 lg:bottom-8 right-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="bg-background/95 backdrop-blur shadow-lg h-10 w-10"
          onClick={locateUser}
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Locate className="w-5 h-5" />
          )}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-background/95 backdrop-blur shadow-lg h-10 w-10"
          onClick={toggleMapStyle}
        >
          <Layers className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-24 lg:bottom-8 left-4 z-10 bg-background/95 backdrop-blur rounded-lg shadow-lg p-3">
        <p className="text-xs font-medium mb-2">Types</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs capitalize">{type}</span>
            </div>
          ))}
        </div>
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
                onClick={() => setSelectedIntervention(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <h3 className="font-semibold mb-1">{selectedIntervention.label}</h3>
            <p className="text-sm text-muted-foreground mb-3">{selectedIntervention.clientName}</p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{selectedIntervention.location}</span>
              </div>
            </div>

            {selectedIntervention.dateStart && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                <Clock className="w-4 h-4" />
                <span>
                  {format(parseISO(selectedIntervention.dateStart), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (selectedIntervention.coordinates) {
                    const addr = encodeURIComponent(selectedIntervention.location);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
                  }
                }}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Itinéraire
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/interventions/${selectedIntervention.id}`)}
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
            <SheetTitle>Interventions ({geolocatedInterventions.length})</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-5rem)]">
            {geolocatedInterventions.map((intervention) => (
              <div
                key={intervention.id}
                className="p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => flyToIntervention(intervention)}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${typeColors[intervention.type]}20` }}
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
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium truncate">{intervention.label}</h4>
                    <p className="text-sm text-muted-foreground truncate">{intervention.clientName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{intervention.location}</p>
                    {intervention.dateStart && (
                      <p className="text-xs text-primary mt-1">
                        {format(parseISO(intervention.dateStart), "d MMM 'à' HH:mm", { locale: fr })}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2",
                    statusConfig[intervention.status]?.color
                  )} />
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Custom styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}