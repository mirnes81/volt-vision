-- Fix critical security vulnerabilities on released_interventions table
-- Remove overly permissive RLS policies and require authentication

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow read access for all" ON public.released_interventions;
DROP POLICY IF EXISTS "Allow insert for all" ON public.released_interventions;
DROP POLICY IF EXISTS "Allow update for all" ON public.released_interventions;

-- Create secure policies requiring authentication
-- SELECT: Only authenticated users can view released interventions
CREATE POLICY "Authenticated users can view released interventions"
ON public.released_interventions
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only authenticated users can release interventions
CREATE POLICY "Authenticated users can release interventions"
ON public.released_interventions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Only authenticated users can take/update interventions
CREATE POLICY "Authenticated users can update released interventions"
ON public.released_interventions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix function search_path warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;