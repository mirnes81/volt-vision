import * as React from 'react';
import { Camera, ImagePlus, X, WifiOff, CloudOff, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { uploadPhoto } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface PhotosSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

type PhotoType = 'avant' | 'pendant' | 'apres' | 'defaut';

const photoTypes: { value: PhotoType; label: string; color: string }[] = [
  { value: 'avant', label: 'Avant', color: 'bg-blue-500' },
  { value: 'pendant', label: 'Pendant', color: 'bg-warning' },
  { value: 'apres', label: 'Après', color: 'bg-success' },
  { value: 'defaut', label: 'Défaut', color: 'bg-destructive' },
];

interface CloudPhoto {
  id: string;
  type: PhotoType;
  filePath: string;
  datePhoto: string;
  isCloud: boolean;
}

export function PhotosSection({ intervention, onUpdate }: PhotosSectionProps) {
  const [selectedType, setSelectedType] = React.useState<PhotoType>('pendant');
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [offlinePhotos, setOfflinePhotos] = React.useState<Array<{ id: number; type: PhotoType; filePath: string }>>([]);
  const [cloudPhotos, setCloudPhotos] = React.useState<CloudPhoto[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load photos from Supabase Storage
  React.useEffect(() => {
    loadCloudPhotos();
  }, [intervention.id]);

  async function loadCloudPhotos() {
    try {
      const { data, error } = await (supabase
        .from('intervention_photos' as any)
        .select('*')
        .eq('intervention_id', intervention.id)
        .order('created_at', { ascending: false }) as any);
      
      if (error) throw error;
      
      if (data && Array.isArray(data)) {
        setCloudPhotos(data.map((p: any) => ({
          id: p.id,
          type: p.photo_type as PhotoType,
          filePath: p.public_url,
          datePhoto: p.created_at,
          isCloud: true,
        })));
      }
    } catch (err) {
      console.warn('[PhotosSection] Could not load cloud photos:', err);
    }
  }


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setIsLoading(true);
    try {
      const result = await uploadPhoto(intervention.id, file, selectedType);
      
      if (result.offline) {
        // Store locally for display
        setOfflinePhotos(prev => [...prev, {
          id: result.id,
          type: selectedType,
          filePath: result.filePath,
        }]);
        toast.success('Photo sauvegardée hors-ligne', {
          description: 'Connexion requise pour la sauvegarder',
          icon: <WifiOff className="w-4 h-4" />,
        });
      } else {
        toast.success('Photo sauvegardée ✓', {
          description: 'Stockée dans le cloud',
          icon: <Cloud className="w-4 h-4" />,
        });
        // Reload cloud photos to show the new one
        await loadCloudPhotos();
      }
      onUpdate();
    } catch (error) {
      console.error('[PhotosSection] Upload error:', error);
      toast.error('Erreur lors de l\'upload de la photo', {
        description: 'Vérifiez votre connexion et réessayez',
      });
    } finally {
      setIsLoading(false);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Combine: cloud photos + dolibarr photos + offline photos
  const allPhotos = [
    ...cloudPhotos,
    ...intervention.photos.filter(p => 
      !cloudPhotos.some(cp => cp.filePath === p.filePath)
    ),
    ...offlinePhotos.map(p => ({ ...p, datePhoto: new Date().toISOString(), isOffline: true })),
  ];

  const groupedPhotos = photoTypes.map(type => ({
    ...type,
    photos: allPhotos.filter(p => p.type === type.value),
  }));

  return (
    <div className="space-y-3">
      {/* Type Selection - Compact */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {photoTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-200 active:scale-95",
              selectedType === type.value
                ? `${type.color} text-white font-semibold shadow-md`
                : "bg-secondary text-muted-foreground"
            )}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              selectedType === type.value ? "bg-white" : type.color
            )} />
            <span className="text-xs">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Camera Button - Compact */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <Button
        variant="worker"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="w-full gap-2 h-10"
      >
        <Camera className="w-4 h-4" />
        Photo ({photoTypes.find(t => t.value === selectedType)?.label})
      </Button>

      {/* Preview - Compact */}
      {previewUrl && (
        <div className="relative rounded-xl overflow-hidden animate-scale-in">
          <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Photos Gallery - Compact */}
      <div className="space-y-3">
        {groupedPhotos.map((group) => (
          group.photos.length > 0 && (
            <div key={group.value}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={cn("w-2 h-2 rounded-full", group.color)} />
                <h4 className="text-xs font-semibold">{group.label}</h4>
                <span className="text-[10px] text-muted-foreground">({group.photos.length})</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {group.photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="aspect-square rounded-lg overflow-hidden bg-secondary relative"
                  >
                    <img 
                      src={photo.filePath} 
                      alt={`Photo ${group.label}`}
                      className="w-full h-full object-cover"
                    />
                    {'isOffline' in photo && photo.isOffline && (
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-0.5 right-0.5 bg-warning/90 text-warning-foreground text-[8px] px-0.5 py-0 gap-0"
                      >
                        <CloudOff className="w-2 h-2" />
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        
        {allPhotos.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <ImagePlus className="w-8 h-8 mx-auto mb-1 opacity-50" />
            <p className="text-xs">Aucune photo</p>
          </div>
        )}
      </div>
    </div>
  );
}
