import * as React from 'react';
import { Mic, Square, Play, Pause, Trash2, MicOff, FileText, Loader2, Copy, Send, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { saveVoiceNote, getVoiceNotes, deleteVoiceNote } from '@/lib/offlineStorage';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isOnline } from '@/lib/offlineStorage';

interface VoiceNotesSectionProps {
  intervention: Intervention;
}

interface VoiceNote {
  id: number;
  audioBlob: Blob;
  duration: number;
  createdAt: string;
  transcription?: string;
}

// Convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceNotesSection({ intervention }: VoiceNotesSectionProps) {
  const { t } = useLanguage();
  const { worker } = useAuth();
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [voiceNotes, setVoiceNotes] = React.useState<VoiceNote[]>([]);
  const [playingId, setPlayingId] = React.useState<number | null>(null);
  const [transcribingId, setTranscribingId] = React.useState<number | null>(null);
  const [transcriptions, setTranscriptions] = React.useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isLocked = intervention.status === 'facture';
  const workerName = worker ? `${worker.firstName} ${worker.name}`.trim() || worker.login : 'Anonyme';

  React.useEffect(() => {
    loadVoiceNotes();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervention.id]);

  const loadVoiceNotes = async () => {
    const notes = await getVoiceNotes(intervention.id);
    setVoiceNotes(notes);
    
    const savedTranscriptions: Record<number, string> = {};
    notes.forEach(note => {
      const saved = localStorage.getItem(`transcription_${note.id}`);
      if (saved) {
        savedTranscriptions[note.id] = saved;
      }
    });
    setTranscriptions(savedTranscriptions);
  };

  const transcribeAndSendToReport = async (note: VoiceNote) => {
    setTranscribingId(note.id);
    
    try {
      const audioBase64 = await blobToBase64(note.audioBlob);
      
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audioBase64,
          mimeType: note.audioBlob.type,
          targetLanguage: 'fr',
          sourceLanguage: 'auto'
        }
      });

      if (error) throw new Error(error.message);

      if (data?.text) {
        const transcription = data.text;
        setTranscriptions(prev => ({ ...prev, [note.id]: transcription }));
        localStorage.setItem(`transcription_${note.id}`, transcription);
        
        // Auto-send to report
        const notesKey = `intervention_notes_${intervention.id}`;
        const existingNotes = localStorage.getItem(notesKey) || '';
        const timestamp = new Date().toLocaleString('fr-CH');
        const newNote = `[${timestamp}] 👤 ${workerName}\n${transcription}`;
        const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
        
        localStorage.setItem(notesKey, updatedNotes);
        window.dispatchEvent(new CustomEvent('intervention-notes-updated', {
          detail: { interventionId: intervention.id, notes: updatedNotes }
        }));
        
        toast.success('✅ Transcrit et ajouté au rapport !');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Erreur lors de la transcription');
    } finally {
      setTranscribingId(null);
    }
  };

  const startRecording = async () => {
    if (isLocked) {
      toast.error('Intervention facturée - modifications non autorisées');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        await saveVoiceNote(intervention.id, audioBlob, recordingTime);
        toast.info('🎤 Transcription en cours...');
        
        const notes = await getVoiceNotes(intervention.id);
        setVoiceNotes(notes);
        
        // Auto-transcribe + auto-send to report
        if (notes.length > 0) {
          transcribeAndSendToReport(notes[notes.length - 1]);
        }
        
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Impossible d\'accéder au microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playNote = (note: VoiceNote) => {
    if (playingId === note.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const url = URL.createObjectURL(note.audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
      setPlayingId(note.id);
    }
  };

  const handleDelete = async (id: number) => {
    if (isLocked) {
      toast.error('Intervention facturée - modifications non autorisées');
      return;
    }
    await deleteVoiceNote(id);
    localStorage.removeItem(`transcription_${id}`);
    setTranscriptions(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    toast.success('Note supprimée');
    loadVoiceNotes();
  };

  const copyToClipboard = async (noteId: number) => {
    const text = transcriptions[noteId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(noteId);
      toast.success('Texte copié');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Intervention facturée — lecture seule.
          </p>
        </div>
      )}
      
      {/* Big Record Button */}
      <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
        {isRecording ? (
          <>
            <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Mic className="w-12 h-12 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive font-mono mb-2">
              {formatTime(recordingTime)}
            </p>
            <p className="text-sm text-muted-foreground mb-4">Parlez maintenant...</p>
            <Button
              variant="worker-danger"
              size="full"
              onClick={stopRecording}
              className="gap-3 h-14 text-lg"
            >
              <Square className="w-6 h-6" />
              Arrêter et transcrire
            </Button>
          </>
        ) : (
          <>
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition-all",
              isLocked ? "bg-muted/50" : "bg-primary/10 hover:bg-primary/20"
            )}>
              {isLocked ? (
                <Lock className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Mic className="w-12 h-12 text-primary" />
              )}
            </div>
            
            {!isLocked && (
              <p className="text-sm text-muted-foreground mb-1">
                👤 {workerName}
              </p>
            )}
            
            <p className="text-xs text-muted-foreground mb-4">
              {isLocked 
                ? 'Enregistrement désactivé'
                : 'Parlez en français → transcription automatique → ajout au rapport'
              }
            </p>
            
            <Button
              variant="worker"
              size="full"
              onClick={startRecording}
              className="gap-3 h-14 text-lg"
              disabled={isLocked}
            >
              {isLocked ? (
                <>
                  <Lock className="w-6 h-6" />
                  Verrouillé
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  🎤 Dicter le rapport
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Voice Notes List */}
      <div className="space-y-2">
        {voiceNotes.length > 0 && (
          <h4 className="text-sm font-semibold text-muted-foreground px-1">
            Enregistrements ({voiceNotes.length})
          </h4>
        )}
        
        {voiceNotes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MicOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucune note vocale</p>
          </div>
        ) : (
          <div className="space-y-2">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "bg-card rounded-xl p-3 border border-border/50",
                  playingId === note.id && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => playNote(note)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      playingId === note.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {playingId === note.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">
                      {new Date(note.createdAt).toLocaleString('fr-CH')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(note.duration)}
                    </p>
                  </div>
                  
                  {transcribingId === note.id && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transcription...</span>
                    </div>
                  )}
                  
                  {!isLocked && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {transcriptions[note.id] && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-sm text-foreground leading-relaxed mb-2">
                      {transcriptions[note.id]}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(note.id)}
                        className="gap-1 h-7 text-xs"
                      >
                        {copiedId === note.id ? (
                          <><Check className="w-3 h-3 text-green-500" /> Copié</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Copier</>
                        )}
                      </Button>
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ajouté au rapport
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
