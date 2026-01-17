-- Fix security definer view issue by using security invoker
DROP VIEW IF EXISTS public.daily_work_summary;

CREATE OR REPLACE VIEW public.daily_work_summary
WITH (security_invoker = on)
AS
SELECT 
    tenant_id,
    user_id,
    DATE(clock_in AT TIME ZONE 'Europe/Zurich') as work_date,
    COUNT(*) as entry_count,
    SUM(duration_minutes) as total_minutes,
    SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as approved_minutes,
    SUM(CASE WHEN status = 'pending' THEN duration_minutes ELSE 0 END) as pending_minutes,
    MIN(clock_in) as first_clock_in,
    MAX(clock_out) as last_clock_out
FROM public.work_time_entries
WHERE clock_out IS NOT NULL
GROUP BY tenant_id, user_id, DATE(clock_in AT TIME ZONE 'Europe/Zurich');