import * as React from 'react';
import { Plus, Package, Trash2, WifiOff, Camera, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Intervention, Product, Material } from '@/types/intervention';
import { getProducts } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { addPendingSync } from '@/lib/offlineStorage';
import { callDolibarrApi } from '@/lib/dolibarrApi';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MaterialsSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

// LocalStorage keys
const getMaterialsKey = (interventionId: number) => `intervention_materials_${interventionId}`;
const getMaterialPhotosKey = (interventionId: number) => `intervention_material_photos_${interventionId}`;

interface MaterialPhoto {
  id: string;
  materialId: number;
  dataUrl: string;
  timestamp: string;
  caption?: string;
}

// Get locally stored materials
function getLocalMaterials(interventionId: number): Material[] {
  try {
    const stored = localStorage.getItem(getMaterialsKey(interventionId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save materials locally
function saveLocalMaterials(interventionId: number, materials: Material[]) {
  localStorage.setItem(getMaterialsKey(interventionId), JSON.stringify(materials));
}

// Get locally stored material photos
function getLocalMaterialPhotos(interventionId: number): MaterialPhoto[] {
  try {
    const stored = localStorage.getItem(getMaterialPhotosKey(interventionId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save material photos locally
function saveMaterialPhotos(interventionId: number, photos: MaterialPhoto[]) {
  localStorage.setItem(getMaterialPhotosKey(interventionId), JSON.stringify(photos));
}

// Product photo component with fallback
function ProductPhoto({ src, alt, size = 'md' }: { src?: string | null; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const [hasError, setHasError] = React.useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  if (!src || hasError) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded-lg flex items-center justify-center shrink-0`}>
        <Package className="w-1/2 h-1/2 text-muted-foreground/50" />
      </div>
    );
  }
  
  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} rounded-lg object-cover shrink-0 border border-border/50`}
      onError={() => setHasError(true)}
    />
  );
}

export function MaterialsSection({ intervention, onUpdate }: MaterialsSectionProps) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<number | null>(null);
  const [qty, setQty] = React.useState('1');
  const [comment, setComment] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [localMaterials, setLocalMaterials] = React.useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Photo capture state
  const [materialPhotos, setMaterialPhotos] = React.useState<MaterialPhoto[]>([]);
  const [capturingForMaterial, setCapturingForMaterial] = React.useState<number | null>(null);
  const [viewingPhoto, setViewingPhoto] = React.useState<MaterialPhoto | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load products, local materials, and photos on mount
  React.useEffect(() => {
    getProducts().then(setProducts).catch(console.error);
    setLocalMaterials(getLocalMaterials(intervention.id));
    setMaterialPhotos(getLocalMaterialPhotos(intervention.id));
  }, [intervention.id]);

  // Combine API materials with locally added ones, enriching with product photos
  const allMaterials = React.useMemo(() => {
    const apiMaterials = intervention.materials || [];
    const apiIds = new Set(apiMaterials.map(m => m.id));
    const uniqueLocalMaterials = localMaterials.filter(m => !apiIds.has(m.id));
    
    const enriched = [...apiMaterials, ...uniqueLocalMaterials].map(m => {
      const product = products.find(p => p.id === m.productId);
      return {
        ...m,
        photo: m.photo || product?.photo || null,
      };
    });
    
    return enriched;
  }, [intervention.materials, localMaterials, products]);

  // Filter products by search
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.label.toLowerCase().includes(query) || 
      p.ref.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // Selected product details
  const selectedProductData = products.find(p => p.id === selectedProduct);

  const handleAdd = async () => {
    if (!selectedProduct || !qty) return;
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    setIsLoading(true);
    
    const newMaterial: Material = {
      id: Date.now(),
      productId: selectedProduct,
      productRef: product.ref,
      productName: product.label,
      qtyUsed: parseFloat(qty),
      unit: product.unit || 'pce',
      comment: comment || undefined,
      price: product.price,
      photo: product.photo || null,
    };

    try {
      const updatedLocalMaterials = [...localMaterials, newMaterial];
      setLocalMaterials(updatedLocalMaterials);
      saveLocalMaterials(intervention.id, updatedLocalMaterials);
      
      setShowAdd(false);
      setSelectedProduct(null);
      setQty('1');
      setComment('');
      setSearchQuery('');
      
      toast.success('Matériel ajouté', {
        description: `${product.label} x${qty}`,
      });

      try {
        await callDolibarrApi('add-intervention-line', {
          interventionId: intervention.id,
          productId: selectedProduct,
          qty: parseFloat(qty),
          description: comment || product.label,
        });
        console.log('[Materials] Synced with Dolibarr');
      } catch (syncError) {
        console.warn('[Materials] API sync failed, queuing for later:', syncError);
        await addPendingSync('material', intervention.id, {
          productId: selectedProduct,
          qtyUsed: parseFloat(qty),
          comment: comment || undefined,
        });
        toast.info('Enregistré localement', {
          description: 'Sera synchronisé automatiquement',
          icon: <WifiOff className="w-4 h-4" />,
        });
      }

      onUpdate();
    } catch (error) {
      console.error('[Materials] Error adding material:', error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLocal = (materialId: number) => {
    const updatedMaterials = localMaterials.filter(m => m.id !== materialId);
    setLocalMaterials(updatedMaterials);
    saveLocalMaterials(intervention.id, updatedMaterials);
    
    const updatedPhotos = materialPhotos.filter(p => p.materialId !== materialId);
    setMaterialPhotos(updatedPhotos);
    saveMaterialPhotos(intervention.id, updatedPhotos);
    
    toast.success('Matériel supprimé');
  };

  // Handle photo capture for a material
  const handleCapturePhoto = (materialId: number) => {
    setCapturingForMaterial(materialId);
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || capturingForMaterial === null) return;

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        
        const newPhoto: MaterialPhoto = {
          id: `photo_${Date.now()}`,
          materialId: capturingForMaterial,
          dataUrl,
          timestamp: new Date().toISOString(),
        };
        
        const updatedPhotos = [...materialPhotos, newPhoto];
        setMaterialPhotos(updatedPhotos);
        saveMaterialPhotos(intervention.id, updatedPhotos);
        
        toast.success('Photo ajoutée au matériel');
        
        setCapturingForMaterial(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[Materials] Error capturing photo:', error);
      toast.error('Erreur lors de la capture');
      setCapturingForMaterial(null);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    const updatedPhotos = materialPhotos.filter(p => p.id !== photoId);
    setMaterialPhotos(updatedPhotos);
    saveMaterialPhotos(intervention.id, updatedPhotos);
    setViewingPhoto(null);
    toast.success('Photo supprimée');
  };

  // Get photos for a specific material
  const getPhotosForMaterial = (materialId: number) => {
    return materialPhotos.filter(p => p.materialId === materialId);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoChange}
        className="hidden"
      />

      {/* Add Button */}
      <Button
        variant="worker"
        size="full"
        onClick={() => setShowAdd(!showAdd)}
        className="gap-3"
      >
        <Plus className="w-5 h-5" />
        Ajouter du matériel
      </Button>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 space-y-4 animate-slide-up">
          <div>
            <label className="text-sm font-medium mb-2 block">Rechercher un produit</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tapez pour rechercher..."
              className="h-12 text-base"
            />
          </div>

          {selectedProductData && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <ProductPhoto src={selectedProductData.photo} alt={selectedProductData.label} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{selectedProductData.label}</p>
                <p className="text-sm text-muted-foreground">{selectedProductData.ref}</p>
                {selectedProductData.price && (
                  <p className="text-xs text-primary font-medium">{selectedProductData.price.toFixed(2)} CHF</p>
                )}
              </div>
            </div>
          )}

          {/* Product selection grid with photos */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Produit {filteredProducts.length > 0 && `(${filteredProducts.length})`}
            </label>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 bg-secondary/30">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun produit trouvé</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredProducts.slice(0, 50).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-primary/5",
                        selectedProduct === product.id && "bg-primary/10 border-l-4 border-primary"
                      )}
                    >
                      <ProductPhoto src={product.photo} alt={product.label} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "font-medium truncate text-sm",
                          selectedProduct === product.id && "text-primary"
                        )}>
                          {product.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{product.ref}</p>
                      </div>
                      {product.price && (
                        <span className="text-xs font-semibold text-primary shrink-0">
                          {product.price.toFixed(2)} CHF
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredProducts.length > 50 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{filteredProducts.length - 50} autres produits, affinez votre recherche
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Quantité</label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-14 text-base font-medium text-center"
                min="0.1"
                step="0.1"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Unité</label>
              <Input
                value={products.find(p => p.id === selectedProduct)?.unit || '-'}
                readOnly
                className="h-14 text-base font-medium text-center bg-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Commentaire (optionnel)</label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Posé dans cuisine"
              className="h-14 text-base"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="worker-ghost"
              className="flex-1"
              onClick={() => {
                setShowAdd(false);
                setSearchQuery('');
                setSelectedProduct(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="worker"
              className="flex-1"
              onClick={handleAdd}
              disabled={!selectedProduct || isLoading}
            >
              {isLoading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </div>
      )}

      {/* Materials List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground px-1">
          Matériel posé {allMaterials.length > 0 && `(${allMaterials.length})`}
        </h4>
        {allMaterials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun matériel enregistré</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allMaterials.map((material) => {
              const isLocal = localMaterials.some(m => m.id === material.id);
              const photos = getPhotosForMaterial(material.id);
              
              return (
                <div
                  key={material.id}
                  className="bg-card rounded-xl p-3 border border-border/50 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <ProductPhoto src={material.photo} alt={material.productName} size="md" />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate text-sm">{material.productName}</p>
                        {isLocal && (
                          <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                            Local
                          </span>
                        )}
                      </div>
                      {material.productRef && (
                        <p className="text-xs text-muted-foreground">{material.productRef}</p>
                      )}
                      {material.comment && (
                        <p className="text-xs text-muted-foreground truncate">{material.comment}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {material.qtyUsed}
                        </p>
                        <p className="text-xs text-muted-foreground">{material.unit}</p>
                      </div>
                      {isLocal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLocal(material.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Photos section for this material */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                    {/* Photo thumbnails */}
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setViewingPhoto(photo)}
                        className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/50 hover:border-primary transition-colors"
                      >
                        <img
                          src={photo.dataUrl}
                          alt="Photo matériel"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white opacity-0 hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                    
                    {/* Add photo button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCapturePhoto(material.id)}
                      className={cn(
                        "h-12 gap-2 border-dashed",
                        photos.length === 0 ? "flex-1" : "w-12 p-0"
                      )}
                    >
                      <Camera className="w-4 h-4" />
                      {photos.length === 0 && <span className="text-xs">Prendre photo</span>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Photo du matériel</span>
            </DialogTitle>
          </DialogHeader>
          {viewingPhoto && (
            <div className="relative">
              <img
                src={viewingPhoto.dataUrl}
                alt="Photo matériel"
                className="w-full max-h-[60vh] object-contain"
              />
              <div className="p-4 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {new Date(viewingPhoto.timestamp).toLocaleString('fr-CH')}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePhoto(viewingPhoto.id)}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
