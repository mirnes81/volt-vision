import * as React from 'react';
import { Calendar, Clock, Loader2, Edit2, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface DateEditDialogProps {
  interventionId: number;
  currentDate?: string;
  onDateUpdated: () => void;
}

// Save date override locally as fallback
function saveDateOverride(interventionId: number, date: Date) {
  const key = `intervention_date_override_${interventionId}`;
  localStorage.setItem(key, date.toISOString());
}

// Get local date override if exists
export function getDateOverride(interventionId: number): string | null {
  const key = `intervention_date_override_${interventionId}`;
  return localStorage.getItem(key);
}

// Clear local override after successful Dolibarr update
function clearDateOverride(interventionId: number) {
  const key = `intervention_date_override_${interventionId}`;
  localStorage.removeItem(key);
}

export function DateEditDialog({ interventionId, currentDate, onDateUpdated }: DateEditDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [selectedHour, setSelectedHour] = React.useState<string>(
    currentDate ? new Date(currentDate).getHours().toString().padStart(2, '0') : '08'
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    currentDate ? new Date(currentDate).getMinutes().toString().padStart(2, '0') : '00'
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [updateResult, setUpdateResult] = React.useState<'success' | 'local' | null>(null);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open && currentDate) {
      const override = getDateOverride(interventionId);
      const dateToUse = override || currentDate;
      const date = new Date(dateToUse);
      setSelectedDate(date);
      setSelectedHour(date.getHours().toString().padStart(2, '0'));
      setSelectedMinute(date.getMinutes().toString().padStart(2, '0'));
      setUpdateResult(null);
    }
  }, [open, currentDate, interventionId]);

  const handleSave = async () => {
    if (!selectedDate) {
      toast.error('Veuillez selectionner une date');
      return;
    }

    setIsLoading(true);
    setUpdateResult(null);

    // Build the new date with time
    const newDate = new Date(selectedDate);
    newDate.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
    
    // Convert to Unix timestamp for Dolibarr
    const timestamp = Math.floor(newDate.getTime() / 1000);
    
    try {
      // Try to update in Dolibarr via edge function
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: {
          action: 'update-intervention-date',
          params: {
            interventionId,
            dateStart: timestamp,
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Success! Clear any local override
        clearDateOverride(interventionId);
        setUpdateResult('success');
        toast.success('Date modifiee dans Dolibarr!', {
          description: format(newDate, "EEEE d MMMM yyyy 'a' HH:mm", { locale: fr }),
        });
        
        setTimeout(() => {
          setOpen(false);
          onDateUpdated();
        }, 1500);
        return;
      }

      // API doesn't support this - expected behavior, save locally
      saveDateOverride(interventionId, newDate);
      setUpdateResult('local');
      
      // Show info toast (not warning/error - this is expected)
      toast.info('Date enregistree localement', {
        description: 'Cliquez sur le lien pour mettre a jour dans Dolibarr.',
      });
      
    } catch (err: any) {
      console.log('Dolibarr API limitation - saving locally:', err);
      
      // Fallback: Save locally - this is expected behavior
      saveDateOverride(interventionId, newDate);
      setUpdateResult('local');
      
      toast.info('Date enregistree localement', {
        description: 'Utilisez le lien pour mettre a jour dans Dolibarr.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openInDolibarr = () => {
    const url = `https://crm.enes-electricite.ch/fichinter/card.php?id=${interventionId}`;
    window.open(url, '_blank');
  };

  // Generate hours options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Modifier la date d'intervention
          </DialogTitle>
          <DialogDescription>
            Selectionnez une nouvelle date et heure pour cette intervention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Success message */}
          {updateResult === 'success' && (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Date mise a jour dans Dolibarr avec succes!
              </p>
            </div>
          )}
          
          {/* Local save info - this is expected behavior, not an error */}
          {updateResult === 'local' && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  Date enregistree localement
                </p>
                <p className="text-blue-700 dark:text-blue-400 mt-1">
                  L'API Dolibarr ne permet pas les modifications directes. 
                  Cliquez sur "Ouvrir dans Dolibarr" pour finaliser le changement.
                </p>
              </div>
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={isLoading || updateResult === 'success'}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                  ) : (
                    <span>Selectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Heure
            </label>
            <div className="flex gap-2">
              <Select value={selectedHour} onValueChange={setSelectedHour} disabled={isLoading || updateResult === 'success'}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Heure" />
                </SelectTrigger>
                <SelectContent>
                  {hours.map(hour => (
                    <SelectItem key={hour} value={hour}>
                      {hour}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="self-center text-lg font-medium">:</span>
              <Select value={selectedMinute} onValueChange={setSelectedMinute} disabled={isLoading || updateResult === 'success'}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map(min => (
                    <SelectItem key={min} value={min}>
                      {min}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {selectedDate && !updateResult && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium text-primary">
                Nouvelle date:
              </p>
              <p className="text-lg font-bold">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })} a {selectedHour}:{selectedMinute}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {updateResult === 'local' && (
            <Button 
              variant="outline" 
              onClick={openInDolibarr}
              className="gap-2 w-full sm:w-auto"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir dans Dolibarr
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {updateResult ? 'Fermer' : 'Annuler'}
            </Button>
            {!updateResult && (
              <Button onClick={handleSave} disabled={!selectedDate || isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
