-- Drop and recreate the view with security_invoker enabled
-- This ensures the view respects the RLS policies of the caller
DROP VIEW IF EXISTS public.autonomous_clients_limited;

CREATE VIEW public.autonomous_clients_limited
WITH (security_invoker = on) AS
SELECT 
  id,
  tenant_id,
  name,
  address,
  postal_code,
  city,
  country,
  notes,
  created_at,
  updated_at
FROM public.autonomous_clients;

-- Grant access to authenticated users (RLS on base table will filter)
GRANT SELECT ON public.autonomous_clients_limited TO authenticated;