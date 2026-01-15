-- Fix RLS policies on released_interventions to be more restrictive
-- Add Supabase user tracking and proper RLS checks

-- Add column to track Supabase user who released the intervention
ALTER TABLE public.released_interventions 
ADD COLUMN IF NOT EXISTS released_by_supabase_uid uuid;

-- Add column to track Supabase user who took the intervention  
ALTER TABLE public.released_interventions 
ADD COLUMN IF NOT EXISTS taken_by_supabase_uid uuid;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view released interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Authenticated users can release interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Authenticated users can update released interventions" ON public.released_interventions;

-- SELECT: Any authenticated user can view (needed for collaboration)
CREATE POLICY "Authenticated users can view released interventions"
ON public.released_interventions
FOR SELECT
TO authenticated
USING (true);

-- INSERT: User must set themselves as the releaser
CREATE POLICY "Users can release their own interventions"
ON public.released_interventions
FOR INSERT
TO authenticated
WITH CHECK (
  released_by_supabase_uid = auth.uid()
  OR released_by_supabase_uid IS NULL -- Allow legacy inserts during transition
);

-- UPDATE: Only allow updates where user is taking the intervention or is the releaser
CREATE POLICY "Users can take or manage released interventions"
ON public.released_interventions
FOR UPDATE
TO authenticated
USING (
  -- The user is the one who released it (can cancel/modify)
  released_by_supabase_uid = auth.uid()
  OR released_by_supabase_uid IS NULL -- Legacy records
  OR status = 'available' -- Anyone can take an available intervention
)
WITH CHECK (
  -- When taking, must set themselves as taker
  (taken_by_supabase_uid = auth.uid() OR taken_by_supabase_uid IS NULL)
  -- When releasing/updating own, must be the releaser
  AND (released_by_supabase_uid = auth.uid() OR released_by_supabase_uid IS NULL)
);