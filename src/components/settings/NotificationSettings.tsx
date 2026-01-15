import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { notifications } from '@/lib/pushNotifications';
import { toast } from '@/components/ui/sonner';

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Notifications désactivées');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Notifications activées');
        // Send test notification
        setTimeout(() => {
          notifications.syncComplete(0);
        }, 1000);
      }
    }
  };

  const sendTestNotification = () => {
    notifications.newIntervention('INT-2024-TEST', 'Client Test');
    toast.success('Notification test envoyée');
  };

  if (!isSupported) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <BellOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Notifications push</h3>
            <p className="text-sm text-muted-foreground">
              Non disponible sur cet appareil/navigateur
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 space-y-4">
      {/* Main Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-primary/10' : 'bg-muted'
          }`}>
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : isSubscribed ? (
              <BellRing className="w-6 h-6 text-primary" />
            ) : (
              <Bell className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">Notifications push</h3>
            <p className="text-sm text-muted-foreground">
              {permission === 'denied' 
                ? 'Bloquées dans les paramètres'
                : isSubscribed 
                  ? 'Activées' 
                  : 'Désactivées'
              }
            </p>
          </div>
        </div>
        <Switch
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={isLoading || permission === 'denied'}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Permission Blocked Warning */}
      {permission === 'denied' && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
          <p className="text-sm text-warning-foreground">
            Les notifications sont bloquées. Modifiez les permissions dans les paramètres de votre navigateur.
          </p>
        </div>
      )}

      {/* Notification Types */}
      {isSubscribed && (
        <div className="space-y-3 pt-2 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground">Types de notifications</h4>
          
          <NotificationTypeToggle
            label="Nouvelles interventions"
            description="Quand une intervention vous est assignée"
            defaultChecked={true}
          />
          
          <NotificationTypeToggle
            label="Interventions urgentes"
            description="Alertes pour les urgences"
            defaultChecked={true}
          />
          
          <NotificationTypeToggle
            label="Rappels"
            description="Rappels avant les interventions"
            defaultChecked={true}
          />
          
          <NotificationTypeToggle
            label="Stock bas"
            description="Alertes de stock véhicule"
            defaultChecked={false}
          />
          
          <NotificationTypeToggle
            label="Synchronisation"
            description="Confirmation de sync des données"
            defaultChecked={false}
          />
        </div>
      )}

      {/* Test Button */}
      {isSubscribed && (
        <Button
          variant="outline"
          size="sm"
          onClick={sendTestNotification}
          className="w-full"
        >
          <Bell className="w-4 h-4 mr-2" />
          Envoyer notification test
        </Button>
      )}
    </div>
  );
}

interface NotificationTypeToggleProps {
  label: string;
  description: string;
  defaultChecked: boolean;
}

function NotificationTypeToggle({ label, description, defaultChecked }: NotificationTypeToggleProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
