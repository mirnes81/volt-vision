import * as React from 'react';
import { Settings, Save, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserWeeklyLimitSettingProps {
  userId: string;
  userName?: string;
  tenantId: string;
  currentLimit?: number;
  onUpdate?: () => void;
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function UserWeeklyLimitSetting({
  userId,
  userName,
  tenantId = DEFAULT_TENANT_ID,
  currentLimit = 42,
  onUpdate,
}: UserWeeklyLimitSettingProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [hours, setHours] = React.useState(String(Math.floor(currentLimit)));
  const [minutes, setMinutes] = React.useState(String(Math.round((currentLimit % 1) * 60)));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setHours(String(Math.floor(currentLimit)));
    setMinutes(String(Math.round((currentLimit % 1) * 60)));
  }, [currentLimit]);

  const handleSave = async () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalHours = h + m / 60;

    if (totalHours <= 0 || totalHours > 80) {
      toast({
        title: 'Erreur',
        description: 'La limite doit être entre 1 et 80 heures',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_weekly_limits')
        .upsert({
          tenant_id: tenantId,
          user_id: userId,
          weekly_hours_limit: totalHours,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,user_id',
        });

      if (error) throw error;

      toast({
        title: 'Limite mise à jour',
        description: `Nouvelle limite : ${h}h${m > 0 ? m + 'min' : ''} / semaine`,
      });

      setOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error saving weekly limit:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la limite',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Limite hebdo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Limite hebdomadaire
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {userName && (
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{userName}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Heures maximum par semaine</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="0"
                max="80"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20"
              />
              <span className="text-muted-foreground">h</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20"
              />
              <span className="text-muted-foreground">min</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Les heures au-delà de cette limite seront comptées comme supplémentaires.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
