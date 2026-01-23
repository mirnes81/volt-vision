import { useState, useEffect } from 'react';
import { Zap, X, MapPin, User, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEmergencyInterventions, EmergencyIntervention } from '@/hooks/useEmergencyInterventions';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function EmergencyAlertToast() {
  const navigate = useNavigate();
  const { openEmergencies, claimEmergency, claimingId } = useEmergencyInterventions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-expand when new emergencies arrive
  useEffect(() => {
    if (openEmergencies.length > 0 && !hasInteracted) {
      setIsExpanded(true);
    }
  }, [openEmergencies.length, hasInteracted]);

  if (openEmergencies.length === 0) return null;

  const handleClaim = async (emergency: EmergencyIntervention) => {
    const success = await claimEmergency(emergency.id);
    if (success) {
      navigate(`/intervention/${emergency.intervention_id}`);
    }
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setHasInteracted(true);
  };

  // Collapsed state
  if (!isExpanded) {
    return (
      <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-14 gap-2 bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse"
        >
          <Zap className="h-5 w-5" />
          <span className="font-bold">{openEmergencies.length} Urgence{openEmergencies.length > 1 ? 's' : ''}</span>
          <Badge variant="secondary" className="bg-white text-red-500 ml-1">
            Bonus!
          </Badge>
        </Button>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="fixed bottom-20 right-4 left-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <Card className="border-2 border-red-500 shadow-2xl bg-background">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Zap className="h-5 w-5 animate-pulse" />
            Urgences disponibles
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCollapse}
            className="h-8 w-8"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
          {openEmergencies.map((emergency) => (
            <div
              key={emergency.id}
              className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {emergency.intervention_ref || `#${emergency.intervention_id}`}
                  </div>
                  {emergency.intervention_label && (
                    <div className="text-sm text-muted-foreground truncate">
                      {emergency.intervention_label}
                    </div>
                  )}
                </div>
                <Badge className="bg-green-500 hover:bg-green-500 text-white shrink-0">
                  +{emergency.bonus_amount} {emergency.currency}
                </Badge>
              </div>

              {emergency.client_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{emergency.client_name}</span>
                </div>
              )}

              {emergency.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{emergency.location}</span>
                </div>
              )}

              {emergency.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {emergency.description}
                </p>
              )}

              <Button
                onClick={() => handleClaim(emergency)}
                disabled={claimingId === emergency.id}
                className="w-full bg-red-500 hover:bg-red-600 text-white"
              >
                {claimingId === emergency.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Réclamation...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Je prends cette urgence!
                  </>
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
