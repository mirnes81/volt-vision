-- Table pour stocker les dernières positions des ouvriers
CREATE TABLE public.worker_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_online BOOLEAN DEFAULT true,
  current_intervention_id INTEGER,
  current_intervention_ref TEXT,
  CONSTRAINT worker_locations_user_tenant_unique UNIQUE (user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;

-- Policies - allow all for same tenant
CREATE POLICY "Workers can view all locations in tenant" 
ON public.worker_locations FOR SELECT 
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Workers can insert their location" 
ON public.worker_locations FOR INSERT 
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Workers can update their location" 
ON public.worker_locations FOR UPDATE 
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_locations;

-- Index for faster queries
CREATE INDEX idx_worker_locations_tenant ON public.worker_locations(tenant_id);
CREATE INDEX idx_worker_locations_online ON public.worker_locations(is_online) WHERE is_online = true;