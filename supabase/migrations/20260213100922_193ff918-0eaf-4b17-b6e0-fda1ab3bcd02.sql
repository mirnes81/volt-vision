
-- Table to receive webhook events from Dolibarr
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  event_type TEXT NOT NULL, -- 'intervention_created', 'intervention_updated', 'intervention_deleted', 'date_changed'
  resource_type TEXT NOT NULL, -- 'intervention', 'user', 'product'
  resource_id TEXT, -- Dolibarr object ID
  payload JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_webhook_events_created ON public.webhook_events (created_at DESC);
CREATE INDEX idx_webhook_events_type ON public.webhook_events (event_type);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow reading for authenticated users of the tenant
CREATE POLICY "Users can view webhook events for their tenant"
ON public.webhook_events FOR SELECT
USING (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Allow insert from edge functions (anon key for webhooks)
CREATE POLICY "Allow webhook inserts"
ON public.webhook_events FOR INSERT
WITH CHECK (true);

-- Auto-cleanup: delete events older than 24h
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.webhook_events WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_webhook_events_trigger
AFTER INSERT ON public.webhook_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_webhook_events();

-- Enable realtime for webhook_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
