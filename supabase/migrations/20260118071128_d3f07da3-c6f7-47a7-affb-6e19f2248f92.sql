-- Drop and recreate policy with different name to force cache invalidation
DROP POLICY IF EXISTS "Dolibarr mode: public read for default tenant" ON public.intervention_assignments;

-- Recreate with slightly different name
CREATE POLICY "Dolibarr mode: anon read for tenant" 
ON public.intervention_assignments 
FOR SELECT
TO anon, authenticated
USING (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Also add a policy that allows reading based on public role
CREATE POLICY "Public read for Dolibarr tenant" 
ON public.intervention_assignments 
FOR SELECT
TO public
USING (tenant_id = '00000000-0000-0000-0000-000000000001');