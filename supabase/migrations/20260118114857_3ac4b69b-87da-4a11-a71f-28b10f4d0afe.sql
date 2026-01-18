-- Create enum for granular permissions
CREATE TYPE public.user_permission AS ENUM (
  'hours.view_own',
  'hours.add_own',
  'hours.modify_own_limit',
  'hours.validate',
  'hours.view_all',
  'hours.export',
  'hours.alerts',
  'settings.hours'
);

-- Create table for user permissions
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Dolibarr user ID as text
  user_name TEXT NOT NULL,
  permission user_permission NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Managers can view permissions"
ON public.user_permissions
FOR SELECT
USING (has_management_role(auth.uid(), tenant_id));

CREATE POLICY "Managers can grant permissions"
ON public.user_permissions
FOR INSERT
WITH CHECK (has_management_role(auth.uid(), tenant_id));

CREATE POLICY "Managers can revoke permissions"
ON public.user_permissions
FOR DELETE
USING (has_management_role(auth.uid(), tenant_id));

-- Dolibarr mode policies
CREATE POLICY "Dolibarr mode: read permissions"
ON public.user_permissions
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Dolibarr mode: manage permissions"
ON public.user_permissions
FOR ALL
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_user_permission(
  _user_id TEXT,
  _tenant_id UUID,
  _permission user_permission
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND permission = _permission
  )
$$;

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  _user_id TEXT,
  _tenant_id UUID
)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(permission::text),
    ARRAY['hours.view_own', 'hours.add_own']::text[]
  )
  FROM public.user_permissions
  WHERE user_id = _user_id
    AND tenant_id = _tenant_id
$$;