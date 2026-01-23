-- Create emergency interventions table for urgent repair system with bonus
CREATE TABLE public.emergency_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    intervention_id INTEGER NOT NULL,
    intervention_ref TEXT,
    intervention_label TEXT,
    client_name TEXT,
    location TEXT,
    description TEXT,
    bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    currency TEXT NOT NULL DEFAULT 'CHF',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'cancelled')),
    claimed_by_user_id TEXT,
    claimed_by_user_name TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id TEXT NOT NULL,
    created_by_user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.emergency_interventions ENABLE ROW LEVEL SECURITY;

-- Policies for tenant-based access (Dolibarr mode - no Supabase auth)
CREATE POLICY "Public read for emergency interventions"
ON public.emergency_interventions
FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Public insert for emergency interventions"
ON public.emergency_interventions
FOR INSERT
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Public update for emergency interventions"
ON public.emergency_interventions
FOR UPDATE
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Create atomic claim function to prevent race conditions
CREATE OR REPLACE FUNCTION public.claim_emergency_intervention(
    p_emergency_id UUID,
    p_user_id TEXT,
    p_user_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
    v_current_status TEXT;
    v_intervention_id INTEGER;
    v_bonus_amount DECIMAL;
BEGIN
    -- Lock the row and check status atomically
    SELECT status, intervention_id, bonus_amount 
    INTO v_current_status, v_intervention_id, v_bonus_amount
    FROM public.emergency_interventions
    WHERE id = p_emergency_id
    FOR UPDATE;
    
    IF v_current_status IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Intervention urgente non trouvée');
    END IF;
    
    IF v_current_status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Cette intervention a déjà été prise');
    END IF;
    
    -- Claim the intervention
    UPDATE public.emergency_interventions
    SET 
        status = 'claimed',
        claimed_by_user_id = p_user_id,
        claimed_by_user_name = p_user_name,
        claimed_at = now()
    WHERE id = p_emergency_id;
    
    RETURN json_build_object(
        'success', true, 
        'intervention_id', v_intervention_id,
        'bonus_amount', v_bonus_amount,
        'message', 'Intervention réclamée avec succès!'
    );
END;
$$;

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_interventions;

-- Index for faster queries
CREATE INDEX idx_emergency_interventions_status ON public.emergency_interventions(status);
CREATE INDEX idx_emergency_interventions_tenant ON public.emergency_interventions(tenant_id);