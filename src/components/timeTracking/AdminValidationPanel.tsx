import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, X, Clock, User, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { WorkTimeEntry, WORK_TYPES } from '@/types/timeTracking';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AdminValidationPanelProps {
  entries: WorkTimeEntry[];
  onApprove: (entryId: string) => Promise<void>;
  onReject: (entryId: string, reason: string) => Promise<void>;
  onBulkApprove: (entryIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function AdminValidationPanel({
  entries,
  onApprove,
  onReject,
  onBulkApprove,
  isLoading,
}: AdminValidationPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingEntry, setRejectingEntry] = useState<WorkTimeEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isActing, setIsActing] = useState(false);

  const pendingEntries = entries.filter(e => e.status === 'pending' && e.clock_out);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === pendingEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEntries.map(e => e.id)));
    }
  };

  const handleApprove = async (entryId: string) => {
    setIsActing(true);
    try {
      await onApprove(entryId);
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingEntry || !rejectReason.trim()) return;
    
    setIsActing(true);
    try {
      await onReject(rejectingEntry.id, rejectReason);
      setRejectingEntry(null);
      setRejectReason('');
    } finally {
      setIsActing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    setIsActing(true);
    try {
      await onBulkApprove([...selectedIds]);
      setSelectedIds(new Set());
    } finally {
      setIsActing(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--:--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Tout est validé !</h3>
        <p className="text-muted-foreground">Aucune entrée en attente de validation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedIds.size === pendingEntries.length && pendingEntries.length > 0}
            onCheckedChange={selectAll}
          />
          <span className="text-sm font-medium">
            {selectedIds.size > 0 
              ? `${selectedIds.size} sélectionné(s)`
              : `${pendingEntries.length} en attente`}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <Button
            onClick={handleBulkApprove}
            disabled={isActing}
            size="sm"
            className="gap-2"
          >
            {isActing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Valider la sélection
          </Button>
        )}
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {pendingEntries.map((entry) => {
          const workTypeLabel = WORK_TYPES.find(t => t.value === entry.work_type)?.label || entry.work_type;

          return (
            <div
              key={entry.id}
              className={cn(
                'bg-card border rounded-xl p-4',
                selectedIds.has(entry.id) && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(entry.id)}
                  onCheckedChange={() => toggleSelection(entry.id)}
                  className="mt-1"
                />
                
                <div className="flex-1 min-w-0 space-y-3">
                  {/* User and date */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{entry.user_name || 'Inconnu'}</span>
                    </div>
                    <Badge variant="outline">
                      {format(new Date(entry.clock_in), 'EEEE d MMMM', { locale: fr })}
                    </Badge>
                  </div>

                  {/* Time details */}
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Type</p>
                      <p className="font-medium">{workTypeLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Entrée</p>
                      <p className="font-medium">{format(new Date(entry.clock_in), 'HH:mm')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Sortie</p>
                      <p className="font-medium">
                        {entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '--:--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Durée</p>
                      <p className="font-semibold text-primary">{formatDuration(entry.duration_minutes)}</p>
                    </div>
                  </div>

                  {/* Intervention link */}
                  {entry.intervention_ref && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{entry.intervention_ref}</Badge>
                    </div>
                  )}

                  {/* Comment */}
                  {entry.comment && (
                    <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                      {entry.comment}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => handleApprove(entry.id)}
                      disabled={isActing}
                      size="sm"
                      className="gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Valider
                    </Button>
                    <Button
                      onClick={() => setRejectingEntry(entry)}
                      disabled={isActing}
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                      Rejeter
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectingEntry} onOpenChange={() => setRejectingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Rejeter l'entrée
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {rejectingEntry && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                <p><strong>{rejectingEntry.user_name}</strong></p>
                <p className="text-muted-foreground">
                  {format(new Date(rejectingEntry.clock_in), 'EEEE d MMMM', { locale: fr })} •{' '}
                  {formatDuration(rejectingEntry.duration_minutes)}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Motif du rejet *</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Indiquez la raison du rejet..."
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingEntry(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || isActing}
              variant="destructive"
            >
              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
