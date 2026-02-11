
-- Add new permission values to the user_permission enum
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'interventions.view_assigned';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'interventions.view_all';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'interventions.create';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'interventions.edit';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'emergencies.create';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'emergencies.claim';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'planning.view';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'reports.generate';
