import { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/sonner';

interface GPSSectionProps {
  intervention: Intervention;
}

interface Coordinates {
  lat: number;
  lng: number;
}

export function GPSSection({ intervention }: GPSSectionProps) {
  const { t } = useLanguage();
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distance, setDistance] = useState<string | null>(null);

  const getCurrentLocation = () => {
    setIsLoading(true);
    
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(coords);
        setIsLoading(false);
        toast.success('Position obtenue');
        
        // Calculate approximate distance (simplified)
        // In real app, use Google Maps Distance Matrix API
        setDistance('~5.2 km');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Impossible d\'obtenir la position');
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const openInMaps = (app: 'google' | 'apple' | 'waze') => {
    const address = encodeURIComponent(intervention.location);
    let url = '';
    
    switch (app) {
      case 'google':
        url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
        break;
      case 'apple':
        url = `http://maps.apple.com/?daddr=${address}`;
        break;
      case 'waze':
        url = `https://waze.com/ul?q=${address}&navigate=yes`;
        break;
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Destination */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Destination</p>
            <p className="font-semibold">{intervention.location}</p>
            <p className="text-sm text-muted-foreground">{intervention.clientName}</p>
          </div>
        </div>

        {distance && (
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
            <Compass className="w-5 h-5 text-primary" />
            <span className="font-medium">{t('gps.distance')}: {distance}</span>
          </div>
        )}
      </div>

      {/* Current Location */}
      <Button
        variant="worker-outline"
        size="full"
        onClick={getCurrentLocation}
        disabled={isLoading}
        className="gap-3"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Navigation className="w-5 h-5" />
        )}
        {t('gps.getLocation')}
      </Button>

      {currentLocation && (
        <div className="bg-success/10 rounded-xl p-3 text-sm">
          <p className="font-medium text-success">Position actuelle:</p>
          <p className="text-muted-foreground">
            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* Navigation Options */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground">{t('gps.openMaps')}</h4>
        
        <Button
          variant="worker"
          size="full"
          onClick={() => openInMaps('google')}
          className="gap-3"
        >
          <ExternalLink className="w-5 h-5" />
          Google Maps
        </Button>
        
        <Button
          variant="worker-ghost"
          size="full"
          onClick={() => openInMaps('waze')}
          className="gap-3"
        >
          <ExternalLink className="w-5 h-5" />
          Waze
        </Button>
        
        <Button
          variant="worker-ghost"
          size="full"
          onClick={() => openInMaps('apple')}
          className="gap-3"
        >
          <ExternalLink className="w-5 h-5" />
          Apple Maps
        </Button>
      </div>
    </div>
  );
}
