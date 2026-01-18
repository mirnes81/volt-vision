-- Fix security definer views by recreating them with security_invoker
DROP VIEW IF EXISTS public.weekly_work_summary;
DROP VIEW IF EXISTS public.monthly_work_summary;

-- Recreate weekly summary view with security invoker (default, no security definer)
CREATE VIEW public.weekly_work_summary 
WITH (security_invoker = true)
AS
SELECT 
  tenant_id,
  user_id,
  date_trunc('week', clock_in::date) AS week_start,
  COUNT(*) AS entry_count,
  COALESCE(SUM(duration_minutes), 0) AS total_minutes,
  COALESCE(SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END), 0) AS approved_minutes,
  COALESCE(SUM(CASE WHEN status = 'pending' THEN duration_minutes ELSE 0 END), 0) AS pending_minutes,
  COALESCE(SUM(CASE WHEN is_overtime = true THEN duration_minutes ELSE 0 END), 0) AS overtime_minutes,
  MIN(clock_in) AS first_clock_in,
  MAX(clock_out) AS last_clock_out
FROM public.work_time_entries
WHERE clock_out IS NOT NULL
GROUP BY tenant_id, user_id, date_trunc('week', clock_in::date);

-- Recreate monthly summary view with security invoker
CREATE VIEW public.monthly_work_summary 
WITH (security_invoker = true)
AS
SELECT 
  tenant_id,
  user_id,
  date_trunc('month', clock_in::date) AS month_start,
  COUNT(*) AS entry_count,
  COALESCE(SUM(duration_minutes), 0) AS total_minutes,
  COALESCE(SUM(CASE WHEN is_overtime = false OR is_overtime IS NULL THEN duration_minutes ELSE 0 END), 0) AS regular_minutes,
  COALESCE(SUM(CASE WHEN is_overtime = true THEN duration_minutes ELSE 0 END), 0) AS overtime_minutes,
  COALESCE(SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END), 0) AS approved_minutes
FROM public.work_time_entries
WHERE clock_out IS NOT NULL
GROUP BY tenant_id, user_id, date_trunc('month', clock_in::date);