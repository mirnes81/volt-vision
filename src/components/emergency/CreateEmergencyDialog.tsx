import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
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
import { useEmergencyInterventions } from '@/hooks/useEmergencyInterventions';
import { Intervention } from '@/types/intervention';

interface CreateEmergencyDialogProps {
  intervention: Intervention;
  trigger?: React.ReactNode;
}

const BONUS_PRESETS = [50, 75, 100, 150, 200];

export function CreateEmergencyDialog({ intervention, trigger }: CreateEmergencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(50);
  const [customBonus, setCustomBonus] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createEmergency } = useEmergencyInterventions();

  const handleCreate = async () => {
    const finalBonus = customBonus ? parseFloat(customBonus) : bonusAmount;
    
    if (isNaN(finalBonus) || finalBonus <= 0) {
      return;
    }

    setIsCreating(true);
    const success = await createEmergency({
      intervention_id: intervention.id,
      intervention_ref: intervention.ref,
      intervention_label: intervention.label,
      client_name: intervention.clientName,
      location: intervention.location,
      description: description || intervention.briefing,
      bonus_amount: finalBonus
    });

    setIsCreating(false);
    if (success) {
      setOpen(false);
      setDescription('');
      setCustomBonus('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" className="gap-2">
            <Zap className="h-4 w-4" />
            Créer urgence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Zap className="h-5 w-5" />
            Créer un dépannage urgent
          </DialogTitle>
          <DialogDescription>
            Tous les techniciens recevront une alerte. Le premier à réclamer l'urgence recevra le bonus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Intervention info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="font-medium">{intervention.ref}</div>
            <div className="text-sm text-muted-foreground">{intervention.label}</div>
            {intervention.clientName && (
              <div className="text-sm text-muted-foreground mt-1">{intervention.clientName}</div>
            )}
          </div>

          {/* Bonus amount */}
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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">ou</span>
              <Input
                type="number"
                placeholder="Montant personnalisé"
                value={customBonus}
                onChange={(e) => setCustomBonus(e.target.value)}
                className="w-40"
                min={1}
              />
              <span className="text-sm text-muted-foreground">CHF</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description supplémentaire (optionnel)</Label>
            <Textarea
              placeholder="Détails sur l'urgence..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="bg-red-500 hover:bg-red-600"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
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
