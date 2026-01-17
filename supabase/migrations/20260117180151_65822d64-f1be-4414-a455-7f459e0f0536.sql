-- Table principale pour le suivi des heures (pointage)
CREATE TABLE public.work_time_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Pointage
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    clock_out TIMESTAMP WITH TIME ZONE,
    
    -- Géolocalisation
    clock_in_latitude DOUBLE PRECISION,
    clock_in_longitude DOUBLE PRECISION,
    clock_out_latitude DOUBLE PRECISION,
    clock_out_longitude DOUBLE PRECISION,
    
    -- Liaison intervention (optionnel)
    intervention_id INTEGER,
    intervention_ref TEXT,
    
    -- Commentaires et type
    work_type TEXT DEFAULT 'intervention',
    comment TEXT,
    
    -- Validation manager
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Durée calculée (en minutes)
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN clock_out IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60 
        ELSE NULL END
    ) STORED,
    
    -- Sync Dolibarr
    synced_to_dolibarr BOOLEAN DEFAULT FALSE,
    dolibarr_sync_at TIMESTAMP WITH TIME ZONE,
    dolibarr_line_id INTEGER,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_work_time_entries_user_date ON public.work_time_entries(user_id, clock_in);
CREATE INDEX idx_work_time_entries_tenant_date ON public.work_time_entries(tenant_id, clock_in);
CREATE INDEX idx_work_time_entries_status ON public.work_time_entries(status);
CREATE INDEX idx_work_time_entries_intervention ON public.work_time_entries(intervention_id);

-- Enable RLS
ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
-- Les utilisateurs peuvent voir leurs propres entrées
CREATE POLICY "Users can view own time entries"
ON public.work_time_entries
FOR SELECT
USING (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Les managers peuvent voir toutes les entrées du tenant
CREATE POLICY "Managers can view all tenant time entries"
ON public.work_time_entries
FOR SELECT
USING (has_management_role(auth.uid(), tenant_id));

-- Les utilisateurs peuvent créer leurs propres entrées
CREATE POLICY "Users can create own time entries"
ON public.work_time_entries
FOR INSERT
WITH CHECK (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Les utilisateurs peuvent modifier leurs entrées non validées
CREATE POLICY "Users can update own pending entries"
ON public.work_time_entries
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending' AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Les managers peuvent valider/rejeter les entrées
CREATE POLICY "Managers can validate entries"
ON public.work_time_entries
FOR UPDATE
USING (has_management_role(auth.uid(), tenant_id));

-- Trigger pour updated_at
CREATE TRIGGER update_work_time_entries_updated_at
BEFORE UPDATE ON public.work_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Vue pour les statistiques journalières par utilisateur
CREATE OR REPLACE VIEW public.daily_work_summary AS
SELECT 
    tenant_id,
    user_id,
    DATE(clock_in AT TIME ZONE 'Europe/Zurich') as work_date,
    COUNT(*) as entry_count,
    SUM(duration_minutes) as total_minutes,
    SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) as approved_minutes,
    SUM(CASE WHEN status = 'pending' THEN duration_minutes ELSE 0 END) as pending_minutes,
    MIN(clock_in) as first_clock_in,
    MAX(clock_out) as last_clock_out
FROM public.work_time_entries
WHERE clock_out IS NOT NULL
GROUP BY tenant_id, user_id, DATE(clock_in AT TIME ZONE 'Europe/Zurich');

-- Fonction pour vérifier si un utilisateur a dépassé sa limite journalière
CREATE OR REPLACE FUNCTION public.check_daily_hours_limit(
    _user_id UUID,
    _tenant_id UUID,
    _date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_minutes INTEGER,
    limit_minutes INTEGER,
    is_exceeded BOOLEAN,
    remaining_minutes INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH daily_total AS (
        SELECT COALESCE(SUM(duration_minutes), 0)::INTEGER as total
        FROM work_time_entries
        WHERE user_id = _user_id
          AND tenant_id = _tenant_id
          AND DATE(clock_in AT TIME ZONE 'Europe/Zurich') = _date
          AND clock_out IS NOT NULL
    ),
    config AS (
        SELECT COALESCE(daily_hours_limit, 8.5) * 60 as limit_mins
        FROM tenant_configurations
        WHERE tenant_id = _tenant_id
    )
    SELECT 
        dt.total as total_minutes,
        c.limit_mins::INTEGER as limit_minutes,
        dt.total > c.limit_mins as is_exceeded,
        GREATEST(0, c.limit_mins::INTEGER - dt.total) as remaining_minutes
    FROM daily_total dt, config c
$$;

-- Table pour les alertes de dépassement
CREATE TABLE public.hours_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_date DATE NOT NULL,
    total_minutes INTEGER NOT NULL,
    limit_minutes INTEGER NOT NULL,
    excess_minutes INTEGER NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, alert_date)
);

ALTER TABLE public.hours_alerts ENABLE ROW LEVEL SECURITY;

-- Managers peuvent voir les alertes
CREATE POLICY "Managers can view hours alerts"
ON public.hours_alerts
FOR SELECT
USING (has_management_role(auth.uid(), tenant_id));

-- Managers peuvent acquitter les alertes
CREATE POLICY "Managers can acknowledge alerts"
ON public.hours_alerts
FOR UPDATE
USING (has_management_role(auth.uid(), tenant_id));

-- Fonction pour créer une alerte si dépassement
CREATE OR REPLACE FUNCTION public.create_hours_alert_if_exceeded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_check RECORD;
BEGIN
    -- Vérifier le dépassement
    SELECT * INTO v_check
    FROM check_daily_hours_limit(
        NEW.user_id,
        NEW.tenant_id,
        DATE(NEW.clock_in AT TIME ZONE 'Europe/Zurich')
    );
    
    -- Si dépassé, créer une alerte
    IF v_check.is_exceeded THEN
        INSERT INTO hours_alerts (
            tenant_id,
            user_id,
            alert_date,
            total_minutes,
            limit_minutes,
            excess_minutes
        ) VALUES (
            NEW.tenant_id,
            NEW.user_id,
            DATE(NEW.clock_in AT TIME ZONE 'Europe/Zurich'),
            v_check.total_minutes,
            v_check.limit_minutes,
            v_check.total_minutes - v_check.limit_minutes
        )
        ON CONFLICT (user_id, alert_date) DO UPDATE SET
            total_minutes = EXCLUDED.total_minutes,
            excess_minutes = EXCLUDED.excess_minutes,
            acknowledged = FALSE;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_hours_limit
AFTER UPDATE OF clock_out ON public.work_time_entries
FOR EACH ROW
WHEN (NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL)
EXECUTE FUNCTION public.create_hours_alert_if_exceeded();