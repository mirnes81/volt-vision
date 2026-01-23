import * as React from 'react';
import { Zap, Loader2, Search, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEmergencyInterventions } from '@/hooks/useEmergencyInterventions';
import { fetchInterventions } from '@/lib/dolibarrApi';
import { Intervention } from '@/types/intervention';

interface CreateEmergencyFromListProps {
  trigger?: React.ReactNode;
}

const BONUS_PRESETS = [50, 75, 100, 150, 200];

export function CreateEmergencyFromList({ trigger }: CreateEmergencyFromListProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'existing' | 'manual'>('existing');
  
  // Existing intervention selection
  const [interventions, setInterventions, ] = React.useState<Intervention[]>([]);
  const [isLoadingInterventions, setIsLoadingInterventions] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIntervention, setSelectedIntervention] = React.useState<Intervention | null>(null);
  
  // Manual entry
  const [manualRef, setManualRef] = React.useState('');
  const [manualLabel, setManualLabel] = React.useState('');
  const [manualClient, setManualClient] = React.useState('');
  const [manualLocation, setManualLocation] = React.useState('');
  
  // Shared
  const [bonusAmount, setBonusAmount] = React.useState(50);
  const [customBonus, setCustomBonus] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  
  const { createEmergency } = useEmergencyInterventions();

  // Load interventions when dialog opens
  React.useEffect(() => {
    if (open && interventions.length === 0) {
      loadInterventions();
    }
  }, [open]);

  const loadInterventions = async () => {
    setIsLoadingInterventions(true);
    try {
      const data = await fetchInterventions();
      // Filter only "en_cours" or "a_planifier" interventions
      const active = data.filter(i => i.status === 'en_cours' || i.status === 'a_planifier');
      setInterventions(active);
    } catch (err) {
      console.error('Error loading interventions:', err);
    } finally {
      setIsLoadingInterventions(false);
    }
  };

  const filteredInterventions = React.useMemo(() => {
    if (!searchQuery.trim()) return interventions;
    const query = searchQuery.toLowerCase();
    return interventions.filter(i => 
      i.ref?.toLowerCase().includes(query) ||
      i.label?.toLowerCase().includes(query) ||
      i.clientName?.toLowerCase().includes(query)
    );
  }, [interventions, searchQuery]);

  const handleCreate = async () => {
    const finalBonus = customBonus ? parseFloat(customBonus) : bonusAmount;
    
    if (isNaN(finalBonus) || finalBonus <= 0) {
      return;
    }

    setIsCreating(true);

    if (activeTab === 'existing' && selectedIntervention) {
      const success = await createEmergency({
        intervention_id: selectedIntervention.id,
        intervention_ref: selectedIntervention.ref,
        intervention_label: selectedIntervention.label,
        client_name: selectedIntervention.clientName,
        location: selectedIntervention.location,
        description: description || selectedIntervention.briefing,
        bonus_amount: finalBonus
      });

      if (success) {
        resetAndClose();
      }
    } else if (activeTab === 'manual') {
      if (!manualLabel.trim()) {
        setIsCreating(false);
        return;
      }

      const success = await createEmergency({
        intervention_id: Date.now(), // Use timestamp as temporary ID for manual entries
        intervention_ref: manualRef || `URG-${Date.now()}`,
        intervention_label: manualLabel,
        client_name: manualClient,
        location: manualLocation,
        description: description,
        bonus_amount: finalBonus
      });

      if (success) {
        resetAndClose();
      }
    }

    setIsCreating(false);
  };

  const resetAndClose = () => {
    setOpen(false);
    setSelectedIntervention(null);
    setDescription('');
    setCustomBonus('');
    setManualRef('');
    setManualLabel('');
    setManualClient('');
    setManualLocation('');
    setSearchQuery('');
  };

  const canCreate = activeTab === 'existing' 
    ? selectedIntervention !== null 
    : manualLabel.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-red-500 hover:bg-red-600">
            <Plus className="h-4 w-4" />
            Créer urgence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Zap className="h-5 w-5" />
            Créer un dépannage urgent
          </DialogTitle>
          <DialogDescription>
            Tous les techniciens recevront une alerte sonore. Le premier à réclamer recevra le bonus.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'manual')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Intervention existante</TabsTrigger>
            <TabsTrigger value="manual">Saisie manuelle</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="flex-1 flex flex-col min-h-0 mt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une intervention..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Intervention list */}
            <ScrollArea className="flex-1 border rounded-lg min-h-[200px] max-h-[250px]">
              {isLoadingInterventions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInterventions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Aucune intervention trouvée
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredInterventions.map((intervention) => (
                    <button
                      key={intervention.id}
                      onClick={() => setSelectedIntervention(intervention)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedIntervention?.id === intervention.id
                          ? 'bg-red-500/20 border-2 border-red-500'
                          : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium text-sm">{intervention.ref}</div>
                      <div className="text-sm text-muted-foreground truncate">{intervention.label}</div>
                      {intervention.clientName && (
                        <div className="text-xs text-muted-foreground mt-1">{intervention.clientName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-3">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Référence (optionnel)</Label>
                <Input
                  placeholder="Ex: URG-001"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description de l'urgence *</Label>
                <Input
                  placeholder="Ex: Panne électrique totale"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client (optionnel)</Label>
                <Input
                  placeholder="Nom du client"
                  value={manualClient}
                  onChange={(e) => setManualClient(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Adresse (optionnel)</Label>
                <Input
                  placeholder="Adresse de l'intervention"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Shared: Bonus and description */}
        <div className="space-y-3 pt-3 border-t">
          <div className="space-y-2">
            <Label>Montant du bonus (CHF)</Label>
            <div className="flex flex-wrap gap-2">
              {BONUS_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={bonusAmount === preset && !customBonus ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setBonusAmount(preset);
                    setCustomBonus('');
                  }}
                >
                  {preset} CHF
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ou</span>
              <Input
                type="number"
                placeholder="Montant personnalisé"
                value={customBonus}
                onChange={(e) => setCustomBonus(e.target.value)}
                className="w-32"
                min={1}
              />
              <span className="text-sm text-muted-foreground">CHF</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Détails supplémentaires (optionnel)</Label>
            <Textarea
              placeholder="Instructions pour le technicien..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={resetAndClose}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !canCreate}
            className="bg-red-500 hover:bg-red-600"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Diffuser l'urgence
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
