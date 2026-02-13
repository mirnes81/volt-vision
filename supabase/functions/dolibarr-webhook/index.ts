import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('DOLIBARR_WEBHOOK_SECRET');
    
    // If a secret is configured, verify it
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body));

    // Parse the webhook payload
    // Dolibarr webhooks typically send: action, object, object_type
    const {
      action, // e.g. 'FICHEINTER_CREATE', 'FICHEINTER_MODIFY', 'FICHEINTER_DELETE', 'FICHEINTER_VALIDATE'
      object, // the object data
      object_type, // e.g. 'fichinter'
      // Also support custom/simple format
      event_type,
      resource_type,
      resource_id,
      payload,
    } = body;

    // Map Dolibarr action to our event types
    let mappedEventType = event_type || 'unknown';
    let mappedResourceType = resource_type || 'intervention';
    let mappedResourceId = resource_id || null;
    let mappedPayload = payload || {};

    if (action) {
      // Standard Dolibarr trigger actions
      const actionUpper = action.toUpperCase();
      
      if (actionUpper.includes('FICHEINTER')) {
        mappedResourceType = 'intervention';
        mappedResourceId = object?.id?.toString() || null;
        mappedPayload = object || {};
        
        if (actionUpper.includes('CREATE')) mappedEventType = 'intervention_created';
        else if (actionUpper.includes('MODIFY') || actionUpper.includes('UPDATE')) mappedEventType = 'intervention_updated';
        else if (actionUpper.includes('DELETE')) mappedEventType = 'intervention_deleted';
        else if (actionUpper.includes('VALIDATE')) mappedEventType = 'intervention_validated';
        else if (actionUpper.includes('CLOSE')) mappedEventType = 'intervention_closed';
        else mappedEventType = `intervention_${actionUpper.toLowerCase()}`;
      } else if (actionUpper.includes('USER')) {
        mappedResourceType = 'user';
        mappedResourceId = object?.id?.toString() || null;
        mappedPayload = object || {};
        mappedEventType = `user_${actionUpper.includes('CREATE') ? 'created' : 'updated'}`;
      } else if (actionUpper.includes('PRODUCT') || actionUpper.includes('STOCK')) {
        mappedResourceType = 'product';
        mappedResourceId = object?.id?.toString() || null;
        mappedPayload = object || {};
        mappedEventType = `product_${actionUpper.includes('CREATE') ? 'created' : 'updated'}`;
      } else {
        mappedEventType = actionUpper.toLowerCase();
        mappedPayload = body;
      }
    }

    // Insert event into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('webhook_events').insert({
      event_type: mappedEventType,
      resource_type: mappedResourceType,
      resource_id: mappedResourceId,
      payload: mappedPayload,
      tenant_id: '00000000-0000-0000-0000-000000000001',
    });

    if (error) {
      console.error('Error inserting webhook event:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process webhook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Webhook event stored: ${mappedEventType} for ${mappedResourceType} ${mappedResourceId}`);

    return new Response(
      JSON.stringify({ success: true, event_type: mappedEventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
