import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { saveVoiceNote, getVoiceNotes, deleteVoiceNote } from '@/lib/offlineStorage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VoiceNotesSectionProps {
  intervention: Intervention;
}

interface VoiceNote {
  id: number;
  audioBlob: Blob;
  duration: number;
  createdAt: string;
}

export function VoiceNotesSection({ intervention }: VoiceNotesSectionProps) {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadVoiceNotes();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervention.id]);

  const loadVoiceNotes = async () => {
    const notes = await getVoiceNotes(intervention.id);
    setVoiceNotes(notes);
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
        toast.success('Note vocale enregistrée');
        loadVoiceNotes();
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
    toast.success('Note supprimée');
    loadVoiceNotes();
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
              Appuyez pour enregistrer une note vocale
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
          <div className="space-y-2">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "bg-card rounded-xl p-4 border border-border/50 flex items-center gap-3",
                  playingId === note.id && "border-primary/30 bg-primary/5"
                )}
              >
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
                
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
