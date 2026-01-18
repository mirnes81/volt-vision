-- Create table for user weekly hour limits
CREATE TABLE public.user_weekly_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  weekly_hours_limit NUMERIC NOT NULL DEFAULT 42,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_weekly_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own limit"
  ON public.user_weekly_limits FOR SELECT
  USING (user_id = auth.uid() OR has_management_role(auth.uid(), tenant_id));

CREATE POLICY "Managers can manage limits"
  ON public.user_weekly_limits FOR ALL
  USING (has_management_role(auth.uid(), tenant_id));

CREATE POLICY "Dolibarr mode: read limits"
  ON public.user_weekly_limits FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: manage limits"
  ON public.user_weekly_limits FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Add is_overtime column to work_time_entries
ALTER TABLE public.work_time_entries 
ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT false;

-- Create view for weekly summary
CREATE OR REPLACE VIEW public.weekly_work_summary AS
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

-- Create view for monthly summary with overtime
CREATE OR REPLACE VIEW public.monthly_work_summary AS
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

-- Function to get user weekly limit
CREATE OR REPLACE FUNCTION public.get_user_weekly_limit(
  _user_id TEXT,
  _tenant_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limit_hours NUMERIC;
BEGIN
  SELECT weekly_hours_limit INTO limit_hours
  FROM user_weekly_limits
  WHERE tenant_id = _tenant_id AND user_id::text = _user_id;
  
  -- Default to 42 hours if not set
  RETURN COALESCE(limit_hours, 42);
END;
$$;

-- Function to check weekly hours and mark overtime
CREATE OR REPLACE FUNCTION public.check_weekly_overtime()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  weekly_limit_minutes INTEGER;
  current_week_minutes INTEGER;
  week_start_date DATE;
BEGIN
  -- Get week start
  week_start_date := date_trunc('week', NEW.clock_in::date)::date;
  
  -- Get user's weekly limit (default 42h = 2520 minutes)
  SELECT COALESCE(weekly_hours_limit * 60, 2520)::INTEGER INTO weekly_limit_minutes
  FROM user_weekly_limits
  WHERE tenant_id = NEW.tenant_id AND user_id::text = NEW.user_id::text;
  
  IF weekly_limit_minutes IS NULL THEN
    weekly_limit_minutes := 2520; -- Default 42h
  END IF;
  
  -- Calculate current week total (excluding this entry)
  SELECT COALESCE(SUM(duration_minutes), 0) INTO current_week_minutes
  FROM work_time_entries
  WHERE tenant_id = NEW.tenant_id
    AND user_id::text = NEW.user_id::text
    AND date_trunc('week', clock_in::date) = week_start_date
    AND id != NEW.id
    AND clock_out IS NOT NULL;
  
  -- Check if this entry pushes over the limit
  IF current_week_minutes >= weekly_limit_minutes THEN
    NEW.is_overtime := true;
  ELSIF current_week_minutes + COALESCE(NEW.duration_minutes, 0) > weekly_limit_minutes THEN
    -- Partial overtime - mark as overtime for simplicity
    NEW.is_overtime := true;
  ELSE
    NEW.is_overtime := false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for overtime detection
DROP TRIGGER IF EXISTS check_overtime_trigger ON work_time_entries;
CREATE TRIGGER check_overtime_trigger
  BEFORE INSERT OR UPDATE OF duration_minutes ON work_time_entries
  FOR EACH ROW
  WHEN (NEW.clock_out IS NOT NULL)
  EXECUTE FUNCTION check_weekly_overtime();