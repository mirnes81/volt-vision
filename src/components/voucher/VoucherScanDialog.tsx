import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, Loader2, Check, X, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Default tenant ID for single-tenant setup
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

interface ExtractedData {
  client_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  date_intervention?: string;
  reference_bon?: string;
  access_code?: string;
  contact_name?: string;
  notes?: string;
  raw_text?: string;
  confidence?: number;
}

interface VoucherScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInterventionCreated?: (data: ExtractedData) => void;
}

export function VoucherScanDialog({ open, onOpenChange, onInterventionCreated }: VoucherScanDialogProps) {
  const { toast } = useToast();
  const { worker } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [editedData, setEditedData] = useState<ExtractedData>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({
        title: "Format non supporté",
        description: "Veuillez sélectionner une image (JPG, PNG) ou un PDF",
        variant: "destructive"
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      await processImage(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const processImage = async (imageBase64: string) => {
    setStep('processing');
    setIsProcessing(true);

    try {
      // Fetch previous extractions for learning
      let previousExtractions: Array<{ raw: string; corrected: Record<string, string> }> = [];
      
      try {
        const { data: scans } = await supabase
          .from('voucher_scans' as any)
          .select('raw_ocr_text, corrected_data')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .eq('status', 'validated')
          .not('corrected_data', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (scans && Array.isArray(scans)) {
          previousExtractions = (scans as any[])
            .filter((s: any) => s.raw_ocr_text && s.corrected_data)
            .map((s: any) => ({
              raw: s.raw_ocr_text,
              corrected: s.corrected_data as Record<string, string>
            }));
        }
      } catch (e) {
        console.log("No previous extractions available");
      }

      const { data, error } = await supabase.functions.invoke('extract-voucher', {
        body: {
          imageBase64,
          previousExtractions
        }
      });

      if (error) throw error;

      if (data.success) {
        setExtractedData(data.data);
        setEditedData(data.data);
        setRawOcrText(data.raw_text || "");
        setConfidence(data.confidence || 0);
        setStep('review');
      } else {
        throw new Error(data.error || "Échec de l'extraction");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      toast({
        title: "Erreur d'extraction",
        description: error instanceof Error ? error.message : "Impossible d'analyser le document",
        variant: "destructive"
      });
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async () => {
    try {
      // Save the scan with corrections for learning
      if (imagePreview) {
        // Upload image to storage
        const fileName = `${Date.now()}-voucher.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('voucher-scans')
          .upload(`${DEFAULT_TENANT_ID}/${fileName}`, dataURLtoBlob(imagePreview), {
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
        }

        // Check if data was corrected
        const wasEdited = JSON.stringify(extractedData) !== JSON.stringify(editedData);

        // Save scan record - use raw insert to handle types until regeneration
        const { error: insertError } = await supabase
          .from('voucher_scans' as any)
          .insert({
            tenant_id: DEFAULT_TENANT_ID,
            original_file_url: uploadData?.path || '',
            raw_ocr_text: rawOcrText,
            extracted_data: extractedData,
            corrected_data: wasEdited ? editedData : null,
            status: 'validated',
            scanned_by: worker?.id?.toString() || null,
            validated_at: new Date().toISOString()
          } as any);
        
        if (insertError) {
          console.error("Insert error:", insertError);
        }
      }

      onInterventionCreated?.(editedData);
      toast({
        title: "Extraction validée",
        description: "Les données ont été extraites avec succès"
      });
      handleClose();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'extraction",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setStep('upload');
    setImagePreview(null);
    setExtractedData({});
    setEditedData({});
    setRawOcrText("");
    setConfidence(0);
    onOpenChange(false);
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const updateField = (field: keyof ExtractedData, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Scanner un bon de régie
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Prenez une photo ou importez un fichier du bon de régie. L'IA va extraire automatiquement les informations.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => cameraInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <Camera className="h-10 w-10 text-primary" />
                  <span className="font-medium">Prendre une photo</span>
                  <span className="text-xs text-muted-foreground">Appareil photo</span>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <Upload className="h-10 w-10 text-primary" />
                  <span className="font-medium">Importer un fichier</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, PDF</span>
                </CardContent>
              </Card>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyse du document en cours...</p>
            <p className="text-xs text-muted-foreground">L'IA extrait les informations du bon de régie</p>
            {imagePreview && (
              <img 
                src={imagePreview} 
                alt="Document" 
                className="max-h-32 rounded-lg opacity-50 mt-4"
              />
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confiance:</span>
                <span className={`text-sm font-medium ${confidence >= 80 ? 'text-green-600' : confidence >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {confidence}%
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => imagePreview && processImage(imagePreview)}
                disabled={isProcessing}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Réanalyser
              </Button>
            </div>

            {imagePreview && (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Document" 
                  className="max-h-48 rounded-lg mx-auto"
                />
              </div>
            )}

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="client_name">Client</Label>
                  <Input
                    id="client_name"
                    value={editedData.client_name || ''}
                    onChange={(e) => updateField('client_name', e.target.value)}
                    placeholder="Nom du client"
                  />
                </div>
                <div>
                  <Label htmlFor="reference_bon">N° Bon</Label>
                  <Input
                    id="reference_bon"
                    value={editedData.reference_bon || ''}
                    onChange={(e) => updateField('reference_bon', e.target.value)}
                    placeholder="Référence"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={editedData.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Adresse d'intervention"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={editedData.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="Téléphone"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_name">Contact</Label>
                  <Input
                    id="contact_name"
                    value={editedData.contact_name || ''}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    placeholder="Nom du contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date_intervention">Date prévue</Label>
                  <Input
                    id="date_intervention"
                    type="date"
                    value={editedData.date_intervention || ''}
                    onChange={(e) => updateField('date_intervention', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="access_code">Code d'accès</Label>
                  <Input
                    id="access_code"
                    value={editedData.access_code || ''}
                    onChange={(e) => updateField('access_code', e.target.value)}
                    placeholder="Code/Interphone"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description des travaux</Label>
                <Textarea
                  id="description"
                  value={editedData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Description de l'intervention"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editedData.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Informations supplémentaires"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button onClick={handleValidate}>
                <Check className="h-4 w-4 mr-1" />
                Valider et créer l'intervention
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
