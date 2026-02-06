-- Table pour stocker les templates d'extraction de bons de régie
CREATE TABLE public.voucher_extraction_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  template_name TEXT NOT NULL,
  client_pattern TEXT,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  sample_extractions JSONB DEFAULT '[]',
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour stocker l'historique des scans de bons de régie
CREATE TABLE public.voucher_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  template_id UUID REFERENCES public.voucher_extraction_templates(id),
  original_file_url TEXT NOT NULL,
  raw_ocr_text TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  corrected_data JSONB,
  intervention_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  scanned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.voucher_extraction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_scans ENABLE ROW LEVEL SECURITY;

-- RLS policies pour les templates
CREATE POLICY "Users can view templates from their tenant"
ON public.voucher_extraction_templates
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM public.saas_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can manage templates"
ON public.voucher_extraction_templates
FOR ALL
USING (
  tenant_id = (SELECT tenant_id FROM public.saas_profiles WHERE id = auth.uid())
  AND public.has_management_role(tenant_id, auth.uid())
);

-- RLS policies pour les scans
CREATE POLICY "Users can view scans from their tenant"
ON public.voucher_scans
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM public.saas_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create scans in their tenant"
ON public.voucher_scans
FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.saas_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can update scans"
ON public.voucher_scans
FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM public.saas_profiles WHERE id = auth.uid())
  AND public.has_management_role(tenant_id, auth.uid())
);

-- Storage bucket pour les bons de régie scannés
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voucher-scans', 'voucher-scans', false)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket de stockage
CREATE POLICY "Users can upload voucher scans"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voucher-scans' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view voucher scans"
ON storage.objects
FOR SELECT
USING (bucket_id = 'voucher-scans' AND auth.uid() IS NOT NULL);

-- Trigger pour updated_at
CREATE TRIGGER update_voucher_templates_updated_at
BEFORE UPDATE ON public.voucher_extraction_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime pour les scans
ALTER PUBLICATION supabase_realtime ADD TABLE public.voucher_scans;