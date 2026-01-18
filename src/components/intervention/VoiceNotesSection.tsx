import * as React from 'react';
import { Mic, Square, Play, Pause, Trash2, MicOff, FileText, Loader2, Copy, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { saveVoiceNote, getVoiceNotes, deleteVoiceNote, addPendingSync } from '@/lib/offlineStorage';
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
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceNotesSection({ intervention }: VoiceNotesSectionProps) {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [voiceNotes, setVoiceNotes] = React.useState<VoiceNote[]>([]);
  const [playingId, setPlayingId] = React.useState<number | null>(null);
  const [transcribingId, setTranscribingId] = React.useState<number | null>(null);
  const [transcriptions, setTranscriptions] = React.useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [sendingId, setSendingId] = React.useState<number | null>(null);
  
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    loadVoiceNotes();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervention.id]);

  const loadVoiceNotes = async () => {
    const notes = await getVoiceNotes(intervention.id);
    setVoiceNotes(notes);
    
    // Load saved transcriptions from localStorage
    const savedTranscriptions: Record<number, string> = {};
    notes.forEach(note => {
      const saved = localStorage.getItem(`transcription_${note.id}`);
      if (saved) {
        savedTranscriptions[note.id] = saved;
      }
    });
    setTranscriptions(savedTranscriptions);
  };

  const transcribeAudio = async (note: VoiceNote) => {
    setTranscribingId(note.id);
    
    try {
      const audioBase64 = await blobToBase64(note.audioBlob);
      
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audioBase64,
          mimeType: note.audioBlob.type
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.text) {
        const transcription = data.text;
        setTranscriptions(prev => ({ ...prev, [note.id]: transcription }));
        localStorage.setItem(`transcription_${note.id}`, transcription);
        toast.success('Transcription terminée');
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Save to IndexedDB
        await saveVoiceNote(intervention.id, audioBlob, recordingTime);
        toast.success('Note vocale enregistrée - transcription en cours...');
        
        // Reload notes and auto-transcribe the latest one
        const notes = await getVoiceNotes(intervention.id);
        setVoiceNotes(notes);
        
        // Auto-transcribe the latest note
        if (notes.length > 0) {
          const latestNote = notes[notes.length - 1];
          transcribeAudio(latestNote);
        }
        
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
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
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
    } else {
      // Stop any currently playing
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Play new
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
      toast.success('Texte copié dans le presse-papier');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Impossible de copier le texte');
    }
  };

  const sendToInterventionNotes = async (noteId: number) => {
    const text = transcriptions[noteId];
    if (!text) return;
    
    setSendingId(noteId);
    
    try {
      // Get existing notes from localStorage or create new
      const notesKey = `intervention_notes_${intervention.id}`;
      const existingNotes = localStorage.getItem(notesKey) || '';
      const timestamp = new Date().toLocaleString('fr-CH');
      const newNote = `[${timestamp}] ${text}`;
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${newNote}`
        : newNote;
      
      // Save locally first
      localStorage.setItem(notesKey, updatedNotes);
      
      if (isOnline()) {
        // Send to Dolibarr as note_private update
        const { error } = await supabase.functions.invoke('dolibarr-api', {
          body: {
            action: 'update-intervention',
            params: {
              id: intervention.id,
              data: {
                note_private: updatedNotes
              }
            }
          }
        });
        
        if (error) {
          throw new Error(error.message);
        }
        
        toast.success('Note ajoutée à l\'intervention');
      } else {
        // Queue for offline sync
        await addPendingSync('note', intervention.id, {
          note_private: updatedNotes
        });
        
        
        toast.success('Note sauvegardée (synchronisation hors-ligne)');
      }
    } catch (error) {
      console.error('Send to notes error:', error);
      toast.error("Erreur lors de l'envoi de la note");
    } finally {
      setSendingId(null);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Recording Button */}
      <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
        {isRecording ? (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Mic className="w-10 h-10 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive font-mono mb-4">
              {formatTime(recordingTime)}
            </p>
            <Button
              variant="worker-danger"
              size="full"
              onClick={stopRecording}
              className="gap-3"
            >
              <Square className="w-6 h-6" />
              {t('voice.stop')}
            </Button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Appuyez pour enregistrer - transcription automatique en français
            </p>
            <Button
              variant="worker"
              size="full"
              onClick={startRecording}
              className="gap-3"
            >
              <Mic className="w-6 h-6" />
              {t('voice.record')}
            </Button>
          </>
        )}
      </div>

      {/* Voice Notes List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground px-1">
          Notes vocales ({voiceNotes.length})
        </h4>
        
        {voiceNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MicOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('voice.noNotes')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "bg-card rounded-xl p-4 border border-border/50",
                  playingId === note.id && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => playNote(note)}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      playingId === note.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {playingId === note.id ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {new Date(note.createdAt).toLocaleString('fr-CH')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Durée: {formatTime(note.duration)}
                    </p>
                  </div>
                  
                  {/* Transcribe button if no transcription yet */}
                  {!transcriptions[note.id] && transcribingId !== note.id && (
                    <button
                      onClick={() => transcribeAudio(note)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Transcrire"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  )}
                  
                  {/* Loading spinner while transcribing */}
                  {transcribingId === note.id && (
                    <div className="p-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Transcription text with actions */}
                {transcriptions[note.id] && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-sm text-foreground leading-relaxed mb-3">
                      {transcriptions[note.id]}
                    </p>
                    
                    {/* Action buttons for transcription */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(note.id)}
                        className="gap-2 flex-1"
                      >
                        {copiedId === note.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            Copié
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copier
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => sendToInterventionNotes(note.id)}
                        disabled={sendingId === note.id}
                        className="gap-2 flex-1"
                      >
                        {sendingId === note.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Envoi...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Ajouter aux notes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Transcribing indicator */}
                {transcribingId === note.id && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Transcription en cours...
                    </p>
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
