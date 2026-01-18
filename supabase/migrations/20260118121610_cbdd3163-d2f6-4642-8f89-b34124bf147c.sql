-- Migration 1: Drop policies and views first, then alter columns

-- Drop ALL RLS policies on work_time_entries table
DROP POLICY "Users can view own time entries" ON public.work_time_entries;
DROP POLICY "Managers can view all tenant time entries" ON public.work_time_entries;
DROP POLICY "Users can create own time entries" ON public.work_time_entries;
DROP POLICY "Users can update own pending entries" ON public.work_time_entries;
DROP POLICY "Managers can validate entries" ON public.work_time_entries;
DROP POLICY "Dolibarr mode: read entries" ON public.work_time_entries;
DROP POLICY "Dolibarr mode: create entries" ON public.work_time_entries;
DROP POLICY "Dolibarr mode: update entries" ON public.work_time_entries;
DROP POLICY "Dolibarr mode: delete pending entries" ON public.work_time_entries;