
-- Table to store intervention date overrides shared across all devices
CREATE TABLE public.intervention_date_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id INTEGER NOT NULL,
  override_date TIMESTAMPTZ NOT NULL,
  created_by TEXT,
  tenant_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(intervention_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.intervention_date_overrides ENABLE ROW LEVEL SECURITY;

-- Allow anon read for the default tenant (Dolibarr mode)
CREATE POLICY "Anon read date overrides" ON public.intervention_date_overrides
  FOR SELECT USING (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Allow anon insert/update for Dolibarr mode
CREATE POLICY "Anon upsert date overrides" ON public.intervention_date_overrides
  FOR INSERT WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Anon update date overrides" ON public.intervention_date_overrides
  FOR UPDATE USING (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Anon delete date overrides" ON public.intervention_date_overrides
  FOR DELETE USING (tenant_id = '00000000-0000-0000-0000-000000000001');
