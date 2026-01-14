import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  MapPin, User, AlertTriangle, Clock, Package, CheckSquare, Camera, 
  PenTool, Sparkles, FileCheck, Navigation, Mic, History, Boxes,
  Phone, Mail, FileText, Calendar, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
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
  const [activeTab, setActiveTab] = useState('overview');
  const [showFullDescription, setShowFullDescription] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Détails', icon: FileText },
    { id: 'tasks', label: t('tab.tasks'), icon: CheckSquare },
    { id: 'materials', label: t('tab.materials'), icon: Package },
    { id: 'photos', label: t('tab.photos'), icon: Camera },
    { id: 'hours', label: t('tab.hours'), icon: Clock },
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
      console.log('[InterventionDetail] Loaded:', data);
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
  const assigneeName = intervention.assignedTo 
    ? `${intervention.assignedTo.firstName} ${intervention.assignedTo.name}`.trim()
    : null;

  return (
    <div className="pb-4">
      <Header title={intervention.ref} showBack />

      <div className="px-4 space-y-4">
        {/* Main Info Card */}
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 mt-4">
          {/* Header with status */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {intervention.ref}
                </span>
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

          {/* Linked documents */}
          {intervention.linkedProposalRef && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-secondary/50 rounded-lg">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Devis lié : <span className="text-primary">{intervention.linkedProposalRef}</span></span>
            </div>
          )}

          {/* Client info */}
          <div className="space-y-2 text-sm border-t border-border/50 pt-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Client
            </h3>
            <p className="font-bold text-foreground text-base">{intervention.clientName}</p>
            
            {intervention.clientAddress && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{intervention.clientAddress}</span>
              </div>
            )}
            
            {intervention.clientPhone && (
              <a 
                href={`tel:${intervention.clientPhone}`}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Phone className="w-4 h-4" />
                <span>{intervention.clientPhone}</span>
              </a>
            )}
            
            {intervention.clientEmail && (
              <a 
                href={`mailto:${intervention.clientEmail}`}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                <span className="truncate">{intervention.clientEmail}</span>
              </a>
            )}
          </div>

          {/* Assigned worker */}
          {assigneeName && (
            <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-border/50">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Assigné à :</span>
              <span className="font-semibold text-foreground">{assigneeName}</span>
            </div>
          )}

          {/* Date */}
          {intervention.dateStart && (
            <div className="flex items-center gap-2 text-sm mt-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Date : {new Date(intervention.dateStart).toLocaleDateString('fr-CH')}</span>
            </div>
          )}
        </div>

        {/* Description / Briefing */}
        {(intervention.description || intervention.briefing) && (
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" />
              Description / Briefing
            </h3>
            <div className={cn("text-sm text-muted-foreground", !showFullDescription && "line-clamp-4")}>
              {intervention.briefing || intervention.description}
            </div>
            {(intervention.briefing?.length || 0) > 200 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="mt-2 text-primary"
              >
                {showFullDescription ? (
                  <>Voir moins <ChevronUp className="w-4 h-4 ml-1" /></>
                ) : (
                  <>Voir plus <ChevronDown className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Quick summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-3 text-center border border-border/50">
            <CheckSquare className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{intervention.tasks.length}</p>
            <p className="text-xs text-muted-foreground">Tâches</p>
          </div>
          <div className="bg-card rounded-xl p-3 text-center border border-border/50">
            <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{intervention.materials.length}</p>
            <p className="text-xs text-muted-foreground">Produits</p>
          </div>
          <div className="bg-card rounded-xl p-3 text-center border border-border/50">
            <Camera className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{intervention.photos.length}</p>
            <p className="text-xs text-muted-foreground">Photos</p>
          </div>
        </div>

        {/* Materials preview (if any) */}
        {intervention.materials.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <Package className="w-4 h-4" />
              Produits / Matériaux ({intervention.materials.length})
            </h3>
            <div className="space-y-2">
              {intervention.materials.slice(0, 5).map((mat) => (
                <div key={mat.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{mat.productName}</p>
                    {mat.productRef && (
                      <p className="text-xs text-muted-foreground">Réf: {mat.productRef}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-sm">{mat.qtyUsed} {mat.unit}</p>
                    {mat.price && mat.price > 0 && (
                      <p className="text-xs text-muted-foreground">{mat.price.toFixed(2)} CHF</p>
                    )}
                  </div>
                </div>
              ))}
              {intervention.materials.length > 5 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveTab('materials')}
                  className="w-full mt-2"
                >
                  Voir tous les produits ({intervention.materials.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tasks preview (if any) */}
        {intervention.tasks.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <CheckSquare className="w-4 h-4" />
              Tâches à faire ({intervention.tasks.filter(t => t.status === 'a_faire').length} restantes)
            </h3>
            <div className="space-y-2">
              {intervention.tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-lg">
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    task.status === 'fait' ? "bg-success border-success text-success-foreground" : "border-muted-foreground"
                  )}>
                    {task.status === 'fait' && <CheckSquare className="w-3 h-3" />}
                  </div>
                  <p className={cn(
                    "text-sm flex-1",
                    task.status === 'fait' && "line-through text-muted-foreground"
                  )}>
                    {task.label}
                  </p>
                </div>
              ))}
              {intervention.tasks.length > 5 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveTab('tasks')}
                  className="w-full mt-2"
                >
                  Voir toutes les tâches ({intervention.tasks.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Photos preview */}
        {intervention.photos.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4" />
              Photos ({intervention.photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {intervention.photos.slice(0, 6).map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg bg-secondary overflow-hidden">
                  <img 
                    src={photo.filePath} 
                    alt={`Photo ${photo.type}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </div>
              ))}
            </div>
            {intervention.photos.length > 6 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setActiveTab('photos')}
                className="w-full mt-3"
              >
                Voir toutes les photos ({intervention.photos.length})
              </Button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 pt-4">
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
          {activeTab === 'overview' && null}
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