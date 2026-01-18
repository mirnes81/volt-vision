-- Migration complète en une seule transaction

-- 1. Supprimer les vues
DROP VIEW IF EXISTS public.daily_work_summary;
DROP VIEW IF EXISTS public.weekly_work_summary;
DROP VIEW IF EXISTS public.monthly_work_summary;

-- 2. Supprimer les contraintes FK
ALTER TABLE public.work_time_entries DROP CONSTRAINT IF EXISTS work_time_entries_user_id_fkey;
ALTER TABLE public.work_time_entries DROP CONSTRAINT IF EXISTS work_time_entries_validated_by_fkey;
ALTER TABLE public.hours_alerts DROP CONSTRAINT IF EXISTS hours_alerts_user_id_fkey;
ALTER TABLE public.hours_alerts DROP CONSTRAINT IF EXISTS hours_alerts_acknowledged_by_fkey;

-- 3. Changer les types de colonnes
ALTER TABLE public.work_time_entries 
  ALTER COLUMN user_id TYPE TEXT USING user_id::text,
  ALTER COLUMN validated_by TYPE TEXT USING validated_by::text;

ALTER TABLE public.hours_alerts 
  ALTER COLUMN user_id TYPE TEXT USING user_id::text,
  ALTER COLUMN acknowledged_by TYPE TEXT USING acknowledged_by::text;

-- 4. Recréer les vues
CREATE VIEW public.daily_work_summary AS
SELECT 
  tenant_id,
  user_id,
  DATE(clock_in AT TIME ZONE 'Europe/Zurich') as work_date,
  SUM(duration_minutes) as total_minutes,
  SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as approved_minutes,
  SUM(CASE WHEN status = 'pending' THEN duration_minutes ELSE 0 END) as pending_minutes,
  MIN(clock_in) as first_clock_in,
  MAX(clock_out) as last_clock_out,
  COUNT(*) as entry_count
FROM work_time_entries
WHERE duration_minutes IS NOT NULL
GROUP BY tenant_id, user_id, DATE(clock_in AT TIME ZONE 'Europe/Zurich');

CREATE VIEW public.weekly_work_summary AS
SELECT 
  tenant_id,
  user_id,
  DATE_TRUNC('week', clock_in AT TIME ZONE 'Europe/Zurich') as week_start,
  SUM(duration_minutes) as total_minutes,
  SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as approved_minutes,
  SUM(CASE WHEN status = 'pending' THEN duration_minutes ELSE 0 END) as pending_minutes,
  SUM(CASE WHEN is_overtime THEN duration_minutes ELSE 0 END) as overtime_minutes,
  MIN(clock_in) as first_clock_in,
  MAX(clock_out) as last_clock_out,
  COUNT(*) as entry_count
FROM work_time_entries
WHERE duration_minutes IS NOT NULL
GROUP BY tenant_id, user_id, DATE_TRUNC('week', clock_in AT TIME ZONE 'Europe/Zurich');

CREATE VIEW public.monthly_work_summary AS
SELECT 
  tenant_id,
  user_id,
  DATE_TRUNC('month', clock_in AT TIME ZONE 'Europe/Zurich') as month_start,
  SUM(duration_minutes) as total_minutes,
  SUM(CASE WHEN is_overtime THEN 0 ELSE duration_minutes END) as regular_minutes,
  SUM(CASE WHEN is_overtime THEN duration_minutes ELSE 0 END) as overtime_minutes,
  SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as approved_minutes,
  COUNT(*) as entry_count
FROM work_time_entries
WHERE duration_minutes IS NOT NULL
GROUP BY tenant_id, user_id, DATE_TRUNC('month', clock_in AT TIME ZONE 'Europe/Zurich');

-- 5. Recréer les politiques RLS pour work_time_entries
CREATE POLICY "Dolibarr mode: read entries"
ON public.work_time_entries FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: create entries"
ON public.work_time_entries FOR INSERT
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: update entries"
ON public.work_time_entries FOR UPDATE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: delete pending entries"
ON public.work_time_entries FOR DELETE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid AND status = 'pending');

-- 6. Recréer les politiques RLS pour hours_alerts
DROP POLICY IF EXISTS "Managers can view hours alerts" ON public.hours_alerts;
DROP POLICY IF EXISTS "Managers can acknowledge alerts" ON public.hours_alerts;
DROP POLICY IF EXISTS "Dolibarr mode: read alerts" ON public.hours_alerts;
DROP POLICY IF EXISTS "Dolibarr mode: update alerts" ON public.hours_alerts;
DROP POLICY IF EXISTS "Dolibarr mode: insert alerts" ON public.hours_alerts;

CREATE POLICY "Dolibarr mode: read alerts"
ON public.hours_alerts FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: update alerts"
ON public.hours_alerts FOR UPDATE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: insert alerts"
ON public.hours_alerts FOR INSERT
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);