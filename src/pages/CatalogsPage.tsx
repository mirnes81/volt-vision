import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  RefreshCw, 
  Search, 
  Filter,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SupplierProductCard } from '@/components/catalogs/SupplierProductCard';
import { SyncStatusCard } from '@/components/catalogs/SyncStatusCard';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentWorker } from '@/lib/api';

interface SupplierProduct {
  id: string;
  supplier: string;
  reference: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  currency: string;
  stock_status: string | null;
  photo_url: string | null;
  product_url: string | null;
  last_sync_at: string | null;
}

interface SyncLog {
  id: string;
  supplier: string;
  status: string;
  products_added: number;
  products_updated: number;
  products_removed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const SUPPLIERS = [
  { id: 'feller', name: 'Feller', color: 'bg-blue-500' },
  { id: 'hager', name: 'Hager', color: 'bg-green-500' },
  { id: 'em', name: 'Électromatériel', color: 'bg-orange-500' },
];

const HAGER_CATEGORIES = [
  'Systèmes de distribution et armoires',
  'Appareils modulaires',
  'Disjoncteurs, interrupteurs et appareils de protection',
  'Bornes de charge pour véhicule électrique (EVCS)',
  'Gestion et surveillance de l\'énergie',
  'Cheminement de câbles tehalit',
  'Prises et interrupteurs',
  'Technologie de sécurité',
  'Système de gestion du bâtiment KNX',
  'Interphonie',
  'Détecteurs de mouvements et de présence',
];

export default function CatalogsPage() {
  const { worker } = useAuth();
  const currentWorker = getCurrentWorker() as any;
  const isAdmin = currentWorker?.isAdmin || currentWorker?.admin || worker?.admin;
  
  const [activeSupplier, setActiveSupplier] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [syncingSupplier, setSyncingSupplier] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-muted-foreground text-center mb-4">
          Cette page est réservée aux administrateurs.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Retour
        </Button>
      </div>
    );
  }

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['supplier-products', activeSupplier, searchQuery, selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('supplier_products')
        .select('*')
        .order('name');

      if (activeSupplier !== 'all') {
        query = query.eq('supplier', activeSupplier);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`);
      }

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data as SupplierProduct[];
    },
  });

  // Fetch sync logs
  const { data: syncLogs } = useQuery({
    queryKey: ['supplier-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as SyncLog[];
    },
  });

  // Get product counts per supplier
  const { data: supplierCounts } = useQuery({
    queryKey: ['supplier-product-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      
      for (const supplier of SUPPLIERS) {
        const { count } = await supabase
          .from('supplier_products')
          .select('*', { count: 'exact', head: true })
          .eq('supplier', supplier.id);
        
        counts[supplier.id] = count || 0;
      }
      
      return counts;
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (supplier: string) => {
      setSyncingSupplier(supplier);
      
      const { data, error } = await supabase.functions.invoke('scrape-supplier-catalog', {
        body: { supplier, action: 'sync' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`${data.productsFound} produits trouvés pour ${data.supplier}`);
      } else {
        toast.warning(data.error || 'Synchronisation partielle');
      }
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-product-counts'] });
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error('Erreur lors de la synchronisation');
    },
    onSettled: () => {
      setSyncingSupplier(null);
    },
  });

  const handleSync = (supplier: string) => {
    syncMutation.mutate(supplier);
  };

  const handleSyncAll = async () => {
    for (const supplier of SUPPLIERS) {
      await syncMutation.mutateAsync(supplier.id);
    }
  };

  const totalProducts = supplierCounts 
    ? Object.values(supplierCounts).reduce((a, b) => a + b, 0) 
    : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Catalogues Fournisseurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalProducts} produits dans la base de données
          </p>
        </div>
        <Button 
          onClick={handleSyncAll}
          disabled={syncingSupplier !== null}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncingSupplier ? 'animate-spin' : ''}`} />
          Synchroniser tout
        </Button>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUPPLIERS.map((supplier) => (
          <Card key={supplier.id} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${supplier.color}`} />
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                {supplier.name}
                <Badge variant="secondary">
                  {supplierCounts?.[supplier.id] || 0} produits
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {syncLogs?.find(l => l.supplier === supplier.id)?.completed_at ? (
                    <>
                      Dernière sync: {format(
                        new Date(syncLogs.find(l => l.supplier === supplier.id)!.completed_at!),
                        'dd MMM à HH:mm',
                        { locale: fr }
                      )}
                    </>
                  ) : (
                    'Jamais synchronisé'
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSync(supplier.id)}
                  disabled={syncingSupplier !== null}
                >
                  <RefreshCw className={`w-4 h-4 ${syncingSupplier === supplier.id ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for products */}
      <Tabs value={activeSupplier} onValueChange={(v) => {
        setActiveSupplier(v);
        if (v !== 'hager') setSelectedCategory(null);
      }}>
        <div className="flex items-center gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            {SUPPLIERS.map((supplier) => (
              <TabsTrigger key={supplier.id} value={supplier.id}>
                {supplier.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou référence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Hager Categories Filter */}
        {activeSupplier === 'hager' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/80"
              onClick={() => setSelectedCategory(null)}
            >
              Toutes catégories
            </Badge>
            {HAGER_CATEGORIES.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        <TabsContent value={activeSupplier} className="mt-4">
          {productsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <SupplierProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Aucun produit trouvé</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Essayez une autre recherche'
                  : 'Synchronisez les catalogues pour voir les produits'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => handleSync(activeSupplier === 'all' ? 'feller' : activeSupplier)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Synchroniser
                </Button>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sync History */}
      {syncLogs && syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Historique des synchronisations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncLogs.slice(0, 5).map((log) => (
                <SyncStatusCard key={log.id} log={log} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
