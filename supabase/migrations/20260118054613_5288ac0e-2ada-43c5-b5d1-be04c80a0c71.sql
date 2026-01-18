-- Create table to store push subscriptions
CREATE TABLE public.push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Policy: Users can create their own subscriptions
CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Policy: Users can delete their own subscriptions
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid() AND user_belongs_to_tenant(auth.uid(), tenant_id));

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_tenant_id ON public.push_subscriptions(tenant_id);

-- Enable realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;

-- Add update trigger
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();