-- Drop existing view if exists
DROP VIEW IF EXISTS public.saas_profiles_limited;

-- Recreate saas_profiles_limited view with field-level security
-- Users see their own email/phone, management sees all, others see null
CREATE VIEW public.saas_profiles_limited
WITH (security_invoker = on) AS
SELECT 
  sp.id,
  sp.full_name,
  sp.avatar_url,
  sp.tenant_id,
  sp.is_super_admin,
  sp.created_at,
  sp.updated_at,
  -- Email: visible only to self or management
  CASE 
    WHEN sp.id = auth.uid() THEN sp.email
    WHEN sp.tenant_id IS NOT NULL AND has_management_role(auth.uid(), sp.tenant_id) THEN sp.email
    ELSE NULL
  END AS email,
  -- Phone: visible only to self or management
  CASE 
    WHEN sp.id = auth.uid() THEN sp.phone
    WHEN sp.tenant_id IS NOT NULL AND has_management_role(auth.uid(), sp.tenant_id) THEN sp.phone
    ELSE NULL
  END AS phone
FROM public.saas_profiles sp
WHERE 
  -- User can only see profiles in their tenant or their own profile
  sp.id = auth.uid() 
  OR (sp.tenant_id IS NOT NULL AND sp.tenant_id = get_user_tenant_id(auth.uid()));