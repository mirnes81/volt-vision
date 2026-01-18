-- Recréer les vues avec security_invoker = on pour éviter les avertissements de sécurité
DROP VIEW IF EXISTS public.daily_work_summary;
DROP VIEW IF EXISTS public.weekly_work_summary;
DROP VIEW IF EXISTS public.monthly_work_summary;

CREATE VIEW public.daily_work_summary 
WITH (security_invoker = on) AS
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

CREATE VIEW public.weekly_work_summary 
WITH (security_invoker = on) AS
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

CREATE VIEW public.monthly_work_summary 
WITH (security_invoker = on) AS
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