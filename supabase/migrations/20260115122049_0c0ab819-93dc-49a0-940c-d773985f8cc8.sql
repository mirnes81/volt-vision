-- Create function to mask API keys (show only last 4 characters)
CREATE OR REPLACE FUNCTION public.mask_api_key(api_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN api_key IS NULL THEN NULL
    WHEN length(api_key) <= 4 THEN '****'
    ELSE '****' || right(api_key, 4)
  END
$$;

-- Create secure view for tenant configurations
-- Owners/Admins see full API key, others see masked version
CREATE OR REPLACE VIEW public.tenant_configurations_safe
WITH (security_invoker = on) AS
SELECT 
  tc.id,
  tc.tenant_id,
  tc.daily_hours_limit,
  tc.language,
  tc.timezone,
  tc.dolibarr_url,
  CASE 
    WHEN has_role(auth.uid(), tc.tenant_id, 'owner'::app_role) 
      OR has_role(auth.uid(), tc.tenant_id, 'admin'::app_role)
    THEN tc.dolibarr_api_key
    ELSE mask_api_key(tc.dolibarr_api_key)
  END AS dolibarr_api_key,
  tc.created_at,
  tc.updated_at
FROM public.tenant_configurations tc;