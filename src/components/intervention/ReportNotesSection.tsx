import * as React from 'react';
import { FileText, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
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
}

export function ReportNotesSection({ intervention }: ReportNotesSectionProps) {
  const [notes, setNotes] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);
  
  const notesKey = `intervention_notes_${intervention.id}`;

  // Load notes on mount and listen for updates
  React.useEffect(() => {
    const loadNotes = () => {
      const savedNotes = localStorage.getItem(notesKey) || '';
      setNotes(savedNotes);
    };
    
    loadNotes();
    
    // Listen for custom event from VoiceNotesSection
    const handleNotesUpdate = (event: CustomEvent) => {
      if (event.detail.interventionId === intervention.id) {
        setNotes(event.detail.notes);
      }
    };
    
    window.addEventListener('intervention-notes-updated', handleNotesUpdate as EventListener);
    
    // Also listen for storage changes (cross-tab sync)
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

  const handleCopy = async () => {
    if (!notes) return;
    
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      toast.success('Notes copiées dans le presse-papier');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Impossible de copier les notes');
    }
  };

  const handleClearNotes = () => {
    localStorage.removeItem(notesKey);
    setNotes('');
    toast.success('Notes du rapport effacées');
  };

  // Parse notes into individual entries
  const noteEntries = React.useMemo(() => {
    if (!notes) return [];
    return notes.split('\n\n').filter(entry => entry.trim());
  }, [notes]);

  if (!notes) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Aucune note de rapport</h3>
          <p className="text-sm text-muted-foreground">
            Les transcriptions vocales ajoutées depuis l'onglet "Notes vocales" apparaîtront ici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
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
          </div>
        </div>
        
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Ces notes sont stockées localement. L'API Dolibarr ne permet pas la synchronisation automatique des notes d'intervention.
          </p>
        </div>
        
        {/* Notes list */}
        <div className="space-y-3">
          {noteEntries.map((entry, index) => {
            // Parse timestamp if present
            const timestampMatch = entry.match(/^\[(.+?)\]\s*/);
            const timestamp = timestampMatch ? timestampMatch[1] : null;
            const content = timestamp ? entry.replace(timestampMatch[0], '') : entry;
            
            return (
              <div 
                key={index}
                className={cn(
                  "p-3 rounded-xl border",
                  "bg-secondary/30 border-border/50"
                )}
              >
                {timestamp && (
                  <div className="text-xs text-muted-foreground mb-1.5 font-medium">
                    📅 {timestamp}
                  </div>
                )}
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {content}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}