import * as React from 'react';
import { Plus, Package, Trash2, WifiOff, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Intervention, Product, Material } from '@/types/intervention';
import { getProducts } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { addPendingSync } from '@/lib/offlineStorage';
import { callDolibarrApi } from '@/lib/dolibarrApi';

interface MaterialsSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

// LocalStorage key for materials
const getMaterialsKey = (interventionId: number) => `intervention_materials_${interventionId}`;

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

  // Load products and local materials on mount
  React.useEffect(() => {
    getProducts().then(setProducts).catch(console.error);
    setLocalMaterials(getLocalMaterials(intervention.id));
  }, [intervention.id]);

  // Combine API materials with locally added ones, enriching with product photos
  const allMaterials = React.useMemo(() => {
    const apiMaterials = intervention.materials || [];
    const apiIds = new Set(apiMaterials.map(m => m.id));
    // Only add local materials that don't exist in API response
    const uniqueLocalMaterials = localMaterials.filter(m => !apiIds.has(m.id));
    
    // Enrich materials with product photos from the products list
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
    
    // Create local material object for immediate feedback
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
      // Save locally first (immediate feedback)
      const updatedLocalMaterials = [...localMaterials, newMaterial];
      setLocalMaterials(updatedLocalMaterials);
      saveLocalMaterials(intervention.id, updatedLocalMaterials);
      
      // Reset form immediately for good UX
      setShowAdd(false);
      setSelectedProduct(null);
      setQty('1');
      setComment('');
      setSearchQuery('');
      
      toast.success('Matériel ajouté', {
        description: `${product.label} x${qty}`,
      });

      // Try to sync with Dolibarr in background
      try {
        await callDolibarrApi('add-intervention-line', {
          interventionId: intervention.id,
          productId: selectedProduct,
          qty: parseFloat(qty),
          description: comment || product.label,
        });
        
        // Mark as synced (optional: you could add a sync status field)
        console.log('[Materials] Synced with Dolibarr');
      } catch (syncError) {
        console.warn('[Materials] API sync failed, queuing for later:', syncError);
        
        // Queue for offline sync
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
    toast.success('Matériel supprimé');
  };

  return (
    <div className="space-y-4">
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
          {/* Search Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Rechercher un produit</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tapez pour rechercher..."
              className="h-12 text-base"
            />
          </div>

          {/* Selected Product Preview */}
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

          {/* Product Select */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Produit {filteredProducts.length > 0 && `(${filteredProducts.length})`}
            </label>
            <select
              value={selectedProduct || ''}
              onChange={(e) => setSelectedProduct(Number(e.target.value) || null)}
              className="w-full h-14 px-4 bg-secondary rounded-xl text-base font-medium border-0 focus:ring-2 focus:ring-primary"
            >
              <option value="">Sélectionner un produit</option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.ref} - {product.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit */}
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

          {/* Comment */}
          <div>
            <label className="text-sm font-medium mb-2 block">Commentaire (optionnel)</label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Posé dans cuisine"
              className="h-14 text-base"
            />
          </div>

          {/* Buttons */}
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
          <div className="space-y-2">
            {allMaterials.map((material) => {
              const isLocal = localMaterials.some(m => m.id === material.id);
              
              return (
                <div
                  key={material.id}
                  className="bg-card rounded-xl p-3 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    {/* Product Photo */}
                    <ProductPhoto src={material.photo} alt={material.productName} size="md" />
                    
                    {/* Product Info */}
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
                    
                    {/* Quantity & Actions */}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
