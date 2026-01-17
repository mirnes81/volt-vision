-- Table pour les assignations multiples d'interventions
CREATE TABLE public.intervention_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Intervention (peut être Dolibarr ou autonome)
    intervention_id INTEGER,  -- ID Dolibarr
    autonomous_intervention_id UUID REFERENCES public.autonomous_interventions(id) ON DELETE CASCADE,
    intervention_ref TEXT NOT NULL,
    intervention_label TEXT NOT NULL,
    
    -- Technicien assigné
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    
    -- Détails
    is_primary BOOLEAN DEFAULT FALSE,  -- Technicien principal
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'critical')),
    date_planned TIMESTAMP WITH TIME ZONE,
    location TEXT,
    client_name TEXT,
    
    -- Statut de notification
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Un technicien ne peut être assigné qu'une fois par intervention
    UNIQUE(intervention_id, user_id),
    UNIQUE(autonomous_intervention_id, user_id)
);

-- Index
CREATE INDEX idx_assignments_user ON public.intervention_assignments(user_id);
CREATE INDEX idx_assignments_tenant ON public.intervention_assignments(tenant_id);
CREATE INDEX idx_assignments_priority ON public.intervention_assignments(priority) WHERE priority IN ('urgent', 'critical');
CREATE INDEX idx_assignments_unack ON public.intervention_assignments(user_id) WHERE notification_acknowledged = FALSE;

-- Enable RLS
ALTER TABLE public.intervention_assignments ENABLE ROW LEVEL SECURITY;

-- Utilisateurs peuvent voir leurs assignations
CREATE POLICY "Users can view own assignments"
ON public.intervention_assignments
FOR SELECT
USING (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Managers peuvent voir toutes les assignations du tenant
CREATE POLICY "Managers can view all tenant assignments"
ON public.intervention_assignments
FOR SELECT
USING (has_management_role(auth.uid(), tenant_id));

-- Managers peuvent créer des assignations
CREATE POLICY "Managers can create assignments"
ON public.intervention_assignments
FOR INSERT
WITH CHECK (has_management_role(auth.uid(), tenant_id));

-- Managers peuvent modifier les assignations
CREATE POLICY "Managers can update assignments"
ON public.intervention_assignments
FOR UPDATE
USING (has_management_role(auth.uid(), tenant_id));

-- Utilisateurs peuvent acquitter leurs notifications
CREATE POLICY "Users can acknowledge own notifications"
ON public.intervention_assignments
FOR UPDATE
USING (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Managers peuvent supprimer les assignations
CREATE POLICY "Managers can delete assignments"
ON public.intervention_assignments
FOR DELETE
USING (has_management_role(auth.uid(), tenant_id));

-- Trigger pour updated_at
CREATE TRIGGER update_intervention_assignments_updated_at
BEFORE UPDATE ON public.intervention_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_assignments;