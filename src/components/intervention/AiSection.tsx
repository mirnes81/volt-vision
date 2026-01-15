import { useState } from 'react';
import { Sparkles, FileText, Wrench, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { generateAiSummary, generateAiDiagnostic } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

interface AiSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function AiSection({ intervention, onUpdate }: AiSectionProps) {
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingDiagnostic, setIsLoadingDiagnostic] = useState(false);
  const [summary, setSummary] = useState(intervention.aiSummary || '');
  const [diagnostic, setDiagnostic] = useState(intervention.aiDiagnostic || '');

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const result = await generateAiSummary(intervention.id);
      setSummary(result);
      toast.success('Résumé généré');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la génération');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleGenerateDiagnostic = async () => {
    setIsLoadingDiagnostic(true);
    try {
      const result = await generateAiDiagnostic(intervention.id);
      setDiagnostic(result);
      toast.success('Diagnostic généré');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la génération');
    } finally {
      setIsLoadingDiagnostic(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Info */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-bold text-primary">Assistant IA</span>
        </div>
        <p className="text-sm text-muted-foreground">
          L'IA peut générer automatiquement un résumé de l'intervention ou proposer un diagnostic pour les dépannages.
        </p>
      </div>

      {/* Summary Section */}
      <div className="space-y-3">
        <Button
          variant="worker"
          size="full"
          onClick={handleGenerateSummary}
          disabled={isLoadingSummary}
          className="gap-3"
        >
          {isLoadingSummary ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileText className="w-5 h-5" />
          )}
          Générer résumé IA
        </Button>

        {summary && (
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 animate-slide-up">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Résumé généré
            </h4>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {summary}
            </pre>
          </div>
        )}
      </div>

      {/* Diagnostic Section (only for depannage) */}
      {intervention.type === 'depannage' && (
        <div className="space-y-3">
          <Button
            variant="worker-outline"
            size="full"
            onClick={handleGenerateDiagnostic}
            disabled={isLoadingDiagnostic}
            className="gap-3"
          >
            {isLoadingDiagnostic ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Wrench className="w-5 h-5" />
            )}
            Assistant dépannage IA
          </Button>

          {diagnostic && (
            <div className="bg-card rounded-2xl p-4 shadow-card border border-warning/30 animate-slide-up">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-warning">
                <Wrench className="w-4 h-4" />
                Diagnostic suggéré
              </h4>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {diagnostic}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
