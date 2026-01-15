-- Fix cross-tenant data exposure vulnerabilities

-- 1. Fix saas_profiles: Allow viewing colleagues within same tenant
DROP POLICY IF EXISTS "Users can view their own profile" ON public.saas_profiles;

-- Users can view their own profile OR profiles of users in their tenant
CREATE POLICY "Users can view profiles in their tenant"
ON public.saas_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR (
    tenant_id IS NOT NULL 
    AND tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- 2. Fix released_interventions: Add tenant isolation
-- Add tenant_id column for proper multi-tenant isolation
ALTER TABLE public.released_interventions 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_released_interventions_tenant 
ON public.released_interventions(tenant_id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view released interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Users can release their own interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Users can take or manage released interventions" ON public.released_interventions;

-- SELECT: Users can only view interventions from their tenant or public (null tenant for legacy)
CREATE POLICY "Users can view tenant released interventions"
ON public.released_interventions
FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL -- Legacy records without tenant
  OR tenant_id = get_user_tenant_id(auth.uid())
);

-- INSERT: User must belong to tenant and identify themselves
CREATE POLICY "Users can release interventions in their tenant"
ON public.released_interventions
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()))
  AND (released_by_supabase_uid = auth.uid() OR released_by_supabase_uid IS NULL)
);

-- UPDATE: Only same tenant users can take/manage interventions
CREATE POLICY "Users can manage tenant released interventions"
ON public.released_interventions
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id(auth.uid())
)
WITH CHECK (
  (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()))
  AND (taken_by_supabase_uid = auth.uid() OR taken_by_supabase_uid IS NULL OR released_by_supabase_uid = auth.uid())
);