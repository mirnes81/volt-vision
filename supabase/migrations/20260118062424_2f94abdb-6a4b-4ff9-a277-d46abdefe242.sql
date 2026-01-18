-- Supprimer toutes les foreign keys qui peuvent bloquer
ALTER TABLE public.intervention_assignments 
  DROP CONSTRAINT IF EXISTS intervention_assignments_user_id_fkey;

ALTER TABLE public.intervention_assignments 
  DROP CONSTRAINT IF EXISTS intervention_assignments_assigned_by_fkey;

-- Supprimer les policies qui utilisent user_id avec auth.uid()
DROP POLICY IF EXISTS "Users can view own assignments" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Users can acknowledge own notifications" ON public.intervention_assignments;

-- Modifier les colonnes pour supporter les IDs Dolibarr (texte)
ALTER TABLE public.intervention_assignments 
  ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.intervention_assignments 
  ALTER COLUMN assigned_by TYPE text USING assigned_by::text;