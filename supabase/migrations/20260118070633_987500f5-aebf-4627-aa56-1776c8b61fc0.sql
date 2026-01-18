-- Drop existing restrictive Dolibarr mode policy for SELECT
DROP POLICY IF EXISTS "Dolibarr mode: read assignments" ON public.intervention_assignments;

-- Create a PERMISSIVE policy for Dolibarr mode (allows reading for the default tenant)
-- This is needed because in Dolibarr mode, users authenticate via Dolibarr API, not Supabase Auth
CREATE POLICY "Dolibarr mode: public read for default tenant" 
ON public.intervention_assignments 
FOR SELECT
TO anon, authenticated
USING (tenant_id = '00000000-0000-0000-0000-000000000001');