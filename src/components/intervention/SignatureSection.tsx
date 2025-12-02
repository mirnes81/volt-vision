import { useState, useRef, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { saveSignature } from '@/lib/api';
import { toast } from 'sonner';

interface SignatureSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function SignatureSection({ intervention, onUpdate }: SignatureSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await saveSignature(intervention.id, dataUrl);
      toast.success('Signature enregistrée');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing Signature */}
      {intervention.signaturePath && (
        <div className="bg-card rounded-2xl p-4 shadow-card border border-success/30">
          <p className="text-sm font-medium text-success mb-2 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Signature client enregistrée
          </p>
          <img 
            src={intervention.signaturePath} 
            alt="Signature client"
            className="w-full h-32 object-contain rounded-lg bg-white"
          />
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

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="worker-ghost"
          className="flex-1 gap-2"
          onClick={clearCanvas}
          disabled={!hasSignature}
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
          <Check className="w-5 h-5" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
