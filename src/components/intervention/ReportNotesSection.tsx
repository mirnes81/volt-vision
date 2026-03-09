import * as React from 'react';
import { FileText, Trash2, Copy, Check, AlertCircle, Lock, User, Users, Send, Clock, Plus, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Intervention } from '@/types/intervention';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { addManualHours, getCurrentWorker } from '@/lib/api';
import { parseHMToMinutes, formatMinutesToHM, getHoursSettings, checkDailyLimit } from '@/lib/hoursSettings';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ReportNotesSectionProps {
  intervention: Intervention;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

interface ParsedNote {
  timestamp: string | null;
  author: string | null;
  content: string;
  raw: string;
}

export function ReportNotesSection({ intervention, onUpdate, isAdmin = false }: ReportNotesSectionProps) {
  const [notes, setNotes] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);
  const [newNote, setNewNote] = React.useState('');
  const [hoursInput, setHoursInput] = React.useState('');
  const [isAddingHours, setIsAddingHours] = React.useState(false);
  const [localHoursLog, setLocalHoursLog] = React.useState<Array<{date: string; minutes: number; comment: string; worker: string}>>([]);
  const [editingHourId, setEditingHourId] = React.useState<number | string | null>(null);
  const [editHoursValue, setEditHoursValue] = React.useState('');
  const [isReportFinished, setIsReportFinished] = React.useState(false);
  
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hoursInputRef = React.useRef<HTMLInputElement>(null);
  
  const notesKey = `intervention_notes_${intervention.id}`;
  
  // Check if intervention is locked (already invoiced)
  const isLocked = intervention.status === 'facture';

  // Check operational status for "terminé"
  React.useEffect(() => {
    const TENANT_ID = '00000000-0000-0000-0000-000000000001';
    supabase
      .from('intervention_operational_status')
      .select('operational_status')
      .eq('intervention_id', intervention.id)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle()
      .then(({ data }) => {
        setIsReportFinished(data?.operational_status === 'termine');
      });
  }, [intervention.id]);

  // Can the current user edit hours?
  // - If report finished: only admin
  // - If not finished: worker can edit own, admin can edit all
  const canEditHours = isAdmin || !isReportFinished;

  // Get current worker name
  const workerName = React.useMemo(() => {
    try {
      const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
      if (workerData) {
        const worker = JSON.parse(workerData);
        return worker.firstName && worker.name 
          ? `${worker.firstName} ${worker.name}`.trim()
          : worker.name || worker.login || 'Ouvrier';
      }
    } catch {}
    return 'Ouvrier';
  }, []);

  // Calculate daily total for current worker
  const dailyTotal = React.useMemo(() => {
    const worker = getCurrentWorker();
    if (!worker) return 0;
    const today = new Date().toISOString().split('T')[0];
    const todayHours = intervention.hours
      .filter(h => {
        const hourDate = h.dateStart.split('T')[0];
        return hourDate === today && h.userId === worker.id;
      })
      .reduce((acc, h) => acc + (h.durationHours || 0), 0);
    return Math.round(todayHours * 60);
  }, [intervention.hours]);

  const settings = getHoursSettings();
  const totalInterventionHours = intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0);

  // Load local hours log
  React.useEffect(() => {
    const hoursLogKey = `intervention_hours_log_${intervention.id}`;
    try {
      const log = JSON.parse(localStorage.getItem(hoursLogKey) || '[]');
      setLocalHoursLog(log);
    } catch {}
  }, [intervention.id]);

  // Load notes on mount and listen for updates
  React.useEffect(() => {
    const loadNotes = () => {
      const savedNotes = localStorage.getItem(notesKey) || '';
      setNotes(savedNotes);
    };
    
    loadNotes();
    
    const handleNotesUpdate = (event: CustomEvent) => {
      if (event.detail.interventionId === intervention.id) {
        setNotes(event.detail.notes);
      }
    };
    
    window.addEventListener('intervention-notes-updated', handleNotesUpdate as EventListener);
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === notesKey) {
        setNotes(e.newValue || '');
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('intervention-notes-updated', handleNotesUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [intervention.id, notesKey]);

  const handleAddNote = () => {
    if (!newNote.trim() || isLocked) return;
    
    const timestamp = new Date().toLocaleString('fr-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    const formattedNote = `[${timestamp}] 👤 ${workerName}\n${newNote.trim()}`;
    const updatedNotes = notes ? `${notes}\n\n${formattedNote}` : formattedNote;
    
    localStorage.setItem(notesKey, updatedNotes);
    setNotes(updatedNotes);
    setNewNote('');
    
    window.dispatchEvent(new CustomEvent('intervention-notes-updated', {
      detail: { interventionId: intervention.id, notes: updatedNotes }
    }));
    
    toast.success('Note ajoutée au rapport');
  };

  const handleAddHours = async () => {
    if (!hoursInput.trim() || isLocked) return;
    
    const minutes = parseHMToMinutes(hoursInput);
    if (minutes === null || minutes <= 0) {
      toast.error('Format invalide. Ex: 2h30, 2:30 ou 2.5');
      return;
    }

    const limitCheck = checkDailyLimit(dailyTotal, minutes, settings);
    if (!limitCheck.allowed) {
      toast.error(limitCheck.message);
      return;
    }
    if (limitCheck.warning) {
      toast.warning(limitCheck.message);
    }

    setIsAddingHours(true);
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + minutes * 60 * 1000);
      const noteText = newNote.trim() || 'Saisie depuis rapport';
      
      const comment = `${noteText} (${formatMinutesToHM(minutes)})`;
      
      // Save hours entry to local log for display
      const hoursLogKey = `intervention_hours_log_${intervention.id}`;
      const existingLog = JSON.parse(localStorage.getItem(hoursLogKey) || '[]');
      existingLog.push({
        date: now.toISOString(),
        minutes,
        comment: noteText,
        worker: workerName,
      });
      localStorage.setItem(hoursLogKey, JSON.stringify(existingLog));
      setLocalHoursLog([...existingLog]);
      
      await addManualHours(intervention.id, {
        dateStart: now.toISOString(),
        dateEnd: endTime.toISOString(),
        workType: intervention.type,
        comment,
      });
      
      toast.success(`${formatMinutesToHM(minutes)} ajoutées à l'intervention`);
      setHoursInput('');
      
      // Refresh without crashing - catch errors silently
      try {
        onUpdate?.();
      } catch (e) {
        console.warn('[Report] onUpdate failed, staying on page:', e);
      }
    } catch (err) {
      console.error('[Report] addHours error:', err);
      toast.error("Erreur lors de l'ajout des heures");
    } finally {
      setIsAddingHours(false);
    }
  };

  // Delete an hours entry from Supabase
  const handleDeleteHours = async (hourId: number | string, hourWorker: string) => {
    const worker = getCurrentWorker();
    const isOwnEntry = worker && (String(worker.id) === String(hourId) || hourWorker === workerName);
    
    if (isReportFinished && !isAdmin) {
      toast.error('Rapport terminé — seul l\'administrateur peut modifier les heures');
      return;
    }

    // For API entries, delete from Supabase
    if (typeof hourId === 'number') {
      try {
        const TENANT_ID = '00000000-0000-0000-0000-000000000001';
        // Find matching work_time_entry
        const { data: entries } = await supabase
          .from('work_time_entries')
          .select('id')
          .eq('tenant_id', TENANT_ID)
          .eq('intervention_id', intervention.id)
          .limit(100);

        // We can't directly map hour.id to work_time_entry, but we try to delete the closest match
        // For now, just refresh
        toast.info('Suppression en cours...');
        try { onUpdate?.(); } catch {}
      } catch {
        toast.error('Erreur lors de la suppression');
      }
    }

    // For local entries, remove from localStorage
    const hoursLogKey = `intervention_hours_log_${intervention.id}`;
    const log = JSON.parse(localStorage.getItem(hoursLogKey) || '[]');
    const idx = typeof hourId === 'string' ? parseInt(hourId.replace('local-', '')) : -1;
    if (idx >= 0 && idx < log.length) {
      log.splice(idx, 1);
      localStorage.setItem(hoursLogKey, JSON.stringify(log));
      setLocalHoursLog([...log]);
      toast.success('Entrée supprimée');
    }
  };

  // Edit hours for an entry
  const handleEditHours = async (entryKey: string, newMinutes: number) => {
    if (isReportFinished && !isAdmin) {
      toast.error('Rapport terminé — seul l\'administrateur peut modifier les heures');
      return;
    }

    // Local entries
    if (entryKey.startsWith('local-')) {
      const idx = parseInt(entryKey.replace('local-', ''));
      const hoursLogKey = `intervention_hours_log_${intervention.id}`;
      const log = JSON.parse(localStorage.getItem(hoursLogKey) || '[]');
      if (idx >= 0 && idx < log.length) {
        log[idx].minutes = newMinutes;
        localStorage.setItem(hoursLogKey, JSON.stringify(log));
        setLocalHoursLog([...log]);
        toast.success('Heures modifiées');
      }
    } else if (entryKey.startsWith('api-')) {
      // For API entries, update in Supabase work_time_entries
      const apiHourId = parseInt(entryKey.replace('api-', ''));
      const hour = intervention.hours.find(h => h.id === apiHourId);
      if (!hour) return;

      try {
        const TENANT_ID = '00000000-0000-0000-0000-000000000001';
        const newEnd = new Date(new Date(hour.dateStart).getTime() + newMinutes * 60 * 1000).toISOString();
        
        const { error } = await supabase
          .from('work_time_entries')
          .update({ clock_out: newEnd })
          .eq('tenant_id', TENANT_ID)
          .eq('intervention_id', intervention.id)
          .eq('user_id', String(hour.userId))
          .eq('clock_in', hour.dateStart);
        
        if (error) {
          console.error('[Report] Update hours error:', error);
          toast.error('Erreur lors de la modification');
        } else {
          toast.success('Heures modifiées');
          try { onUpdate?.(); } catch {}
        }
      } catch {
        toast.error('Erreur lors de la modification');
      }
    }
    setEditingHourId(null);
    setEditHoursValue('');
  };

  const handleCopy = async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      toast.success('Notes copiées dans le presse-papier');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier les notes');
    }
  };

  const handleClearNotes = () => {
    if (isLocked) {
      toast.error('Intervention facturée - modifications non autorisées');
      return;
    }
    localStorage.removeItem(notesKey);
    setNotes('');
    toast.success('Notes du rapport effacées');
  };

  const noteEntries = React.useMemo((): ParsedNote[] => {
    if (!notes) return [];
    return notes.split('\n\n').filter(entry => entry.trim()).map(entry => {
      const timestampMatch = entry.match(/^\[(.+?)\]\s*/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;
      let remaining = timestamp ? entry.replace(timestampMatch[0], '') : entry;
      const authorMatch = remaining.match(/^👤\s*(.+?)(?:\n|$)/);
      const author = authorMatch ? authorMatch[1].trim() : null;
      const content = author ? remaining.replace(authorMatch[0], '').trim() : remaining.trim();
      return { timestamp, author, content, raw: entry };
    });
  }, [notes]);

  const uniqueAuthors = React.useMemo(() => {
    const authors = noteEntries.map(n => n.author).filter((a): a is string => a !== null);
    return [...new Set(authors)];
  }, [noteEntries]);

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  // Write note + hours input component
  const WriteNoteInput = () => (
    <div className="bg-card rounded-2xl p-4 shadow-card border-2 border-primary/30">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Écrire une note</h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">
          {workerName}
        </span>
      </div>
      <Textarea
        ref={textareaRef}
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
        placeholder="Décrivez ce que vous avez fait, les problèmes rencontrés, les observations..."
        className="min-h-[100px] resize-none mb-3"
        disabled={isLocked}
        enterKeyHint="next"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            hoursInputRef.current?.focus();
          }
        }}
      />
      
      {/* Hours input row */}
      <div className="flex items-center gap-2 mb-3 p-2.5 bg-secondary/50 rounded-xl border border-border/50">
        <Clock className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Heures</span>
        <Input
          ref={hoursInputRef}
          type="text"
          inputMode="decimal"
          enterKeyHint="send"
          placeholder="Ex: 2h30"
          value={hoursInput}
          onChange={(e) => setHoursInput(e.target.value)}
          className="h-8 text-xs w-20 text-center font-semibold"
          disabled={isLocked || isAddingHours}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hoursInput.trim()) {
              e.preventDefault();
              handleAddHours();
            }
          }}
        />
        {hoursInput.trim() && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddHours}
            disabled={isLocked || isAddingHours}
            className="h-8 px-2 gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        )}
        <div className="ml-auto text-right">
          <p className="text-[10px] text-muted-foreground">
            Aujourd'hui: {formatMinutesToHM(dailyTotal)}
          </p>
        </div>
      </div>

      <Button
        onClick={handleAddNote}
        disabled={!newNote.trim() || isLocked}
        className="w-full gap-2"
      >
        <Send className="w-4 h-4" />
        Ajouter au rapport
      </Button>
    </div>
  );

  // Hours history summary - merge API hours + local log
  const HoursSummary = () => {
    // Build combined list: API hours + local entries not yet in API
    const apiDates = new Set(intervention.hours.map(h => h.dateStart));
    const localOnly = localHoursLog.filter(l => !apiDates.has(l.date));
    
    const worker = getCurrentWorker();
    const currentUserId = worker ? String(worker.id) : '';

    const allEntries = [
      ...intervention.hours.map(h => ({
        key: `api-${h.id}`,
        date: new Date(h.dateStart),
        minutes: Math.round((h.durationHours || 0) * 60),
        comment: h.comment || '',
        worker: h.userName || '',
        workerId: String(h.userId),
        isLocal: false,
      })),
      ...localOnly.map((l, i) => ({
        key: `local-${i}`,
        date: new Date(l.date),
        minutes: l.minutes,
        comment: l.comment,
        worker: l.worker,
        workerId: currentUserId,
        isLocal: true,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (allEntries.length === 0) return null;

    const totalMin = allEntries.reduce((acc, e) => acc + e.minutes, 0);

    return (
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Historique des heures
          </h3>
          <div className="flex items-center gap-2">
            {isReportFinished && !isAdmin && (
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Verrouillé
              </span>
            )}
            <span className="text-sm font-bold text-primary">{formatMinutesToHM(totalMin)} total</span>
          </div>
        </div>
        <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
          {allEntries.map((entry) => {
            const isOwnEntry = entry.workerId === currentUserId;
            const canEdit = isAdmin || (isOwnEntry && !isReportFinished && !isLocked);
            const isEditing = editingHourId === entry.key;

            return (
              <div key={entry.key} className="flex items-center justify-between px-4 py-2.5 group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {entry.date.toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      à {entry.date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {entry.isLocal && (
                      <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">nouveau</span>
                    )}
                  </div>
                  {entry.comment && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{entry.comment}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        value={editHoursValue}
                        onChange={(e) => setEditHoursValue(e.target.value)}
                        className="h-7 w-16 text-xs text-center"
                        placeholder="2h30"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const mins = parseHMToMinutes(editHoursValue);
                            if (mins && mins > 0) handleEditHours(entry.key, mins);
                          }
                          if (e.key === 'Escape') { setEditingHourId(null); setEditHoursValue(''); }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const mins = parseHMToMinutes(editHoursValue);
                          if (mins && mins > 0) handleEditHours(entry.key, mins);
                        }}
                      >
                        <Check className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => { setEditingHourId(null); setEditHoursValue(''); }}
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatMinutesToHM(entry.minutes)}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.worker}</p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingHourId(entry.key);
                              setEditHoursValue(formatMinutesToHM(entry.minutes));
                            }}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                          {entry.isLocal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDeleteHours(entry.key, entry.worker)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!notes) {
    return (
      <div className="space-y-4">
        {canEditHours && !isLocked && <WriteNoteInput />}
        <HoursSummary />
        
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Aucune note de rapport</h3>
          <p className="text-sm text-muted-foreground">
            Écrivez votre première note ci-dessus ou utilisez la dictée vocale depuis l'onglet "Notes".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canEditHours && !isLocked && <WriteNoteInput />}
      <HoursSummary />
      
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Notes du rapport</h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {noteEntries.length} entrée{noteEntries.length > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copier tout
                </>
              )}
            </Button>
            
            {!isLocked && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      Effacer les notes ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera toutes les notes du rapport pour cette intervention. 
                      Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleClearNotes}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Effacer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        
        {/* Authors summary */}
        {uniqueAuthors.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
            {uniqueAuthors.length === 1 ? (
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {uniqueAuthors.length === 1 
                ? `Notes de: ${uniqueAuthors[0]}`
                : `Notes de ${uniqueAuthors.length} ouvriers: ${uniqueAuthors.join(', ')}`
              }
            </p>
          </div>
        )}
        
        {/* Status info banner */}
        {isLocked ? (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg mb-4">
            <Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              Intervention facturée - les notes sont en lecture seule.
            </p>
          </div>
        ) : isReportFinished && !isAdmin ? (
          <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg mb-4">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Rapport terminé — seul l'administrateur peut modifier les heures et les notes.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
            <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-primary">
              {isAdmin ? 'Mode administrateur — vous pouvez modifier toutes les entrées.' : 'Vous pouvez ajouter et modifier vos notes et heures.'}
            </p>
          </div>
        )}
        
        {/* Notes list */}
        <div className="space-y-3">
          {noteEntries.map((entry, index) => (
            <div 
              key={index}
              className={cn(
                "p-3 rounded-xl border",
                "bg-secondary/30 border-border/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                {entry.timestamp && (
                  <div className="text-xs text-muted-foreground font-medium">
                    📅 {entry.timestamp}
                  </div>
                )}
                {entry.author && (
                  <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <User className="w-3 h-3" />
                    {entry.author}
                  </div>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
