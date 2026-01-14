import { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, XCircle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isOnline } from '@/lib/offlineStorage';
import { decodeHtmlEntities } from '@/lib/htmlUtils';

interface StockItem {
  productId: number;
  productRef: string;
  productName: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  price?: number;
  barcode?: string;
  category?: string;
}

export function StockSection() {
  const { t } = useLanguage();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    loadStock();
    
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadStock = async () => {
    setIsLoading(true);
    setError(null);
    
    if (!isOnline()) {
      setError('Mode hors-ligne - Impossible de récupérer le stock');
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-stock' }
      });
      
      if (fnError) {
        console.error('Error fetching stock:', fnError);
        setError('Erreur lors de la récupération du stock');
        setStock([]);
      } else if (data && Array.isArray(data)) {
        // Decode HTML entities in product names
        const decodedStock = data.map((item: StockItem) => ({
          ...item,
          productName: decodeHtmlEntities(item.productName),
          productRef: decodeHtmlEntities(item.productRef),
          unit: decodeHtmlEntities(item.unit),
        }));
        setStock(decodedStock);
        console.log(`Loaded ${decodedStock.length} stock items from Dolibarr`);
      } else {
        setStock([]);
      }
    } catch (err) {
      console.error('Error loading stock:', err);
      setError('Erreur de connexion');
      setStock([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStockStatus = (item: StockItem) => {
    if (item.quantity === 0) return 'outOfStock';
    if (item.minQuantity > 0 && item.quantity <= item.minQuantity) return 'low';
    return 'available';
  };

  const statusConfig = {
    available: { 
      label: t('stock.available'), 
      icon: CheckCircle, 
      color: 'text-success bg-success/10' 
    },
    low: { 
      label: t('stock.low'), 
      icon: AlertTriangle, 
      color: 'text-warning bg-warning/10' 
    },
    outOfStock: { 
      label: t('stock.outOfStock'), 
      icon: XCircle, 
      color: 'text-destructive bg-destructive/10' 
    },
  };

  const sortedStock = [...stock].sort((a, b) => {
    const statusOrder = { outOfStock: 0, low: 1, available: 2 };
    return statusOrder[getStockStatus(a)] - statusOrder[getStockStatus(b)];
  });

  const lowStockCount = stock.filter(s => getStockStatus(s) !== 'available').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold">{t('stock.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {stock.length} produits en stock
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <div className="flex items-center gap-1 text-warning">
                <WifiOff className="w-4 h-4" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={loadStock}
              disabled={isLoading || !online}
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-xl text-warning">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              {lowStockCount} produit(s) en stock bas ou rupture
            </span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-xl text-destructive mt-2">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Stock List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : stock.length === 0 && !error ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun produit en stock</p>
          </div>
        ) : (
          sortedStock.map((item) => {
            const status = getStockStatus(item);
            const config = statusConfig[status];
            const StatusIcon = config.icon;

            return (
              <div
                key={item.productId}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {item.productRef && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {item.productRef}
                        </span>
                      )}
                    </div>
                    <p className="font-medium truncate mt-1">{item.productName}</p>
                    {item.minQuantity > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Seuil min: {item.minQuantity} {item.unit}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={cn(
                      "text-xl font-bold",
                      status === 'available' ? 'text-foreground' : 
                      status === 'low' ? 'text-warning' : 'text-destructive'
                    )}>
                      {item.quantity} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                    </p>
                    <div className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1",
                      config.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
