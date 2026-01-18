import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, MapPin, FileText, Camera, CheckSquare, PenTool, Send, Loader2, Plus, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { createIntervention, getClients, uploadPhoto, saveSignature, generatePdf, sendInterventionEmail } from '@/lib/api';

interface Client {
  id: number;
  name: string;
  address?: string;
  zip?: string;
  town?: string;
  email?: string;
}

const interventionTypes = [
  { value: 'depannage', label: 'Dépannage' },
  { value: 'installation', label: 'Installation' },
  { value: 'renovation', label: 'Rénovation' },
  { value: 'tableau', label: 'Tableau électrique' },
  { value: 'oibt', label: 'Contrôle OIBT' },
  { value: 'autre', label: 'Autre' },
];

export default function NewInterventionPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [createdInterventionId, setCreatedInterventionId] = React.useState<number | null>(null);

  // Step 1: Client + Location
  const [clients, setClients] = React.useState<Client[]>([]);
  const [clientSearch, setClientSearch] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [location, setLocation] = React.useState('');
  const [interventionType, setInterventionType] = React.useState('depannage');
  const [priority, setPriority] = React.useState<'normal' | 'urgent'>('normal');

  // Step 2: Description + Checklist + Photos
  const [label, setLabel] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [checklist, setChecklist] = React.useState<string[]>(['']);
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = React.useState<string[]>([]);

  // Step 3: Signature
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [signerName, setSignerName] = React.useState('');
  const [canvasRef, setCanvasRef] = React.useState<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async (search?: string) => {
    try {
      const result = await getClients(search);
      setClients(result);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      if (clientSearch.length >= 2) {
        loadClients(clientSearch);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  // Signature canvas handlers
  const initCanvas = (canvas: HTMLCanvasElement | null) => {
    if (canvas && !canvasRef) {
      setCanvasRef(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef) return;
    setIsDrawing(true);
    const ctx = canvasRef.getContext('2d');
    if (ctx) {
      const rect = canvasRef.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (ctx) {
      const rect = canvasRef.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef) {
      setSignatureData(canvasRef.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    if (canvasRef) {
      const ctx = canvasRef.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
      }
    }
    setSignatureData(null);
  };

  // Photo handlers
  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = Array.from(files);
      setPhotos(prev => [...prev, ...newPhotos]);
      newPhotos.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotosPreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotosPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Checklist handlers
  const addChecklistItem = () => {
    setChecklist(prev => [...prev, '']);
  };

  const updateChecklistItem = (index: number, value: string) => {
    setChecklist(prev => prev.map((item, i) => i === index ? value : item));
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== index));
  };

  // Step navigation
  const canProceedStep1 = selectedClient && label;
  const canProceedStep2 = true; // Description optionnelle
  const canFinish = signatureData && signerName;

  const handleNext = async () => {
    if (step === 1 && !canProceedStep1) {
      toast.error('Sélectionnez un client et entrez un libellé');
      return;
    }

    if (step === 1) {
      // Create intervention
      setIsLoading(true);
      try {
        const result = await createIntervention({
          clientId: selectedClient!.id,
          label,
          location: location || `${selectedClient!.address}, ${selectedClient!.zip} ${selectedClient!.town}`,
          type: interventionType,
          priority: priority === 'urgent' ? 1 : 0,
          description,
        });
        setCreatedInterventionId(result.id);
        toast.success('Intervention créée: ' + result.ref);
        setStep(2);
      } catch (error) {
        toast.error('Erreur création intervention');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (step === 2) {
      // Upload photos if any
      if (photos.length > 0 && createdInterventionId) {
        setIsLoading(true);
        try {
          for (const photo of photos) {
            await uploadPhoto(createdInterventionId, photo, 'pendant');
          }
          toast.success(`${photos.length} photo(s) uploadée(s)`);
        } catch (error) {
          console.error('Erreur upload photos:', error);
        } finally {
          setIsLoading(false);
        }
      }
      setStep(3);
    }
  };

  const handleFinish = async () => {
    if (!canFinish || !createdInterventionId) {
      toast.error('Signature et nom du signataire requis');
      return;
    }

    setIsLoading(true);
    try {
      // Save signature
      await saveSignature(createdInterventionId, signatureData!, signerName);
      toast.success('Signature enregistrée');

      // Generate PDF
      const pdfResult = await generatePdf(createdInterventionId);
      toast.success('PDF généré');

      // Send email
      await sendInterventionEmail(createdInterventionId);
      toast.success('Email envoyé au client');

      // Navigate to intervention
      navigate(`/intervention/${createdInterventionId}`);
    } catch (error) {
      console.error('Erreur finalisation:', error);
      toast.error('Erreur lors de la finalisation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipSignature = async () => {
    if (createdInterventionId) {
      navigate(`/intervention/${createdInterventionId}`);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <Header title="Nouvelle intervention" showBack />

      {/* Progress Steps */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                s === step ? "bg-primary text-primary-foreground scale-110" :
                s < step ? "bg-success text-success-foreground" :
                "bg-muted text-muted-foreground"
              )}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={cn(
                  "w-12 h-1 mx-1 rounded-full transition-all",
                  s < step ? "bg-success" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Client</span>
          <span>Détails</span>
          <span>Signature</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="px-4 space-y-4">
        
        {/* STEP 1: Client + Location */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                Client
              </h3>
              
              <Input
                placeholder="Rechercher un client..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="mb-3"
              />
              
              {clients.length > 0 && !selectedClient && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setLocation(`${client.address || ''}, ${client.zip || ''} ${client.town || ''}`);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.address}, {client.zip} {client.town}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedClient && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">{selectedClient.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedClient(null)}>
                      Changer
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                Informations
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Libellé *</label>
                  <Input
                    placeholder="Ex: Remplacement tableau électrique"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={interventionType} onValueChange={setInterventionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {interventionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Priorité</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={priority === 'normal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPriority('normal')}
                    >
                      Normal
                    </Button>
                    <Button
                      type="button"
                      variant={priority === 'urgent' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setPriority('urgent')}
                    >
                      Urgent
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Adresse intervention
                  </label>
                  <Input
                    placeholder="Adresse du chantier"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Description + Checklist + Photos */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                Description
              </h3>
              <Textarea
                placeholder="Décrivez les travaux effectués..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-primary" />
                Checklist rapide
              </h3>
              <div className="space-y-2">
                {checklist.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Tâche ${index + 1}`}
                      value={item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                    />
                    {checklist.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeChecklistItem(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addChecklistItem} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-primary" />
                Photos
              </h3>
              
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photosPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
                <Camera className="w-5 h-5" />
                <span>Ajouter des photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoAdd}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 3: Signature */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <PenTool className="w-5 h-5 text-primary" />
                Signature client
              </h3>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Nom du signataire</label>
                <Input
                  placeholder="Nom et prénom"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="mb-3"
                />
              </div>

              <div className="border-2 border-border rounded-xl overflow-hidden bg-white">
                <canvas
                  ref={initCanvas}
                  width={320}
                  height={200}
                  className="w-full touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              
              <Button variant="outline" size="sm" onClick={clearSignature} className="mt-2 w-full">
                Effacer la signature
              </Button>
            </div>

            <div className="bg-success/10 border border-success/20 rounded-2xl p-4">
              <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Finalisation
              </h4>
              <p className="text-sm text-muted-foreground">
                En cliquant sur "Terminer", le rapport PDF sera généré et envoyé automatiquement au client par email.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
          )}
          
          {step < 3 ? (
            <Button onClick={handleNext} disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          ) : (
            <div className="flex-1 space-y-2">
              <Button onClick={handleFinish} disabled={isLoading || !canFinish} className="w-full" variant="worker">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Terminer et envoyer
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={handleSkipSignature} className="w-full text-muted-foreground">
                Terminer sans signature
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
