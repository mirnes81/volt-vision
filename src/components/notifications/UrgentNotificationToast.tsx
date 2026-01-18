import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, X, MapPin, Calendar, Check, Bell, Volume2 } from 'lucide-react';
import { useUrgentNotifications } from '@/hooks/useUrgentNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function UrgentNotificationToast() {
  const { notifications, unacknowledgedCount, acknowledgeNotification, acknowledgeAll } = useUrgentNotifications();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);

  // Auto-expand when new notifications arrive
  React.useEffect(() => {
    if (notifications.length > 0 && !hasInteracted) {
      setIsExpanded(true);
    }
  }, [notifications.length, hasInteracted]);

  if (notifications.length === 0) return null;

  const priorityConfig = {
    critical: { color: 'bg-red-500', textColor: 'text-red-500', label: 'CRITIQUE' },
    urgent: { color: 'bg-orange-500', textColor: 'text-orange-500', label: 'URGENT' },
    normal: { color: 'bg-blue-500', textColor: 'text-blue-500', label: 'Normal' },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-sm w-full animate-in slide-in-from-top-2">
      {/* Collapsed badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="ml-auto flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-3 rounded-xl shadow-lg hover:bg-destructive/90 transition-colors animate-pulse"
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">{unacknowledgedCount} intervention(s) urgente(s)</span>
          <Bell className="w-4 h-4" />
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div className="bg-card border-2 border-destructive rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">Interventions urgentes</span>
              <Badge variant="secondary" className="bg-white/20">
                {unacknowledgedCount}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 animate-pulse" />
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setHasInteracted(true);
                }}
                className="hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.map(({ assignment, isReminder }) => {
              const config = priorityConfig[assignment.priority];
              
              return (
                <div
                  key={assignment.id}
                  className={cn(
                    'p-4 border-b border-border last:border-b-0',
                    assignment.priority === 'critical' && 'bg-red-500/5'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-2 h-full min-h-[60px] rounded-full', config.color)} />
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('text-xs', config.color)}>
                              {config.label}
                            </Badge>
                            {isReminder && (
                              <Badge variant="outline" className="text-xs">
                                Rappel #{assignment.reminder_count}
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold mt-1 text-sm">
                            {assignment.intervention_ref}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-foreground line-clamp-2">
                        {assignment.intervention_label}
                      </p>

                      {assignment.client_name && (
                        <p className="text-xs text-muted-foreground">
                          Client: {assignment.client_name}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {assignment.date_planned && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(assignment.date_planned), 'dd/MM HH:mm', { locale: fr })}
                          </span>
                        )}
                        {assignment.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {assignment.location.substring(0, 20)}...
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          to={`/intervention/${assignment.intervention_id || assignment.autonomous_intervention_id}`}
                          className="flex-1"
                        >
                          <Button size="sm" className="w-full text-xs">
                            Voir l'intervention
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeNotification(assignment.id)}
                          className="text-xs"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {notifications.length > 1 && (
            <div className="p-3 border-t border-border bg-secondary/30">
              <Button
                variant="outline"
                size="sm"
                onClick={acknowledgeAll}
                className="w-full gap-2"
              >
                <Check className="w-4 h-4" />
                Tout acquitter
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
