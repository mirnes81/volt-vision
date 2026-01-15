import { useState, useRef } from 'react';
import { Camera, ImagePlus, X, WifiOff, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { uploadPhoto } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

export function PhotosSection({ intervention, onUpdate }: PhotosSectionProps) {
  const [selectedType, setSelectedType] = useState<PhotoType>('pendant');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [offlinePhotos, setOfflinePhotos] = useState<Array<{ id: number; type: PhotoType; filePath: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          description: 'Elle sera synchronisée au retour de la connexion',
          icon: <WifiOff className="w-4 h-4" />,
        });
      } else {
        toast.success('Photo ajoutée');
      }
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsLoading(false);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Combine server photos with offline photos
  const allPhotos = [
    ...intervention.photos,
    ...offlinePhotos.map(p => ({ ...p, datePhoto: new Date().toISOString(), isOffline: true })),
  ];

  const groupedPhotos = photoTypes.map(type => ({
    ...type,
    photos: allPhotos.filter(p => p.type === type.value),
  }));

  return (
    <div className="space-y-4">
      {/* Type Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {photoTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 btn-press",
              selectedType === type.value
                ? `${type.color} text-white font-semibold shadow-md`
                : "bg-secondary text-muted-foreground"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full",
              selectedType === type.value ? "bg-white" : type.color
            )} />
            {type.label}
          </button>
        ))}
      </div>

      {/* Camera Button */}
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
        size="full"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="gap-3"
      >
        <Camera className="w-6 h-6" />
        Prendre une photo ({photoTypes.find(t => t.value === selectedType)?.label})
      </Button>

      {/* Preview */}
      {previewUrl && (
        <div className="relative rounded-2xl overflow-hidden animate-scale-in">
          <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Photos Gallery */}
      <div className="space-y-4">
        {groupedPhotos.map((group) => (
          group.photos.length > 0 && (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-3 h-3 rounded-full", group.color)} />
                <h4 className="text-sm font-semibold">{group.label}</h4>
                <span className="text-xs text-muted-foreground">({group.photos.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {group.photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="aspect-square rounded-xl overflow-hidden bg-secondary relative"
                  >
                    <img 
                      src={photo.filePath} 
                      alt={`Photo ${group.label}`}
                      className="w-full h-full object-cover"
                    />
                    {'isOffline' in photo && photo.isOffline && (
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-1 right-1 bg-warning/90 text-warning-foreground text-[10px] px-1 py-0 gap-0.5"
                      >
                        <CloudOff className="w-2.5 h-2.5" />
                        <span className="sr-only">Hors-ligne</span>
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        
        {intervention.photos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImagePlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune photo</p>
          </div>
        )}
      </div>
    </div>
  );
}
