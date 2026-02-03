import * as React from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HagerImportDialogProps {
  onImportComplete: () => void;
}

const HAGER_CATEGORIES = [
  'Systèmes de distribution et armoires',
  'Appareils modulaires',
  'Disjoncteurs, interrupteurs et appareils de protection',
  'Bornes de charge pour véhicule électrique (EVCS)',
  'Gestion et surveillance de l\'énergie',
  'Cheminement de câbles tehalit',
  'Prises et interrupteurs',
  'Technologie de sécurité',
  'Système de gestion du bâtiment KNX',
  'Interphonie',
  'Détecteurs de mouvements et de présence',
];

export function HagerImportDialog({ onImportComplete }: HagerImportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [rawData, setRawData] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('');
  const [isImporting, setIsImporting] = React.useState(false);
  const [preview, setPreview] = React.useState<{ reference: string; name: string }[]>([]);

  const parseData = (text: string): { reference: string; name: string }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const parsed: { reference: string; name: string }[] = [];

    for (const line of lines) {
      // Try tab-separated first (Excel copy-paste)
      let parts = line.split('\t');
      
      // If no tabs, try semicolon (CSV)
      if (parts.length < 2) {
        parts = line.split(';');
      }
      
      // If still no separator, try comma
      if (parts.length < 2) {
        parts = line.split(',');
      }

      if (parts.length >= 2) {
        const reference = parts[0].trim();
        const name = parts[1].trim();
        
        // Basic validation: reference should look like a Hager reference
        if (reference && name && reference.length >= 3) {
          parsed.push({ reference, name });
        }
      }
    }

    return parsed;
  };

  React.useEffect(() => {
    if (rawData) {
      const parsed = parseData(rawData);
      setPreview(parsed.slice(0, 5)); // Show first 5 as preview
    } else {
      setPreview([]);
    }
  }, [rawData]);

  const handleImport = async () => {
    const products = parseData(rawData);
    
    if (products.length === 0) {
      toast.error('Aucun produit valide trouvé');
      return;
    }

    if (!selectedCategory) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    setIsImporting(true);

    try {
      // Prepare products for insert
      const productsToInsert = products.map(p => ({
        supplier: 'hager',
        reference: p.reference,
        name: p.name,
        category: selectedCategory,
        currency: 'CHF',
        last_sync_at: new Date().toISOString(),
      }));

      // Upsert products (update if reference exists, insert if not)
      const { error } = await supabase
        .from('supplier_products')
        .upsert(productsToInsert, {
          onConflict: 'supplier,reference',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      toast.success(`${products.length} produits Hager importés avec succès`);
      setOpen(false);
      setRawData('');
      setSelectedCategory('');
      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setIsImporting(false);
    }
  };

  const totalParsed = rawData ? parseData(rawData).length : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importer Hager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import produits Hager
          </DialogTitle>
          <DialogDescription>
            Copiez-collez les références et désignations depuis le catalogue Hager (Excel, PDF ou site web)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {HAGER_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Format attendu :</strong> Une ligne par produit avec référence et désignation séparées par tabulation, point-virgule ou virgule.
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                Exemple: <code>MCS110 ; Disjoncteur 1P 10A courbe C</code>
              </span>
            </AlertDescription>
          </Alert>

          {/* Text Input */}
          <div className="space-y-2">
            <Label>Données à importer</Label>
            <Textarea
              placeholder={`MCS110\tDisjoncteur 1P 10A courbe C
MCS116\tDisjoncteur 1P 16A courbe C
MCS120\tDisjoncteur 1P 20A courbe C`}
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            {totalParsed > 0 && (
              <p className="text-sm text-muted-foreground">
                {totalParsed} produit(s) détecté(s)
              </p>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Référence</th>
                      <th className="text-left p-2 font-medium">Désignation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 font-mono">{item.reference}</td>
                        <td className="p-2">{item.name}</td>
                      </tr>
                    ))}
                    {totalParsed > 5 && (
                      <tr className="border-t bg-muted/50">
                        <td colSpan={2} className="p-2 text-center text-muted-foreground">
                          ... et {totalParsed - 5} autre(s)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || totalParsed === 0 || !selectedCategory}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer {totalParsed} produit(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
