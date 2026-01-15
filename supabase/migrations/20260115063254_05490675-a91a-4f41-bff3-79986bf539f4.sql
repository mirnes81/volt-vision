-- =============================================
-- SaaS Multi-Tenant Architecture
-- =============================================

-- Enum for subscription plans
CREATE TYPE public.subscription_plan AS ENUM ('free_trial', 'standard', 'pro_dolibarr', 'enterprise');

-- Enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');

-- Enum for app mode
CREATE TYPE public.app_mode AS ENUM ('autonomous', 'dolibarr');

-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'technician');

-- =============================================
-- Tenants table (companies/organizations)
-- =============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6B8E23',
  app_mode app_mode NOT NULL DEFAULT 'autonomous',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Tenant configurations (Dolibarr settings, etc.)
-- =============================================
CREATE TABLE public.tenant_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dolibarr_url TEXT,
  dolibarr_api_key TEXT,
  timezone TEXT DEFAULT 'Europe/Zurich',
  daily_hours_limit NUMERIC(4,2) DEFAULT 8.5,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_configurations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Subscriptions table
-- =============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free_trial',
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_users INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SaaS user profiles (linked to auth.users)
-- =============================================
CREATE TABLE public.saas_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- User roles table (per tenant)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'technician',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Autonomous mode: Clients table
-- =============================================
CREATE TABLE public.autonomous_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Suisse',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autonomous_clients ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Autonomous mode: Interventions table
-- =============================================
CREATE TABLE public.autonomous_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.autonomous_clients(id) ON DELETE SET NULL,
  reference TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  priority TEXT DEFAULT 'normal',
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  date_planned TIMESTAMPTZ,
  date_start TIMESTAMPTZ,
  date_end TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autonomous_interventions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Autonomous mode: Products/Stock table
-- =============================================
CREATE TABLE public.autonomous_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'pièce',
  price NUMERIC(10, 2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autonomous_products ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Security definer function for role checking
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role app_role)
RETURNS BOOLEAN
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
      AND role = _role
  )
$$;

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saas_profiles
    WHERE id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

-- Function to get user's tenant ID
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.saas_profiles
  WHERE id = _user_id
$$;

-- =============================================
-- RLS Policies for tenants
-- =============================================
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), id, 'owner'));

-- =============================================
-- RLS Policies for tenant_configurations
-- =============================================
CREATE POLICY "Users can view their tenant config"
  ON public.tenant_configurations FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners/Admins can update tenant config"
  ON public.tenant_configurations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR 
    public.has_role(auth.uid(), tenant_id, 'admin')
  );

-- =============================================
-- RLS Policies for subscriptions
-- =============================================
CREATE POLICY "Users can view their subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================
-- RLS Policies for saas_profiles
-- =============================================
CREATE POLICY "Users can view their own profile"
  ON public.saas_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.saas_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Service role can insert profiles"
  ON public.saas_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================
-- RLS Policies for user_roles
-- =============================================
CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'owner'));

-- =============================================
-- RLS Policies for autonomous_clients
-- =============================================
CREATE POLICY "Tenant users can view clients"
  ON public.autonomous_clients FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant users can manage clients"
  ON public.autonomous_clients FOR ALL
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================
-- RLS Policies for autonomous_interventions
-- =============================================
CREATE POLICY "Tenant users can view interventions"
  ON public.autonomous_interventions FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant users can manage interventions"
  ON public.autonomous_interventions FOR ALL
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================
-- RLS Policies for autonomous_products
-- =============================================
CREATE POLICY "Tenant users can view products"
  ON public.autonomous_products FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant users can manage products"
  ON public.autonomous_products FOR ALL
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================
-- Trigger for automatic profile creation
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_saas_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.saas_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_saas
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_saas_user();

-- =============================================
-- Updated_at triggers
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_configurations_updated_at
  BEFORE UPDATE ON public.tenant_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saas_profiles_updated_at
  BEFORE UPDATE ON public.saas_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autonomous_clients_updated_at
  BEFORE UPDATE ON public.autonomous_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autonomous_interventions_updated_at
  BEFORE UPDATE ON public.autonomous_interventions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autonomous_products_updated_at
  BEFORE UPDATE ON public.autonomous_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();