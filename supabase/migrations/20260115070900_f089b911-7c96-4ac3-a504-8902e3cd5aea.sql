-- Drop existing SELECT policy on saas_profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.saas_profiles;

-- Create a more restrictive SELECT policy:
-- Users can only see their own full profile
-- OR management roles can see all profiles in their tenant
CREATE POLICY "Users can view own profile or management can view tenant profiles"
ON public.saas_profiles
FOR SELECT
USING (
  (id = auth.uid())
  OR 
  (
    tenant_id IS NOT NULL 
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND has_management_role(auth.uid(), tenant_id)
  )
);

-- Create a limited view for non-management users to see colleague names
-- This view excludes sensitive fields (email, phone)
CREATE VIEW public.saas_profiles_limited
WITH (security_invoker = on) AS
SELECT 
  id,
  tenant_id,
  full_name,
  avatar_url,
  is_super_admin,
  created_at,
  updated_at
FROM public.saas_profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.saas_profiles_limited TO authenticated;