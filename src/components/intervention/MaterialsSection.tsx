import { useState, useEffect } from 'react';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Intervention, Product } from '@/types/intervention';
import { getProducts, addMaterial } from '@/lib/api';
import { toast } from 'sonner';

interface MaterialsSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function MaterialsSection({ intervention, onUpdate }: MaterialsSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [qty, setQty] = useState('1');
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  const handleAdd = async () => {
    if (!selectedProduct || !qty) return;
    
    setIsLoading(true);
    try {
      await addMaterial(intervention.id, {
        productId: selectedProduct,
        qty: parseFloat(qty),
        comment: comment || undefined,
      });
      toast.success('Matériel ajouté');
      setShowAdd(false);
      setSelectedProduct(null);
      setQty('1');
      setComment('');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setIsLoading(false);
    }
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
          <div>
            <label className="text-sm font-medium mb-2 block">Produit</label>
            <select
              value={selectedProduct || ''}
              onChange={(e) => setSelectedProduct(Number(e.target.value) || null)}
              className="w-full h-14 px-4 bg-secondary rounded-xl text-base font-medium border-0 focus:ring-2 focus:ring-primary"
            >
              <option value="">Sélectionner un produit</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.ref} - {product.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Quantité</label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-14 text-base font-medium text-center"
                min="0"
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
              onClick={() => setShowAdd(false)}
            >
              Annuler
            </Button>
            <Button
              variant="worker"
              className="flex-1"
              onClick={handleAdd}
              disabled={!selectedProduct || isLoading}
            >
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {/* Materials List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground px-1">Matériel posé</h4>
        {intervention.materials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun matériel enregistré</p>
          </div>
        ) : (
          <div className="space-y-2">
            {intervention.materials.map((material) => (
              <div
                key={material.id}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{material.productName}</p>
                    {material.comment && (
                      <p className="text-xs text-muted-foreground truncate">{material.comment}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-lg font-bold text-primary">
                      {material.qtyUsed} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
