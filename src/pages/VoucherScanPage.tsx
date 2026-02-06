import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ScanLine, History, Settings2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoucherScanDialog } from "@/components/voucher/VoucherScanDialog";
import { useToast } from "@/hooks/use-toast";

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
}

export default function VoucherScanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [lastExtraction, setLastExtraction] = useState<ExtractedData | null>(null);

  const handleInterventionCreated = (data: ExtractedData) => {
    setLastExtraction(data);
    toast({
      title: "Données extraites",
      description: `Client: ${data.client_name || 'Non détecté'} - ${data.address || 'Adresse non détectée'}`,
    });
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border lg:hidden">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Scan Bons de Régie</h1>
        </div>
      </header>
      <div className="hidden lg:block p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Scan Bons de Régie</h1>
            <p className="text-muted-foreground text-sm">Outil IA d'extraction automatique de données</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Main Action Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Scanner un bon de régie
            </CardTitle>
            <CardDescription>
              Prenez une photo ou importez un fichier. L'IA extrait automatiquement les informations client, adresse, description et crée une intervention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setScanDialogOpen(true)}
            >
              <ScanLine className="h-5 w-5 mr-2" />
              Commencer le scan
            </Button>
          </CardContent>
        </Card>

        {/* Last Extraction Preview */}
        {lastExtraction && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Dernière extraction</CardTitle>
                <Badge variant="secondary">Prêt à créer</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {lastExtraction.client_name && (
                  <div>
                    <span className="text-muted-foreground">Client:</span>
                    <p className="font-medium">{lastExtraction.client_name}</p>
                  </div>
                )}
                {lastExtraction.reference_bon && (
                  <div>
                    <span className="text-muted-foreground">N° Bon:</span>
                    <p className="font-medium">{lastExtraction.reference_bon}</p>
                  </div>
                )}
                {lastExtraction.address && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Adresse:</span>
                    <p className="font-medium">{lastExtraction.address}</p>
                  </div>
                )}
                {lastExtraction.description && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Description:</span>
                    <p className="font-medium">{lastExtraction.description}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/interventions/new', { 
                    state: { prefill: lastExtraction } 
                  })}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Créer intervention
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for History and Settings */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Fonctionnement</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Comment ça marche?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Scanner le document</p>
                    <p className="text-muted-foreground">Photo ou import de fichier (PDF, image)</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Extraction IA</p>
                    <p className="text-muted-foreground">L'IA lit et extrait les champs (client, adresse, etc.)</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Vérification et correction</p>
                    <p className="text-muted-foreground">Vous validez ou corrigez les données extraites</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Apprentissage</p>
                    <p className="text-muted-foreground">L'IA mémorise vos corrections pour s'améliorer</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Champs extraits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Client</Badge>
                  <Badge variant="outline">Adresse</Badge>
                  <Badge variant="outline">Téléphone</Badge>
                  <Badge variant="outline">Contact</Badge>
                  <Badge variant="outline">N° Bon</Badge>
                  <Badge variant="outline">Date</Badge>
                  <Badge variant="outline">Code d'accès</Badge>
                  <Badge variant="outline">Description</Badge>
                  <Badge variant="outline">Notes</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Derniers scans
                </CardTitle>
                <CardDescription>
                  L'historique des scans et leurs corrections servent à améliorer l'IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun scan effectué pour l'instant.
                  <br />
                  Scannez votre premier bon de régie!
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <VoucherScanDialog 
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onInterventionCreated={handleInterventionCreated}
      />
    </div>
  );
}
