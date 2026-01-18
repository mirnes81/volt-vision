import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Clock, FileText, Loader2, X, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WORK_TYPES } from '@/types/timeTracking';
import { useInterventionsCache } from '@/hooks/useInterventionsCache';
import { cn } from '@/lib/utils';

interface ManualTimeEntryProps {
  onSubmit: (data: {
    date: string;
    duration_minutes: number;
    work_type: string;
    intervention_id?: number;
    intervention_ref?: string;
    comment?: string;
  }) => Promise<boolean>;
  weeklyLimit?: number;
  currentWeekMinutes?: number;
}

export function ManualTimeEntry({ onSubmit, weeklyLimit = 2520, currentWeekMinutes = 0 }: ManualTimeEntryProps) {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Form state
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = React.useState('');
  const [minutes, setMinutes] = React.useState('');
  const [workType, setWorkType] = React.useState('intervention');
  const [comment, setComment] = React.useState('');
  
  // Intervention selection
  const [showInterventionPicker, setShowInterventionPicker] = React.useState(false);
  const [interventionSearch, setInterventionSearch] = React.useState('');
  const [selectedIntervention, setSelectedIntervention] = React.useState<{
    id: number;
    ref: string;
    label: string;
    clientName: string;
  } | null>(null);

  const { interventions } = useInterventionsCache(true);

  // Filter interventions
  const filteredInterventions = React.useMemo(() => {
    if (!interventionSearch) return interventions.slice(0, 10);
    const searchLower = interventionSearch.toLowerCase();
    return interventions
      .filter(i => 
        i.ref.toLowerCase().includes(searchLower) ||
        i.label.toLowerCase().includes(searchLower) ||
        i.clientName.toLowerCase().includes(searchLower)
      )
      .slice(0, 10);
  }, [interventions, interventionSearch]);

  // Calculate total duration
  const totalMinutes = React.useMemo(() => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    return h * 60 + m;
  }, [hours, minutes]);

  // Check if this will create overtime
  const willBeOvertime = currentWeekMinutes + totalMinutes > weeklyLimit;
  const overtimeMinutes = Math.max(0, currentWeekMinutes + totalMinutes - weeklyLimit);

  const resetForm = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setHours('');
    setMinutes('');
    setWorkType('intervention');
    setComment('');
    setSelectedIntervention(null);
    setShowInterventionPicker(false);
    setInterventionSearch('');
  };

  const handleSubmit = async () => {
    if (totalMinutes <= 0) return;

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        date,
        duration_minutes: totalMinutes,
        work_type: workType,
        intervention_id: selectedIntervention?.id,
        intervention_ref: selectedIntervention?.ref,
        comment: comment || undefined,
      });

      if (success) {
        resetForm();
        setOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Saisir des heures
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Saisie manuelle d'heures
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Durée</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="24"
                  placeholder="Heures"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <span className="flex items-center text-muted-foreground">h</span>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Min"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <span className="flex items-center text-muted-foreground">min</span>
            </div>
            {totalMinutes > 0 && (
              <p className="text-sm text-muted-foreground">
                Total : {Math.floor(totalMinutes / 60)}h{(totalMinutes % 60).toString().padStart(2, '0')}
              </p>
            )}
          </div>

          {/* Overtime warning */}
          {willBeOvertime && totalMinutes > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Heures supplémentaires détectées
                </p>
                <p className="text-muted-foreground">
                  {Math.floor(overtimeMinutes / 60)}h{(overtimeMinutes % 60).toString().padStart(2, '0')} seront comptées en heures sup.
                </p>
              </div>
            </div>
          )}

          {/* Work type */}
          <div className="space-y-2">
            <Label>Type de travail</Label>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Intervention selection */}
          <div className="space-y-2">
            <Label>Intervention (optionnel)</Label>
            {selectedIntervention ? (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1">{selectedIntervention.ref}</Badge>
                    <p className="font-medium text-sm truncate">{selectedIntervention.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedIntervention.clientName}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => setSelectedIntervention(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une intervention..."
                    value={interventionSearch}
                    onChange={(e) => {
                      setInterventionSearch(e.target.value);
                      setShowInterventionPicker(true);
                    }}
                    onFocus={() => setShowInterventionPicker(true)}
                    className="pl-10"
                  />
                </div>
                
                {showInterventionPicker && filteredInterventions.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1">
                    {filteredInterventions.map((intervention) => (
                      <button
                        key={intervention.id}
                        type="button"
                        onClick={() => {
                          setSelectedIntervention({
                            id: intervention.id,
                            ref: intervention.ref,
                            label: intervention.label,
                            clientName: intervention.clientName,
                          });
                          setShowInterventionPicker(false);
                          setInterventionSearch('');
                        }}
                        className="w-full text-left p-2 rounded-md hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {intervention.ref}
                          </Badge>
                          <span className="text-sm truncate">{intervention.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate pl-1">
                          {intervention.clientName}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire (optionnel)</Label>
            <Textarea
              id="comment"
              placeholder="Description du travail effectué..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || totalMinutes <= 0}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter {totalMinutes > 0 && `(${Math.floor(totalMinutes / 60)}h${(totalMinutes % 60).toString().padStart(2, '0')})`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
