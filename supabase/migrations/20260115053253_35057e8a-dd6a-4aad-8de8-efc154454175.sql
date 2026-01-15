-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view released interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Anyone can release interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Anyone can take interventions" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable update for all users" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable read access for all" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.released_interventions;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.released_interventions;

-- Create new permissive policies
CREATE POLICY "Allow read access for all"
ON public.released_interventions
FOR SELECT
USING (true);

CREATE POLICY "Allow insert for all"
ON public.released_interventions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for all"
ON public.released_interventions
FOR UPDATE
USING (true)
WITH CHECK (true);