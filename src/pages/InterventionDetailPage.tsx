import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { 
  MapPin, User, AlertTriangle, Clock, Package, CheckSquare, Camera, 
  PenTool, Sparkles, FileCheck, Navigation, Mic, History, Boxes,
  Phone, Mail, FileText, Calendar, ExternalLink, ChevronDown, ChevronUp, 
  Bell, BellRing, Zap, Hash, Key, Lock, Home, Building2, Timer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { HoursSection } from '@/components/intervention/HoursSection';
import { CreateEmergencyDialog } from '@/components/emergency/CreateEmergencyDialog';
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
import { ReportNotesSection } from '@/components/intervention/ReportNotesSection';
import { DateEditDialog, getDateOverride } from '@/components/intervention/DateEditDialog';
import { OperationalStatusSelector } from '@/components/intervention/OperationalStatusSelector';
import { DolibarrAssignmentPanel } from '@/components/assignments/DolibarrAssignmentPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getIntervention } from '@/lib/api';
import { Intervention } from '@/types/intervention';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { 
  scheduleInterventionReminder, 
  cancelInterventionReminder,
  hasReminderScheduled,
  formatTimeRemaining,
  getReminderSettings
} from '@/lib/interventionReminders';

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

// Tab groups for mobile bottom bar
const TAB_GROUPS = [
  { id: 'info', label: 'Info', icon: FileText },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'tools', label: 'Outils', icon: Sparkles },
  { id: 'more', label: 'Plus', icon: ChevronDown },
];

const MORE_TABS = [
  { id: 'hours', label: 'Heures', icon: Clock },
  { id: 'oibt', label: 'OIBT', icon: FileCheck },
  { id: 'gps', label: 'GPS', icon: Navigation },
  { id: 'voice', label: 'Notes', icon: Mic },
  { id: 'report', label: 'Rapport', icon: FileText },
  { id: 'ai', label: 'IA', icon: Sparkles },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'signature', label: 'Signature', icon: PenTool },
];

