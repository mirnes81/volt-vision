-- Create a default tenant for Dolibarr integration mode
INSERT INTO public.tenants (id, name, slug, app_mode)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ENES Électricité',
  'enes-dolibarr',
  'dolibarr'
)
ON CONFLICT (id) DO NOTHING;

-- Create default tenant configuration
INSERT INTO public.tenant_configurations (tenant_id, daily_hours_limit, timezone, language)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  8.5,
  'Europe/Zurich',
  'fr'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Add RLS policies for Dolibarr integration mode using the default tenant UUID
-- Policy for SELECT: Allow reading entries for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: read entries"
ON public.work_time_entries
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for INSERT: Allow inserting entries for the default dolibarr tenant  
CREATE POLICY "Dolibarr mode: create entries"
ON public.work_time_entries
FOR INSERT
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for UPDATE: Allow updating entries for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: update entries"
ON public.work_time_entries
FOR UPDATE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Policy for DELETE: Allow deleting pending entries for the default dolibarr tenant
CREATE POLICY "Dolibarr mode: delete pending entries"
ON public.work_time_entries
FOR DELETE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid AND status = 'pending');