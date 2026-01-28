import * as React from 'react';
import { FileText, Trash2, Copy, Check, AlertCircle, Lock, User, Users } from 'lucide-react';
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

interface ParsedNote {
  timestamp: string | null;
  author: string | null;
  content: string;
  raw: string;
}

export function ReportNotesSection({ intervention }: ReportNotesSectionProps) {
  const [notes, setNotes] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);
  
  const notesKey = `intervention_notes_${intervention.id}`;
  
  // Check if intervention is locked (already invoiced)
  const isLocked = intervention.status === 'facture';

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
    if (isLocked) {
      toast.error('Intervention facturée - modifications non autorisées');
      return;
    }
    localStorage.removeItem(notesKey);
    setNotes('');
    toast.success('Notes du rapport effacées');
  };

  // Parse notes into individual entries with author info
  const noteEntries = React.useMemo((): ParsedNote[] => {
    if (!notes) return [];
    
    return notes.split('\n\n').filter(entry => entry.trim()).map(entry => {
      // Parse format: [timestamp] 👤 AuthorName\nContent
      const timestampMatch = entry.match(/^\[(.+?)\]\s*/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;
      
      let remaining = timestamp ? entry.replace(timestampMatch[0], '') : entry;
      
      // Parse author (👤 Name format)
      const authorMatch = remaining.match(/^👤\s*(.+?)(?:\n|$)/);
      const author = authorMatch ? authorMatch[1].trim() : null;
      
      const content = author ? remaining.replace(authorMatch[0], '').trim() : remaining.trim();
      
      return {
        timestamp,
        author,
        content,
        raw: entry
      };
    });
  }, [notes]);

  // Get unique authors
  const uniqueAuthors = React.useMemo(() => {
    const authors = noteEntries
      .map(n => n.author)
      .filter((a): a is string => a !== null);
    return [...new Set(authors)];
  }, [noteEntries]);

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
          {!isLocked && (
            <p className="text-xs text-muted-foreground mt-2">
              Plusieurs ouvriers peuvent ajouter des notes tant que l'intervention n'est pas facturée.
            </p>
          )}
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
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Intervention facturée - les notes sont en lecture seule.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg mb-4">
            <Users className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-xs text-green-700 dark:text-green-300">
              Plusieurs ouvriers peuvent ajouter des notes tant que l'intervention n'est pas facturée.
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
