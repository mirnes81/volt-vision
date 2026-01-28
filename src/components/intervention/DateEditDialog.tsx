import * as React from 'react';
import { Calendar, Clock, Loader2, Edit2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateEditDialogProps {
  interventionId: number;
  currentDate?: string;
  onDateUpdated: () => void;
}

export function DateEditDialog({ interventionId, currentDate, onDateUpdated }: DateEditDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [selectedHour, setSelectedHour] = React.useState<string>(
    currentDate ? new Date(currentDate).getHours().toString().padStart(2, '0') : '08'
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    currentDate ? new Date(currentDate).getMinutes().toString().padStart(2, '0') : '00'
  );

  // Reset when dialog opens
  React.useEffect(() => {
    if (open && currentDate) {
      const date = new Date(currentDate);
      setSelectedDate(date);
      setSelectedHour(date.getHours().toString().padStart(2, '0'));
      setSelectedMinute(date.getMinutes().toString().padStart(2, '0'));
    }
  }, [open, currentDate]);

  const handleSave = async () => {
    if (!selectedDate) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setIsLoading(true);

    try {
      // Build the new date with time
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
      
      // Convert to Unix timestamp for Dolibarr
      const unixTimestamp = Math.floor(newDate.getTime() / 1000);

      // Call the edge function to update the intervention date in Dolibarr
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: {
          action: 'update-intervention-date',
          params: {
            interventionId,
            dateStart: unixTimestamp
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Date modifiée avec succès');
      setOpen(false);
      onDateUpdated();
    } catch (error) {
      console.error('Error updating date:', error);
      toast.error('Erreur lors de la modification de la date');
    } finally {
      setIsLoading(false);
    }
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
            Sélectionnez une nouvelle date et heure pour cette intervention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
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
              <Select value={selectedHour} onValueChange={setSelectedHour}>
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
              <Select value={selectedMinute} onValueChange={setSelectedMinute}>
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
          {selectedDate && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium text-primary">
                Nouvelle date:
              </p>
              <p className="text-lg font-bold">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })} à {selectedHour}:{selectedMinute}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !selectedDate}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
