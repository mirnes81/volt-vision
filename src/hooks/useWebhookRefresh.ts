import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface WebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

type RefreshCallback = () => void | Promise<void>;

/**
 * Hook that subscribes to Dolibarr webhook events via Supabase Realtime.
 * When a webhook event arrives, it triggers the provided refresh callback
 * to reload data from Dolibarr.
 * 
 * @param onRefresh - Callback to trigger data refresh
 * @param options - Configuration options
 */
export function useWebhookRefresh(
  onRefresh: RefreshCallback,
  options?: {
    resourceTypes?: string[]; // Filter by resource type (e.g., ['intervention'])
    showToast?: boolean; // Show notification on webhook event
    debounceMs?: number; // Debounce multiple rapid events
  }
) {
  const { resourceTypes, showToast = false, debounceMs = 2000 } = options || {};
  const [lastEvent, setLastEvent] = React.useState<WebhookEvent | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = React.useRef(onRefresh);
  
  // Keep callback ref up to date
  React.useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  React.useEffect(() => {
    const channel = supabase
      .channel('webhook-events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_events',
        },
        (payload) => {
          const event = payload.new as WebhookEvent;
          console.log('[Webhook] Realtime event received:', event.event_type, event.resource_type, event.resource_id);
          
          // Filter by resource type if specified
          if (resourceTypes && !resourceTypes.includes(event.resource_type)) {
            return;
          }
          
          setLastEvent(event);
          
          // Debounce rapid events
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          
          debounceRef.current = setTimeout(async () => {
            console.log('[Webhook] Triggering refresh for:', event.event_type);
            
            if (showToast) {
              const messages: Record<string, string> = {
                intervention_created: '🆕 Nouvelle intervention créée',
                intervention_updated: '🔄 Intervention mise à jour',
                intervention_deleted: '🗑️ Intervention supprimée',
                intervention_validated: '✅ Intervention validée',
                intervention_closed: '🔒 Intervention clôturée',
                date_changed: '📅 Date modifiée',
                user_updated: '👤 Utilisateur mis à jour',
                product_updated: '📦 Produit mis à jour',
              };
              const msg = messages[event.event_type] || `📡 Mise à jour: ${event.event_type}`;
              toast.info(msg, { duration: 3000 });
            }
            
            try {
              await onRefreshRef.current();
            } catch (err) {
              console.error('[Webhook] Refresh error:', err);
            }
          }, debounceMs);
        }
      )
      .subscribe((status) => {
        console.log('[Webhook] Subscription status:', status);
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [resourceTypes?.join(','), showToast, debounceMs]);

  return { lastEvent };
}
