-- Table pour stocker les produits des catalogues fournisseurs
CREATE TABLE public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  supplier TEXT NOT NULL, -- 'feller', 'hager', 'em'
  reference TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'CHF',
  stock_status TEXT, -- 'in_stock', 'out_of_stock', 'on_order'
  photo_url TEXT,
  product_url TEXT,
  specifications JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, supplier, reference)
);

-- Index pour recherche rapide
CREATE INDEX idx_supplier_products_supplier ON public.supplier_products(supplier);
CREATE INDEX idx_supplier_products_reference ON public.supplier_products(reference);
CREATE INDEX idx_supplier_products_name ON public.supplier_products USING gin(to_tsvector('french', name));

-- Enable RLS
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- Policies - Only admins can manage, everyone in tenant can view
CREATE POLICY "Dolibarr mode: read supplier products"
ON public.supplier_products
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: manage supplier products"
ON public.supplier_products
FOR ALL
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Table pour suivre l'historique des syncs
CREATE TABLE public.supplier_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  supplier TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  products_added INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_removed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.supplier_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dolibarr mode: read sync logs"
ON public.supplier_sync_logs
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: manage sync logs"
ON public.supplier_sync_logs
FOR ALL
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Trigger for updated_at
CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();