-- Add RLS policies for Dolibarr integration mode on intervention_assignments
-- These allow access for the default Dolibarr tenant without Supabase Auth

-- Policy for SELECT: Allow reading assignments for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: read assignments"
ON public.intervention_assignments
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for INSERT: Allow inserting assignments for the default dolibarr tenant  
CREATE POLICY "Dolibarr mode: create assignments"
ON public.intervention_assignments
FOR INSERT
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for UPDATE: Allow updating assignments for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: update assignments"
ON public.intervention_assignments
FOR UPDATE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for DELETE: Allow deleting assignments for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: delete assignments"
ON public.intervention_assignments
FOR DELETE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);