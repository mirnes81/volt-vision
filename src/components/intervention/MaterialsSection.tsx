import * as React from 'react';
import { Plus, Package, Trash2, WifiOff, Camera, X, ZoomIn, Loader2 } from 'lucide-react';
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
const PRODUCT_PHOTOS_CACHE_KEY = 'product_photos_cache';

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

// Product photos cache management
function getProductPhotosCache(): Record<number, string | null> {
  try {
    const stored = localStorage.getItem(PRODUCT_PHOTOS_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveProductPhotosCache(cache: Record<number, string | null>) {
  try {
    localStorage.setItem(PRODUCT_PHOTOS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[MaterialsSection] Failed to save photos cache:', e);
  }
}

// Product photo component with lazy loading
function ProductPhoto({ 
  productId, 
  src, 
  alt, 
  size = 'md',
  onPhotoLoaded
}: { 
  productId?: number;
  src?: string | null; 
  alt: string; 
  size?: 'sm' | 'md' | 'lg';
  onPhotoLoaded?: (productId: number, photo: string | null) => void;
}) {
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(src || null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  // Try to load photo if we have a productId and no photo yet
  React.useEffect(() => {
    if (src) {
      setPhotoUrl(src);
      return;
    }
    
    if (!productId || attempted || photoUrl) return;
    
    // Check cache first
    const cache = getProductPhotosCache();
    if (cache[productId] !== undefined) {
      setPhotoUrl(cache[productId]);
      setAttempted(true);
      return;
    }
    
    // Load photo on-demand
    setIsLoading(true);
    setAttempted(true);
    
    callDolibarrApi<{ productId: number; photo: string | null }>('get-product-photo', { productId })
      .then((result) => {
        setPhotoUrl(result.photo);
        // Update cache
        const newCache = getProductPhotosCache();
        newCache[productId] = result.photo;
        saveProductPhotosCache(newCache);
        onPhotoLoaded?.(productId, result.photo);
      })
      .catch((err) => {
        console.warn(`[ProductPhoto] Failed to load photo for ${productId}:`, err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [productId, src, attempted, photoUrl, onPhotoLoaded]);
  
  if (isLoading) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded-md flex items-center justify-center shrink-0`}>
        <Loader2 className="w-1/2 h-1/2 text-muted-foreground/50 animate-spin" />
      </div>
    );
  }
  
  if (!photoUrl || hasError) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded-md flex items-center justify-center shrink-0`}>
        <Package className="w-1/2 h-1/2 text-muted-foreground/50" />
      </div>
    );
  }
  
  return (
    <img
      src={photoUrl}
      alt={alt}
      className={`${sizeClasses[size]} rounded-md object-cover shrink-0 border border-border/50`}
      onError={() => setHasError(true)}
    />
  );
}

export function MaterialsSection({ intervention, onUpdate }: MaterialsSectionProps) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [productPhotos, setProductPhotos] = React.useState<Record<number, string | null>>({});
  const [showAdd, setShowAdd] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<number | null>(null);
  const [qty, setQty] = React.useState('1');
  const [comment, setComment] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(false);
  const [localMaterials, setLocalMaterials] = React.useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Photo capture state
  const [materialPhotos, setMaterialPhotos] = React.useState<MaterialPhoto[]>([]);
  const [capturingForMaterial, setCapturingForMaterial] = React.useState<number | null>(null);
  const [viewingPhoto, setViewingPhoto] = React.useState<MaterialPhoto | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load products, local materials, and photos on mount
  React.useEffect(() => {
    setIsLoadingProducts(true);
    // Load cached photos
    setProductPhotos(getProductPhotosCache());
    
    getProducts()
      .then((prods) => {
        setProducts(prods);
        console.log(`[MaterialsSection] Loaded ${prods.length} products`);
      })
      .catch(console.error)
      .finally(() => setIsLoadingProducts(false));
      
    setLocalMaterials(getLocalMaterials(intervention.id));
    setMaterialPhotos(getLocalMaterialPhotos(intervention.id));
  }, [intervention.id]);

  // Handle photo loaded callback
  const handlePhotoLoaded = React.useCallback((productId: number, photo: string | null) => {
    setProductPhotos(prev => ({ ...prev, [productId]: photo }));
  }, []);

  // Combine API materials with locally added ones, enriching with product photos
  const allMaterials = React.useMemo(() => {
    const apiMaterials = intervention.materials || [];
    const apiIds = new Set(apiMaterials.map(m => m.id));
    const uniqueLocalMaterials = localMaterials.filter(m => !apiIds.has(m.id));
    
    const enriched = [...apiMaterials, ...uniqueLocalMaterials].map(m => {
      const cachedPhoto = productPhotos[m.productId];
      const product = products.find(p => p.id === m.productId);
      return {
        ...m,
        photo: m.photo || cachedPhoto || product?.photo || null,
      };
    });
    
    return enriched;
  }, [intervention.materials, localMaterials, products, productPhotos]);

  // Filter products by search - works immediately
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.label.toLowerCase().includes(query) || 
      p.ref.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query))
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

      {/* Add Button - Compact */}
      <Button
        variant="worker"
        size="sm"
        onClick={() => setShowAdd(!showAdd)}
        className="w-full gap-2 h-10"
      >
        <Plus className="w-4 h-4" />
        Ajouter matériel
      </Button>

      {/* Add Form - Mobile Optimized */}
      {showAdd && (
        <div className="bg-card rounded-xl p-3 shadow-card border border-border/50 space-y-3 animate-slide-up">
          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Rechercher</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tapez pour rechercher..."
              className="h-10 text-sm"
            />
          </div>

          {selectedProductData && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
              <ProductPhoto 
                productId={selectedProductData.id}
                src={productPhotos[selectedProductData.id] || selectedProductData.photo} 
                alt={selectedProductData.label} 
                size="md"
                onPhotoLoaded={handlePhotoLoaded}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate text-sm">{selectedProductData.label}</p>
                <p className="text-xs text-muted-foreground">{selectedProductData.ref}</p>
              </div>
            </div>
          )}

          {/* Product selection grid with photos - Compact for mobile */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
              Produit {isLoadingProducts ? '(chargement...)' : filteredProducts.length > 0 ? `(${filteredProducts.length})` : ''}
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-secondary/30">
              {isLoadingProducts ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 mx-auto mb-1 animate-spin opacity-50" />
                  <p className="text-xs">Chargement des produits...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Package className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">
                    {products.length === 0 ? 'Aucun produit disponible' : 'Aucun produit trouvé'}
                  </p>
                  {searchQuery && (
                    <p className="text-[10px] mt-1">Essayez avec d'autres termes</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredProducts.slice(0, 50).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 text-left transition-colors active:bg-primary/10",
                        selectedProduct === product.id && "bg-primary/10 border-l-3 border-primary"
                      )}
                    >
                      <ProductPhoto 
                        productId={product.id}
                        src={productPhotos[product.id] || product.photo} 
                        alt={product.label} 
                        size="sm"
                        onPhotoLoaded={handlePhotoLoaded}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "font-medium truncate text-xs",
                          selectedProduct === product.id && "text-primary"
                        )}>
                          {product.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{product.ref}</p>
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length > 50 && (
                    <p className="text-[10px] text-center text-muted-foreground py-1.5">
                      +{filteredProducts.length - 50} autres produits
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Qté</label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-10 text-sm font-medium text-center"
                min="0.1"
                step="0.1"
              />
            </div>
            <div className="w-16">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Unité</label>
              <Input
                value={products.find(p => p.id === selectedProduct)?.unit || '-'}
                readOnly
                className="h-10 text-sm font-medium text-center bg-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Commentaire</label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Posé dans cuisine"
              className="h-10 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="worker-ghost"
              size="sm"
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
              size="sm"
              className="flex-1"
              onClick={handleAdd}
              disabled={!selectedProduct || isLoading}
            >
              {isLoading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </div>
      )}

      {/* Materials List - Mobile Optimized */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground px-1">
          Matériel posé {allMaterials.length > 0 && `(${allMaterials.length})`}
        </h4>
        {allMaterials.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-1.5 opacity-50" />
            <p className="text-xs">Aucun matériel enregistré</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allMaterials.map((material) => {
              const isLocal = localMaterials.some(m => m.id === material.id);
              const photos = getPhotosForMaterial(material.id);
              
              return (
                <div
                  key={material.id}
                  className="bg-card rounded-lg p-2 border border-border/50 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <ProductPhoto 
                      productId={material.productId}
                      src={productPhotos[material.productId] || material.photo} 
                      alt={material.productName} 
                      size="sm"
                      onPhotoLoaded={handlePhotoLoaded}
                    />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold truncate text-xs">{material.productName}</p>
                        {isLocal && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1 py-0.5 rounded shrink-0">
                            Local
                          </span>
                        )}
                      </div>
                      {material.productRef && (
                        <p className="text-[10px] text-muted-foreground">{material.productRef}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <p className="text-base font-bold text-primary">
                          {material.qtyUsed}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{material.unit}</p>
                      </div>
                      {isLocal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLocal(material.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Photos section - compact */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setViewingPhoto(photo)}
                        className="relative w-10 h-10 rounded-md overflow-hidden border border-border/50 active:border-primary"
                      >
                        <img
                          src={photo.dataUrl}
                          alt="Photo matériel"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                    
                    {/* Add photo button - compact */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCapturePhoto(material.id)}
                      className={cn(
                        "h-10 gap-1.5 border-dashed",
                        photos.length === 0 ? "flex-1" : "w-10 p-0"
                      )}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {photos.length === 0 && <span className="text-[10px]">Photo</span>}
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
