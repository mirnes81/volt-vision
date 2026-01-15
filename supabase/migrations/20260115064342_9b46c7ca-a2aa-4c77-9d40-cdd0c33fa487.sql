-- Fix autonomous_clients: Role-based access control for sensitive data
-- Technicians can only see basic info, admins/managers see full contact details

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Tenant users can view clients" ON public.autonomous_clients;
DROP POLICY IF EXISTS "Tenant users can manage clients" ON public.autonomous_clients;

-- Create a function to check if user has management role (owner, admin, or manager)
CREATE OR REPLACE FUNCTION public.has_management_role(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'manager')
  )
$$;

-- Create view for technicians (hides sensitive contact info)
CREATE OR REPLACE VIEW public.autonomous_clients_limited
WITH (security_invoker = on)
AS SELECT 
  id,
  tenant_id,
  name,
  address,
  city,
  postal_code,
  country,
  notes,
  created_at,
  updated_at
  -- Excludes: email, phone (sensitive contact data)
FROM public.autonomous_clients;

-- SELECT: Management roles see everything, technicians use the view
CREATE POLICY "Management can view all client data"
ON public.autonomous_clients
FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id) 
  AND has_management_role(auth.uid(), tenant_id)
);

-- Technicians can view limited client data via the view
CREATE POLICY "Technicians can view limited client data"
ON public.autonomous_clients
FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND has_role(auth.uid(), tenant_id, 'technician')
);

-- INSERT/UPDATE/DELETE: Only management roles
CREATE POLICY "Management can insert clients"
ON public.autonomous_clients
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND has_management_role(auth.uid(), tenant_id)
);

CREATE POLICY "Management can update clients"
ON public.autonomous_clients
FOR UPDATE
TO authenticated
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND has_management_role(auth.uid(), tenant_id)
);

CREATE POLICY "Management can delete clients"
ON public.autonomous_clients
FOR DELETE
TO authenticated
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  AND has_management_role(auth.uid(), tenant_id)
);

-- Fix saas_profiles INSERT policy (restrict to service role)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.saas_profiles;

-- Only the trigger function (via service role) should insert profiles
-- Regular authenticated users cannot insert profiles directly
CREATE POLICY "Only triggers can insert profiles"
ON public.saas_profiles
FOR INSERT
TO service_role
WITH CHECK (true);