export default function InterventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [intervention, setIntervention] = React.useState<Intervention | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<'waf' | 'generic' | null>(null);
  const [activeTab, setActiveTab] = React.useState('info');
  const [showFullDescription, setShowFullDescription] = React.useState(false);
  const [hasReminder, setHasReminder] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const [estimatedHours, setEstimatedHours] = React.useState<string>('');
  const [isSavingHours, setIsSavingHours] = React.useState(false);
  
  // Use global assignments context
  const { getAssignmentsForIntervention, refresh: refreshAssignments } = useAssignments();
  const supabaseAssignments = id ? getAssignmentsForIntervention(parseInt(id)) : [];

  React.useEffect(() => {
    if (id) loadIntervention(parseInt(id));
  }, [id]);

  React.useEffect(() => {
    if (id) setHasReminder(hasReminderScheduled(parseInt(id)));
  }, [id, intervention]);

  // Load estimated hours from Supabase
  React.useEffect(() => {
    if (!id) return;
    const TENANT_ID = '00000000-0000-0000-0000-000000000001';
    supabase
      .from('intervention_operational_status')
      .select('estimated_hours')
      .eq('intervention_id', parseInt(id))
      .eq('tenant_id', TENANT_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.estimated_hours != null) {
          setEstimatedHours(String(data.estimated_hours));
        }
      });
  }, [id]);

  const handleSaveEstimatedHours = async () => {
    if (!id) return;
    const TENANT_ID = '00000000-0000-0000-0000-000000000001';
    const hours = estimatedHours ? parseFloat(estimatedHours) : null;
    setIsSavingHours(true);
    try {
      const { error } = await supabase
        .from('intervention_operational_status')
        .upsert({
          intervention_id: parseInt(id),
          tenant_id: TENANT_ID,
          estimated_hours: hours,
        }, { onConflict: 'intervention_id,tenant_id' });
      if (error) throw error;
      toast.success(hours ? `${hours}h prévues enregistrées` : 'Heures prévues supprimées');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingHours(false);
    }
  };

  const loadIntervention = async (interventionId: number) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getIntervention(interventionId);
      setIntervention(data);
      setHasReminder(hasReminderScheduled(interventionId));
    } catch (error: any) {
      console.error('Error loading intervention:', error);
      if (error?.message === 'DOLIBARR_WAF_BLOCKED') {
        setLoadError('waf');
      } else {
        setLoadError('generic');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReminder = () => {
    if (!intervention || !id) return;
    const interventionId = parseInt(id);
    if (hasReminder) {
      cancelInterventionReminder(interventionId);
      setHasReminder(false);
      toast.success('Rappel supprimé');
    } else {
      if (!intervention.dateStart) { toast.error('Pas de date d\'intervention définie'); return; }
      const settings = getReminderSettings();
      if (!settings.enabled) { toast.error('Activez les rappels dans les paramètres'); return; }
      const success = scheduleInterventionReminder(
        interventionId, intervention.ref, intervention.clientName,
        intervention.dateStart, intervention.extraAdresse || intervention.clientAddress
      );
      if (success) {
        setHasReminder(true);
        toast.success(`Rappel programmé (${settings.timeBefore} min avant)`, {
          description: `Intervention ${formatTimeRemaining(intervention.dateStart)}`,
        });
      } else {
        toast.error('Impossible de programmer le rappel', { description: 'La date est peut-être déjà passée' });
      }
    }
  };

  const handleUpdate = async () => {
    try {
      if (id) {
        await refreshAssignments();
        await loadIntervention(parseInt(id));
      }
    } catch (error) {
      console.error('[InterventionDetail] handleUpdate error:', error);
    }
  };

  const primaryAssignment = supabaseAssignments.find(a => a.is_primary) || supabaseAssignments[0];
  const assigneeName = primaryAssignment 
    ? primaryAssignment.user_name
    : intervention?.assignedTo 
      ? `${intervention.assignedTo.firstName} ${intervention.assignedTo.name}`.trim()
      : null;

  // Admin check
  const isAdmin = React.useMemo(() => {
    try {
      const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
      if (!workerData) return false;
      const worker = JSON.parse(workerData);
      return worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
    } catch { return false; }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="..." showBack />
        <div className="px-4 space-y-3 pt-4 pb-24">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError === 'waf') {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Connexion bloquée" showBack />
        <div className="px-4 pt-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-bold text-lg">Accès bloqué par le pare-feu</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Le serveur Dolibarr a bloqué la connexion (erreur 510 — ModSecurity WAF).
          </p>
          <div className="bg-muted rounded-xl p-4 text-left text-xs text-muted-foreground space-y-1 w-full max-w-sm">
            <p className="font-semibold text-foreground mb-2">Résolution :</p>
            <p>• Connectez-vous à votre hébergeur Hoststar</p>
            <p>• Désactivez ou whitelist ModSecurity pour les IPs :</p>
            <p className="font-mono bg-background px-2 py-1 rounded text-primary">3.74.222.60</p>
            <p className="font-mono bg-background px-2 py-1 rounded text-primary">18.195.204.244</p>
            <p className="mt-2">• Ou utilisez le lien de désactivation fourni dans l'email du pare-feu</p>
          </div>
          <Button onClick={() => id && loadIntervention(parseInt(id))} variant="outline" className="mt-2">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (loadError === 'generic' || !intervention) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Erreur" showBack />
        <div className="px-4 pt-10 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Intervention non trouvée ou erreur de chargement.</p>
          <Button onClick={() => id && loadIntervention(parseInt(id))} variant="outline">Réessayer</Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[intervention.status] || statusConfig.a_planifier;
  const localOverride = getDateOverride(intervention.id);
  const displayDate = localOverride || intervention.dateStart;
  const dateObj = displayDate ? new Date(displayDate) : null;
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const handleTabSelect = (tabId: string) => {
    if (tabId === 'more') {
      setShowMoreMenu(!showMoreMenu);
      return;
    }
    setActiveTab(tabId);
    setShowMoreMenu(false);
  };

  const handleMoreTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    setShowMoreMenu(false);
  };

  const activeTabGroup = MORE_TABS.find(t => t.id === activeTab) ? 'more' : activeTab;

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info': return <InfoTab />;
      case 'tasks': return <TasksSection intervention={intervention} onUpdate={handleUpdate} />;
      case 'photos': return <PhotosSection intervention={intervention} onUpdate={handleUpdate} />;
      case 'tools': return <ToolsTab />;
      case 'hours': return <HoursSection intervention={intervention} onUpdate={handleUpdate} />;
      case 'oibt': return <OIBTSection intervention={intervention} onUpdate={handleUpdate} />;
      case 'gps': return <GPSSection intervention={intervention} />;
      case 'voice': return <VoiceNotesSection intervention={intervention} />;
      case 'report': return <ReportNotesSection intervention={intervention} />;
      case 'ai': return <AiSection intervention={intervention} onUpdate={handleUpdate} />;
      case 'history': return <HistorySection intervention={intervention} />;
      case 'stock': return <StockSection />;
      case 'signature': return <SignatureSection intervention={intervention} onUpdate={handleUpdate} />;
      default: return <InfoTab />;
    }
  };

  // Info Tab - Main intervention details
  const InfoTab = () => (
    <div className="space-y-3">
      {/* Extra fields */}
      {(intervention.extraBon || intervention.extraAdresse || intervention.extraContact || 
        intervention.extraCle || intervention.extraCode || intervention.extraNoImm || 
        intervention.extraAdresseComplete || intervention.extraNCompt || 
        intervention.extraPropImm || intervention.extraConcierge || intervention.extraAppartement) && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations</h3>
          </div>
          <div className="p-3 space-y-2">
            {intervention.extraBon && (
              <div className="flex items-center justify-between py-1.5 px-2 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">N° Bon</span>
                </div>
                <span className="text-sm font-bold text-primary">{intervention.extraBon}</span>
              </div>
            )}
            {intervention.extraNoImm && (
              <div className="flex items-center justify-between py-1 px-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />N° Immeuble</span>
                <span className="text-sm font-semibold">{intervention.extraNoImm}</span>
              </div>
            )}
            {intervention.extraPropImm && (
              <div className="flex items-center justify-between py-1 px-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Propriétaire</span>
                <span className="text-sm font-semibold">{intervention.extraPropImm}</span>
              </div>
            )}
            {intervention.extraAppartement && (
              <div className="flex items-center justify-between py-1 px-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Home className="w-3.5 h-3.5" />Appartement</span>
                <span className="text-sm font-semibold">{intervention.extraAppartement}</span>
              </div>
            )}
            {intervention.extraConcierge && (
              <div className="flex items-center justify-between py-1 px-2">
                <span className="text-xs text-muted-foreground">🏠 Concierge</span>
                <span className="text-sm font-semibold">{intervention.extraConcierge}</span>
              </div>
            )}
            {intervention.extraNCompt && (
              <div className="flex items-center justify-between py-1 px-2">
                <span className="text-xs text-muted-foreground">⚡ N° Compteur</span>
                <span className="text-sm font-semibold">{intervention.extraNCompt}</span>
              </div>
            )}
            {(intervention.extraAdresse || intervention.extraAdresseComplete) && (
              <div className="flex items-start gap-2 py-1 px-2">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{intervention.extraAdresse || intervention.extraAdresseComplete}</span>
              </div>
            )}
            {intervention.extraContact && (
              <div className="flex items-center gap-2 py-1 px-2">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm">{intervention.extraContact}</span>
              </div>
            )}
            {(intervention.extraCle || intervention.extraCode) && (
              <div className="flex items-center gap-2 flex-wrap py-1 px-2">
                {intervention.extraCle && (
                  <div className="flex items-center gap-1.5 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-lg font-medium">
                    <Key className="w-3.5 h-3.5" />
                    <span>Clé: {intervention.extraCle}</span>
                  </div>
                )}
                {intervention.extraCode && (
                  <div className="flex items-center gap-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-lg font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Code: {intervention.extraCode}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</h3>
        </div>
        <div className="p-3 space-y-2">
          <p className="font-bold text-base">{intervention.clientName}</p>
          {intervention.clientAddress && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <span>{intervention.clientAddress}</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {intervention.clientPhone && (
              <a href={`tel:${intervention.clientPhone}`}
                className="flex items-center gap-1.5 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-lg font-medium active:scale-95 transition-transform">
                <Phone className="w-4 h-4" />
                <span>{intervention.clientPhone}</span>
              </a>
            )}
            {intervention.clientEmail && (
              <a href={`mailto:${intervention.clientEmail}`}
                className="flex items-center gap-1.5 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-lg font-medium active:scale-95 transition-transform truncate max-w-full">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{intervention.clientEmail}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Linked proposal */}
      {intervention.linkedProposalRef && (
        <div className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm">Devis lié : <span className="text-primary font-semibold">{intervention.linkedProposalRef}</span></span>
        </div>
      )}

      {/* Description */}
      {(intervention.description || intervention.briefing) && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description / Briefing</h3>
          </div>
          <div className="p-3 space-y-2">
            {intervention.briefing && (
              <p className="text-sm whitespace-pre-wrap">{intervention.briefing}</p>
            )}
            {intervention.description && (
              <>
                <button onClick={() => setShowFullDescription(!showFullDescription)}
                  className="flex items-center gap-2 text-sm font-medium text-primary">
                  <span>{showFullDescription ? 'Masquer' : 'Description complète'}</span>
                  {showFullDescription ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showFullDescription && (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">
                    {intervention.description}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick summary */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setActiveTab('tasks')}
          className="bg-card rounded-xl p-3 text-center border border-border/50 active:scale-95 transition-transform">
          <CheckSquare className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{intervention.tasks.length}</p>
          <p className="text-xs text-muted-foreground">Tâches</p>
        </button>
        <button onClick={() => setActiveTab('photos')}
          className="bg-card rounded-xl p-3 text-center border border-border/50 active:scale-95 transition-transform">
          <Camera className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{intervention.photos.length}</p>
          <p className="text-xs text-muted-foreground">Photos</p>
        </button>
        <button onClick={() => setActiveTab('signature')}
          className="bg-card rounded-xl p-3 text-center border border-border/50 active:scale-95 transition-transform">
          <PenTool className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{intervention.signaturePath ? '✓' : '—'}</p>
          <p className="text-xs text-muted-foreground">Signature</p>
        </button>
      </div>

      {/* Materials preview */}
      {intervention.materials.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Matériaux ({intervention.materials.length})
            </h3>
            <button onClick={() => setActiveTab('materials')} className="text-xs text-primary font-medium">Voir tout</button>
          </div>
          <div className="divide-y divide-border/30">
            {intervention.materials.slice(0, 4).map((mat) => (
              <div key={mat.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{mat.productName}</p>
                  {mat.productRef && <p className="text-xs text-muted-foreground">Réf: {mat.productRef}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-semibold text-sm">{mat.qtyUsed} {mat.unit}</p>
                  {mat.price && mat.price > 0 && <p className="text-xs text-muted-foreground">{mat.price.toFixed(2)} CHF</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Tools Tab - quick access to more functions
  const ToolsTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {MORE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="bg-card rounded-2xl p-4 flex flex-col items-center gap-2 border border-border/50 active:scale-95 transition-transform hover:border-primary/30"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header title={intervention.ref} showBack />

      {/* Hero card - compact on mobile */}
      <div className="px-3 pt-3 pb-0">
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {/* Top strip: badges + operational status */}
          <div className="px-3 pt-3 pb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {intervention.ref}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {typeLabels[intervention.type] || intervention.type}
                </span>
                {intervention.priority === 'urgent' && (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />Urgent
                  </span>
                )}
              </div>
              <h2 className="font-bold text-base leading-tight">{intervention.label}</h2>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">{intervention.clientName}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", status.color)}>
                {status.label}
              </span>
              <OperationalStatusSelector
                intervention={intervention}
                onStatusChange={handleUpdate}
                readOnly={!isAdmin}
              />
            </div>
          </div>

          {/* Date row */}
          {dateObj && (
            <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm">
                  {dayNames[dateObj.getDay()]} {dateObj.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {(dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0) && (
                  <span className="text-primary font-medium text-sm">
                    • {dateObj.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {isAdmin && (
                  <DateEditDialog
                    interventionId={intervention.id}
                    currentDate={localOverride || intervention.dateStart}
                    onDateUpdated={handleUpdate}
                  />
                )}
              </div>
              <Button
                variant={hasReminder ? "default" : "ghost"}
                size="sm"
                onClick={handleToggleReminder}
                className={cn("h-8 w-8 p-0 rounded-full", hasReminder && "bg-primary text-primary-foreground")}
              >
                {hasReminder ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </Button>
            </div>
          )}

          {/* Estimated hours row (admin only) */}
          {isAdmin && (
            <div className="px-3 py-2 border-t border-border/40 flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground font-medium">Heures prévues</span>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="—"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                onBlur={handleSaveEstimatedHours}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEstimatedHours()}
                className="w-16 h-7 text-xs text-center font-bold px-1"
                disabled={isSavingHours}
              />
              <span className="text-xs text-muted-foreground">h</span>
              {isSavingHours && (
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}

          {/* Estimated hours display (non-admin) */}
          {!isAdmin && estimatedHours && (
            <div className="px-3 py-2 border-t border-border/40 flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground font-medium">Heures prévues</span>
              <span className="text-sm font-bold text-primary">{estimatedHours}h</span>
            </div>
          )}

          {/* Location row */}
          {(intervention.extraAdresse || intervention.location) && (
            <div className="px-3 py-2 border-t border-border/40 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm truncate">{intervention.extraAdresse || intervention.location}</span>
            </div>
          )}

          {/* Bottom actions row */}
          <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between gap-2">
            {/* Assignee */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {assigneeName || <span className="text-muted-foreground text-xs">Non assigné</span>}
              </span>
              {supabaseAssignments.length > 1 && (
                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">
                  +{supabaseAssignments.length - 1}
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <CreateEmergencyDialog
                intervention={intervention}
                trigger={
                  <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-destructive border-destructive/40 hover:bg-destructive/10 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Urgence</span>
                  </Button>
                }
              />
              {isAdmin && (
                <DolibarrAssignmentPanel
                  interventionId={intervention.id}
                  interventionRef={intervention.ref}
                  interventionLabel={intervention.label}
                  clientName={intervention.clientName}
                  location={intervention.location}
                  datePlanned={intervention.dateStart}
                  priority={intervention.priority as 'normal' | 'urgent' | 'critical'}
                  description={intervention.description}
                  onAssignmentsChange={handleUpdate}
                  initialAssignmentsCount={supabaseAssignments.length}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab content - scrollable */}
      <div className="flex-1 px-3 pt-3 pb-24 overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Bottom tab bar - mobile fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        {/* More menu popup */}
        {showMoreMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowMoreMenu(false)} />
            <div className="absolute bottom-full left-0 right-0 bg-card border-t border-border shadow-lg z-30 p-3">
              <div className="grid grid-cols-4 gap-2">
                {MORE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleMoreTabSelect(tab.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Main tab bar */}
        <div className="flex items-stretch h-16">
          {TAB_GROUPS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === 'more' 
              ? showMoreMenu || activeTabGroup === 'more'
              : activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 relative",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
              >
                {isActive && tab.id !== 'more' && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                  isActive ? "bg-primary/10" : ""
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.id === 'tasks' && intervention.tasks.length > 0
                    ? `${tab.label} (${intervention.tasks.length})`
                    : tab.id === 'photos' && intervention.photos.length > 0
                    ? `${tab.label} (${intervention.photos.length})`
                    : tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
