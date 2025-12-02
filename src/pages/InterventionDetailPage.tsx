import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, User, AlertTriangle, Clock, Package, CheckSquare, Camera, PenTool, Sparkles, FileCheck, Navigation, Mic, History, Boxes } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { HoursSection } from '@/components/intervention/HoursSection';
import { MaterialsSection } from '@/components/intervention/MaterialsSection';
import { TasksSection } from '@/components/intervention/TasksSection';
import { PhotosSection } from '@/components/intervention/PhotosSection';
import { SignatureSection } from '@/components/intervention/SignatureSection';
import { AiSection } from '@/components/intervention/AiSection';
import { OIBTSection } from '@/components/intervention/OIBTSection';
import { GPSSection } from '@/components/intervention/GPSSection';
import { VoiceNotesSection } from '@/components/intervention/VoiceNotesSection';
import { HistorySection } from '@/components/intervention/HistorySection';
import { StockSection } from '@/components/intervention/StockSection';
import { Skeleton } from '@/components/ui/skeleton';
import { getIntervention } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const typeLabels: Record<string, string> = {
  installation: 'Installation', depannage: 'Dépannage', renovation: 'Rénovation',
  tableau: 'Tableau', cuisine: 'Cuisine', oibt: 'OIBT',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  a_planifier: { label: 'À planifier', color: 'bg-muted text-muted-foreground' },
  en_cours: { label: 'En cours', color: 'bg-primary/10 text-primary' },
  termine: { label: 'Terminé', color: 'bg-success/10 text-success' },
  facture: { label: 'Facturé', color: 'bg-muted text-muted-foreground' },
};

export default function InterventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hours');

  const tabs = [
    { id: 'hours', label: t('tab.hours'), icon: Clock },
    { id: 'materials', label: t('tab.materials'), icon: Package },
    { id: 'tasks', label: t('tab.tasks'), icon: CheckSquare },
    { id: 'photos', label: t('tab.photos'), icon: Camera },
    { id: 'oibt', label: t('tab.oibt'), icon: FileCheck },
    { id: 'gps', label: t('tab.gps'), icon: Navigation },
    { id: 'voice', label: t('tab.voice'), icon: Mic },
    { id: 'ai', label: t('tab.ai'), icon: Sparkles },
    { id: 'history', label: t('tab.history'), icon: History },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'signature', label: t('tab.signature'), icon: PenTool },
  ];

  useEffect(() => {
    if (id) loadIntervention(parseInt(id));
  }, [id]);

  const loadIntervention = async (interventionId: number) => {
    setIsLoading(true);
    try {
      const data = await getIntervention(interventionId);
      setIntervention(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = () => { if (id) loadIntervention(parseInt(id)); };

  if (isLoading) {
    return (
      <div>
        <Header title="..." showBack />
        <div className="px-4 space-y-4 pt-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!intervention) {
    return (
      <div>
        <Header title="Erreur" showBack />
        <div className="px-4 pt-8 text-center text-muted-foreground">Intervention non trouvée</div>
      </div>
    );
  }

  const status = statusConfig[intervention.status];

  return (
    <div className="pb-4">
      <Header title={intervention.ref} showBack />

      <div className="px-4 space-y-4">
        {/* Info Card */}
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 mt-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary">
                  {typeLabels[intervention.type]}
                </span>
                {intervention.priority === 'urgent' && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />{t('common.urgent')}
                  </span>
                )}
              </div>
              <h2 className="font-bold text-lg">{intervention.label}</h2>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold shrink-0", status.color)}>
              {status.label}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{intervention.clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{intervention.location}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-all duration-200",
                  activeTab === tab.id ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'hours' && <HoursSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'materials' && <MaterialsSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'tasks' && <TasksSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'photos' && <PhotosSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'oibt' && <OIBTSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'gps' && <GPSSection intervention={intervention} />}
          {activeTab === 'voice' && <VoiceNotesSection intervention={intervention} />}
          {activeTab === 'ai' && <AiSection intervention={intervention} onUpdate={handleUpdate} />}
          {activeTab === 'history' && <HistorySection intervention={intervention} />}
          {activeTab === 'stock' && <StockSection />}
          {activeTab === 'signature' && <SignatureSection intervention={intervention} onUpdate={handleUpdate} />}
        </div>
      </div>
    </div>
  );
}
