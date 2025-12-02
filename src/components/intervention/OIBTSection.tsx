import { useState } from 'react';
import { FileCheck, Download, Save, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Intervention } from '@/types/intervention';
import { generateOIBTPDF } from '@/lib/pdfGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OIBTSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

type OIBTResult = 'ok' | 'nok' | 'reserve';

export function OIBTSection({ intervention, onUpdate }: OIBTSectionProps) {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    isolation: '',
    continuity: '',
    differential: '',
    voltage: '230',
    result: 'ok' as OIBTResult,
    comments: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // In real app, save to database
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Mesures enregistrées');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!formData.isolation || !formData.continuity || !formData.differential) {
      toast.error('Veuillez remplir toutes les mesures');
      return;
    }
    
    generateOIBTPDF(intervention, formData);
    toast.success('PDF généré');
  };

  const resultOptions: { value: OIBTResult; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'ok', label: t('oibt.ok'), icon: CheckCircle, color: 'bg-success/10 text-success border-success/30' },
    { value: 'nok', label: t('oibt.nok'), icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/30' },
    { value: 'reserve', label: t('oibt.reserve'), icon: AlertTriangle, color: 'bg-warning/10 text-warning border-warning/30' },
  ];

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <FileCheck className="w-5 h-5 text-primary" />
          <span className="font-bold text-primary">{t('oibt.title')}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('oibt.description')}
        </p>
      </div>

      {/* Measurements Form */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 space-y-4">
        <h4 className="font-semibold">Mesures électriques</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('oibt.isolation')}</label>
            <Input
              type="number"
              step="0.1"
              value={formData.isolation}
              onChange={(e) => handleChange('isolation', e.target.value)}
              placeholder="≥ 0.5"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">Min: 0.5 MΩ</p>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('oibt.continuity')}</label>
            <Input
              type="number"
              step="0.01"
              value={formData.continuity}
              onChange={(e) => handleChange('continuity', e.target.value)}
              placeholder="≤ 1"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">Max: 1 Ω</p>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('oibt.differential')}</label>
            <Input
              type="number"
              step="1"
              value={formData.differential}
              onChange={(e) => handleChange('differential', e.target.value)}
              placeholder="≤ 300"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">Max: 300 ms</p>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('oibt.voltage')}</label>
            <Input
              type="number"
              step="1"
              value={formData.voltage}
              onChange={(e) => handleChange('voltage', e.target.value)}
              placeholder="230"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">220-240 V</p>
          </div>
        </div>
      </div>

      {/* Result Selection */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <label className="text-sm font-semibold mb-3 block">{t('oibt.result')}</label>
        <div className="grid grid-cols-3 gap-2">
          {resultOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => handleChange('result', option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 btn-press",
                  formData.result === option.value
                    ? option.color
                    : "border-border bg-secondary/30"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comments */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <label className="text-sm font-semibold mb-2 block">{t('oibt.comments')}</label>
        <Textarea
          value={formData.comments}
          onChange={(e) => handleChange('comments', e.target.value)}
          placeholder="Observations, réserves, remarques..."
          className="min-h-[100px] text-base"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="worker-outline"
          className="flex-1 gap-2"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Save className="w-5 h-5" />
          {t('oibt.saveMeasures')}
        </Button>
        
        <Button
          variant="worker"
          className="flex-1 gap-2"
          onClick={handleGeneratePDF}
        >
          <Download className="w-5 h-5" />
          {t('oibt.generatePdf')}
        </Button>
      </div>
    </div>
  );
}
