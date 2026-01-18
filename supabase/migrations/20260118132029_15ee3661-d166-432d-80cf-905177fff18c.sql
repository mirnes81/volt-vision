-- Add user_name column to work_time_entries for easy display
ALTER TABLE public.work_time_entries
ADD COLUMN IF NOT EXISTS user_name TEXT;