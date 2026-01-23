import { useState } from 'react';
import { Zap, Clock, User, MapPin, Check, X, RefreshCw, Trophy, Plus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmergencyInterventions, EmergencyIntervention } from '@/hooks/useEmergencyInterventions';
import { CreateEmergencyFromList } from '@/components/emergency/CreateEmergencyFromList';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Disponible', color: 'bg-red-500', icon: <Zap className="h-3 w-3" /> },
  claimed: { label: 'Prise', color: 'bg-yellow-500', icon: <User className="h-3 w-3" /> },
  completed: { label: 'Terminée', color: 'bg-green-500', icon: <Check className="h-3 w-3" /> },
  cancelled: { label: 'Annulée', color: 'bg-muted', icon: <X className="h-3 w-3" /> },
};

function EmergencyCard({ 
  emergency, 
  onClaim, 
  onComplete,
  onCancel,
  isAdmin,
  claimingId 
}: { 
  emergency: EmergencyIntervention;
  onClaim: () => void;
  onComplete: () => void;
  onCancel: () => void;
  isAdmin: boolean;
  claimingId: string | null;
}) {
  const navigate = useNavigate();
  const status = statusConfig[emergency.status];
  const worker = localStorage.getItem('worker');
  const currentUserId = worker ? String(JSON.parse(worker).id) : '';
  const isMine = emergency.claimed_by_user_id === currentUserId;

  return (
    <Card className={cn(
      "transition-all",
      emergency.status === 'open' && "border-red-500 border-2 shadow-lg"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">
                {emergency.intervention_ref || `#${emergency.intervention_id}`}
              </CardTitle>
              <Badge className={cn(status.color, "text-white gap-1")}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            {emergency.intervention_label && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {emergency.intervention_label}
              </p>
            )}
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500 shrink-0">
            <Trophy className="h-3 w-3 mr-1" />
            +{emergency.bonus_amount} {emergency.currency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {emergency.client_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{emergency.client_name}</span>
          </div>
        )}

        {emergency.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{emergency.location}</span>
          </div>
        )}

        {emergency.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {emergency.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Créée {format(new Date(emergency.created_at), "dd MMM à HH:mm", { locale: fr })}
            {emergency.created_by_user_name && ` par ${emergency.created_by_user_name}`}
          </span>
        </div>

        {emergency.claimed_by_user_name && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3 text-yellow-500" />
            <span className="text-yellow-600 dark:text-yellow-400">
              Prise par {emergency.claimed_by_user_name}
              {emergency.claimed_at && ` à ${format(new Date(emergency.claimed_at), "HH:mm", { locale: fr })}`}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {emergency.status === 'open' && (
            <Button
              onClick={onClaim}
              disabled={claimingId === emergency.id}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              <Zap className="h-4 w-4 mr-2" />
              Je prends!
            </Button>
          )}

          {emergency.status === 'claimed' && isMine && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/intervention/${emergency.intervention_id}`)}
                className="flex-1"
              >
                Voir détails
              </Button>
              <Button
                onClick={onComplete}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Terminée
              </Button>
            </>
          )}

          {emergency.status === 'open' && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmergenciesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('open');
  const { 
    emergencies, 
    openEmergencies, 
    myClaimedEmergencies,
    isLoading, 
    claimingId,
    claimEmergency, 
    completeEmergency,
    cancelEmergency,
    refresh 
  } = useEmergencyInterventions();

  const isAdmin = (() => {
    try {
      const worker = localStorage.getItem('worker');
      return worker ? JSON.parse(worker).admin === '1' : false;
    } catch { return false; }
  })();

  const completedEmergencies = emergencies.filter(e => e.status === 'completed');
  const allClaimed = emergencies.filter(e => e.status === 'claimed');

  const handleClaim = async (emergency: EmergencyIntervention) => {
    const success = await claimEmergency(emergency.id);
    if (success) {
      navigate(`/intervention/${emergency.intervention_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header 
        title="Urgences" 
        showBack 
        rightAction={
          <Button variant="ghost" size="icon" onClick={refresh}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Admin: Create emergency button */}
        {isAdmin && (
          <CreateEmergencyFromList
            trigger={
              <Button className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white">
                <Plus className="h-5 w-5" />
                Créer une urgence avec bonus
              </Button>
            }
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-500">{openEmergencies.length}</div>
              <div className="text-xs text-muted-foreground">Disponibles</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-500">{myClaimedEmergencies.length}</div>
              <div className="text-xs text-muted-foreground">Mes urgences</div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-500">{completedEmergencies.length}</div>
              <div className="text-xs text-muted-foreground">Terminées</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="open" className="gap-1">
              <Zap className="h-4 w-4" />
              Disponibles
              {openEmergencies.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                  {openEmergencies.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="gap-1">
              <User className="h-4 w-4" />
              Mes prises
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Clock className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-3 mt-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))
            ) : openEmergencies.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Aucune urgence disponible</p>
                </CardContent>
              </Card>
            ) : (
              openEmergencies.map(emergency => (
                <EmergencyCard
                  key={emergency.id}
                  emergency={emergency}
                  onClaim={() => handleClaim(emergency)}
                  onComplete={() => completeEmergency(emergency.id)}
                  onCancel={() => cancelEmergency(emergency.id)}
                  isAdmin={isAdmin}
                  claimingId={claimingId}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-3 mt-4">
            {myClaimedEmergencies.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Vous n'avez pas d'urgence en cours</p>
                </CardContent>
              </Card>
            ) : (
              myClaimedEmergencies.map(emergency => (
                <EmergencyCard
                  key={emergency.id}
                  emergency={emergency}
                  onClaim={() => {}}
                  onComplete={() => completeEmergency(emergency.id)}
                  onCancel={() => {}}
                  isAdmin={isAdmin}
                  claimingId={claimingId}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {[...allClaimed, ...completedEmergencies].length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Aucun historique</p>
                </CardContent>
              </Card>
            ) : (
              [...allClaimed, ...completedEmergencies]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(emergency => (
                  <EmergencyCard
                    key={emergency.id}
                    emergency={emergency}
                    onClaim={() => {}}
                    onComplete={() => completeEmergency(emergency.id)}
                    onCancel={() => {}}
                    isAdmin={isAdmin}
                    claimingId={claimingId}
                  />
                ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
