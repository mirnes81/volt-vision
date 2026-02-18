
-- Create table for operational status overrides (managed in the PWA, not in Dolibarr)
CREATE TABLE IF NOT EXISTS public.intervention_operational_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id integer NOT NULL,
  tenant_id text NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  operational_status text NOT NULL DEFAULT 'a_faire',
  -- Completion tracking
  completed_at timestamp with time zone,
  completed_by text,
  has_signature boolean NOT NULL DEFAULT false,
  has_closing_photos boolean NOT NULL DEFAULT false,
  -- Audit
  updated_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(intervention_id, tenant_id),
  CONSTRAINT valid_status CHECK (operational_status IN ('a_faire', 'en_cours', 'a_terminer', 'pas_termine', 'a_revenir', 'termine'))
);

-- Enable RLS
ALTER TABLE public.intervention_operational_status ENABLE ROW LEVEL SECURITY;

-- Dolibarr mode: allow all operations for the default tenant (anon access, same pattern as other tables)
CREATE POLICY "Dolibarr mode: read status"
  ON public.intervention_operational_status
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Dolibarr mode: insert status"
  ON public.intervention_operational_status
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Dolibarr mode: update status"
  ON public.intervention_operational_status
  FOR UPDATE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Dolibarr mode: delete status"
  ON public.intervention_operational_status
  FOR DELETE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Auto-update updated_at
CREATE TRIGGER update_intervention_operational_status_updated_at
  BEFORE UPDATE ON public.intervention_operational_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
