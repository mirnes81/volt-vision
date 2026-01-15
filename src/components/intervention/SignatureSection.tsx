import { useState, useRef, useEffect } from 'react';
import { Eraser, Check, PenTool, FileText, Loader2, WifiOff, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { saveSignature, generatePdf } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SignatureSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function SignatureSection({ intervention, onUpdate }: SignatureSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [offlineSignature, setOfflineSignature] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    setIsLoading(true);
    setPdfStatus('idle');
    
    try {
      // 1. Save signature
      const dataUrl = canvas.toDataURL('image/png');
      const result = await saveSignature(intervention.id, dataUrl);
      
      if (result.offline) {
        // Store locally for display
        setOfflineSignature(dataUrl);
        toast.success('Signature sauvegardée hors-ligne', {
          description: 'Elle sera synchronisée au retour de la connexion',
          icon: <WifiOff className="w-4 h-4" />,
        });
        toast.info('Le PDF sera généré lors de la synchronisation');
        setPdfStatus('idle');
      } else {
        toast.success('Signature enregistrée');
        
        // 2. Automatically generate PDF report (only when online)
        setPdfStatus('generating');
        toast.info('Génération du rapport PDF...', { duration: 2000 });
        
        try {
          const pdfResult = await generatePdf(intervention.id);
          setPdfStatus('success');
          toast.success('Rapport PDF généré !', {
            description: pdfResult.fileName,
          });
        } catch (pdfError) {
          console.error('PDF generation failed:', pdfError);
          setPdfStatus('error');
          toast.warning('Signature enregistrée, mais erreur lors de la génération du PDF');
        }
      }
      
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Display either server signature, offline signature, or nothing
  const displayedSignature = intervention.signaturePath || offlineSignature;

  return (
    <div className="space-y-4">
      {/* Existing Signature (server or offline) */}
      {displayedSignature && (
        <div className={cn(
          "bg-card rounded-2xl p-4 shadow-card border",
          offlineSignature && !intervention.signaturePath 
            ? "border-warning/30" 
            : "border-success/30"
        )}>
          <p className={cn(
            "text-sm font-medium mb-2 flex items-center gap-2",
            offlineSignature && !intervention.signaturePath 
              ? "text-warning" 
              : "text-success"
          )}>
            {offlineSignature && !intervention.signaturePath ? (
              <>
                <CloudOff className="w-4 h-4" />
                Signature en attente de synchronisation
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Signature client enregistrée
              </>
            )}
          </p>
          <div className="relative">
            <img 
              src={displayedSignature} 
              alt="Signature client"
              className="w-full h-32 object-contain rounded-lg bg-white"
            />
            {offlineSignature && !intervention.signaturePath && (
              <Badge 
                variant="secondary" 
                className="absolute top-2 right-2 bg-warning/90 text-warning-foreground gap-1"
              >
                <WifiOff className="w-3 h-3" />
                Hors-ligne
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Signature Canvas */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <PenTool className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {intervention.signaturePath ? 'Nouvelle signature' : 'Signature du client'}
          </span>
        </div>
        
        <div className="relative bg-white rounded-xl overflow-hidden border-2 border-dashed border-border">
          <canvas
            ref={canvasRef}
            className="w-full h-48 touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50">
              <p className="text-sm">Signez ici avec votre doigt</p>
            </div>
          )}
        </div>
      </div>

      {/* PDF Status */}
      {pdfStatus === 'generating' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Génération du rapport PDF en cours...
        </div>
      )}
      
      {pdfStatus === 'success' && (
        <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3">
          <FileText className="w-4 h-4" />
          Rapport PDF généré et enregistré dans Dolibarr
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="worker-ghost"
          className="flex-1 gap-2"
          onClick={clearCanvas}
          disabled={!hasSignature || isLoading}
        >
          <Eraser className="w-5 h-5" />
          Effacer
        </Button>
        <Button
          variant="worker"
          className="flex-1 gap-2"
          onClick={handleSave}
          disabled={!hasSignature || isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {isLoading ? 'Enregistrement...' : 'Signer & Terminer'}
        </Button>
      </div>
      
      {/* Info */}
      <p className="text-xs text-muted-foreground text-center">
        La signature valide l'intervention et génère automatiquement le rapport PDF
      </p>
    </div>
  );
}
