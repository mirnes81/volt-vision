import * as React from 'react';
import { 
  Clock, Play, Wrench, XCircle, RotateCcw, CheckCircle2, ChevronDown,
  AlertTriangle, Camera, PenTool, Lock, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Intervention } from '@/types/intervention';

export type OperationalStatus = 
  | 'a_faire' 
  | 'en_cours' 
  | 'a_terminer' 
  | 'pas_termine' 
  | 'a_revenir' 
  | 'termine';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface OperationalStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  description: string;
}

export const OPERATIONAL_STATUS_CONFIG: Record<OperationalStatus, OperationalStatusConfig> = {
  a_faire: { 
    label: 'À faire', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted/60',
    icon: Clock,
    description: 'Intervention planifiée, pas encore commencée'
  },
  en_cours: { 
    label: 'En cours', 
    color: 'text-primary', 
    bgColor: 'bg-primary/10',
    icon: Play,
    description: 'Intervention en cours de réalisation'
  },
  a_terminer: { 
    label: 'À terminer', 
    color: 'text-warning', 
    bgColor: 'bg-warning/10',
    icon: Wrench,
    description: 'Intervention commencée, doit être terminée'
  },
  pas_termine: { 
    label: 'Pas terminé', 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    icon: XCircle,
    description: 'Intervention non terminée'
  },
  a_revenir: { 
    label: 'À revenir', 
    color: 'text-accent', 
    bgColor: 'bg-accent/10',
    icon: RotateCcw,
    description: 'Une visite de retour est nécessaire'
  },
  termine: { 
    label: 'Terminé ✓', 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    icon: CheckCircle2,
    description: 'Intervention entièrement terminée (signature + photos requises)'
  },
};

const STATUS_ORDER: OperationalStatus[] = [
  'a_faire', 'en_cours', 'a_terminer', 'pas_termine', 'a_revenir', 'termine'
];

interface Props {
  intervention: Intervention;
  onStatusChange?: (status: OperationalStatus) => void;
  readOnly?: boolean;
}

function isUserAdmin(): boolean {
  try {
    const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
    if (!workerData) return false;
    const worker = JSON.parse(workerData);
    return worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
  } catch { return false; }
}

export async function loadOperationalStatus(interventionId: number): Promise<OperationalStatus | null> {
  const { data, error } = await supabase
    .from('intervention_operational_status')
    .select('operational_status')
    .eq('intervention_id', interventionId)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.operational_status as OperationalStatus;
}

export async function saveOperationalStatus(
  interventionId: number, 
  status: OperationalStatus,
  extras?: { has_signature?: boolean; has_closing_photos?: boolean }
): Promise<boolean> {
  try {
    const workerData = localStorage.getItem('mv3_worker');
    const worker = workerData ? JSON.parse(workerData) : null;
    const updatedBy = worker ? `${worker.firstName || ''} ${worker.name || ''}`.trim() : 'unknown';

    const payload = {
      intervention_id: interventionId,
      tenant_id: TENANT_ID,
      operational_status: status,
      updated_by: updatedBy,
      ...(status === 'termine' ? {
        completed_at: new Date().toISOString(),
        completed_by: updatedBy,
      } : {}),
      ...(extras || {}),
    };

    const { error } = await supabase
      .from('intervention_operational_status')
      .upsert(payload, { onConflict: 'intervention_id,tenant_id' });

    return !error;
  } catch {
    return false;
  }
}

export function OperationalStatusSelector({ intervention, onStatusChange, readOnly }: Props) {
  const [currentStatus, setCurrentStatus] = React.useState<OperationalStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasCloudPhotos, setHasCloudPhotos] = React.useState(false);
  
  const isAdmin = isUserAdmin();
  const canEdit = isAdmin && !readOnly;

  // Load from Supabase
  React.useEffect(() => {
    loadOperationalStatus(intervention.id).then(status => {
      setCurrentStatus(status || 'a_faire');
      setIsLoading(false);
    });
    
    // Check for cloud photos in storage bucket
    async function checkCloudPhotos() {
      try {
        const { data: files } = await supabase.storage
          .from('intervention-photos')
          .list(String(intervention.id), { limit: 1 });
        const realFiles = files?.filter(f => f.name !== '.emptyFolderPlaceholder') || [];
        setHasCloudPhotos(realFiles.length > 0);
      } catch {
        setHasCloudPhotos(false);
      }
    }
    checkCloudPhotos();
  }, [intervention.id]);

  const handleSelect = async (newStatus: OperationalStatus) => {
    if (!canEdit || isSaving) return;
    setIsOpen(false);

    // If trying to set "terminé", validate prerequisites
    if (newStatus === 'termine') {
      const hasPhotos = intervention.photos.length > 0 || hasCloudPhotos;
      const hasSignature = !!intervention.signaturePath;
      
      if (!hasPhotos || !hasSignature) {
        const missing = [];
        if (!hasSignature) missing.push('signature du client/technicien');
        if (!hasPhotos) missing.push('au moins une photo');
        
        toast.error('Clôture impossible', {
          description: `Requis avant de terminer: ${missing.join(' et ')}`,
          duration: 5000,
        });
        return;
      }
    }

    setIsSaving(true);
    const success = await saveOperationalStatus(intervention.id, newStatus, {
      has_signature: !!intervention.signaturePath,
      has_closing_photos: intervention.photos.length > 0 || hasCloudPhotos,
    });

    if (success) {
      setCurrentStatus(newStatus);
      onStatusChange?.(newStatus);
      toast.success(`Statut: ${OPERATIONAL_STATUS_CONFIG[newStatus].label}`);
    } else {
      toast.error('Erreur lors de la mise à jour du statut');
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="h-9 w-36 bg-muted/50 rounded-lg animate-pulse" />
    );
  }

  const status = currentStatus || 'a_faire';
  const config = OPERATIONAL_STATUS_CONFIG[status];
  const Icon = config.icon;
  const isTermine = status === 'termine';

  return (
    <div className="relative">
      {/* Current status badge / button */}
      <button
        onClick={() => canEdit && !isSaving && setIsOpen(!isOpen)}
        disabled={!canEdit || isSaving}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all border",
          config.bgColor,
          config.color,
          isTermine && 'border-success/40',
          !isTermine && 'border-transparent',
          canEdit && !isSaving && "active:scale-95 cursor-pointer",
          (!canEdit || isSaving) && "cursor-default opacity-90"
        )}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="leading-none">{config.label}</span>
        {canEdit && !isSaving && (
          <ChevronDown className={cn("w-3 h-3 ml-0.5 transition-transform", isOpen && "rotate-180")} />
        )}
        {!canEdit && (
          <Lock className="w-3 h-3 ml-0.5 opacity-50" />
        )}
        {isSaving && (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-0.5" />
        )}
      </button>

      {/* Mobile Bottom Sheet */}
      {isOpen && canEdit && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)} 
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-2xl border-t border-border overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-4 pb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Statut opérationnel</p>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Options */}
            <div className="px-3 pb-4 space-y-1.5 max-h-[60vh] overflow-y-auto">
              {STATUS_ORDER.map((s) => {
                const cfg = OPERATIONAL_STATUS_CONFIG[s];
                const Ic = cfg.icon;
                const isSelected = s === status;
                const isTermineOption = s === 'termine';
                const canSelectTermine = isTermineOption
                  ? ((intervention.photos.length > 0 || hasCloudPhotos) && !!intervention.signaturePath)
                  : true;
                
                return (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    disabled={!canSelectTermine}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98]",
                      isSelected 
                        ? cn("border-2", cfg.bgColor, cfg.color.replace('text-', 'border-').split(' ')[0])
                        : "bg-secondary/60 hover:bg-secondary border-2 border-transparent",
                      !canSelectTermine && "opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? cfg.bgColor : "bg-muted"
                    )}>
                      <Ic className={cn("w-5 h-5", isSelected ? cfg.color : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-sm font-semibold leading-tight",
                        isSelected ? cfg.color : "text-foreground"
                      )}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{cfg.description}</p>
                      {isTermineOption && !canSelectTermine && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <AlertTriangle className="w-3 h-3 text-warning" />
                          <span className="text-[10px] text-warning font-medium">
                            {!intervention.signaturePath && !(intervention.photos.length > 0 || hasCloudPhotos) 
                              ? 'Signature + photos requises'
                              : !intervention.signaturePath ? 'Signature requise'
                              : 'Au moins 1 photo requise'}
                          </span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2 className={cn("w-5 h-5 shrink-0", cfg.color)} />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Info footer */}
            <div className="px-4 py-3 border-t border-border/50 bg-muted/30 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <PenTool className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Photos + signature obligatoires pour clôturer</p>
            </div>
            {/* Safe area bottom */}
            <div className="pb-safe h-4" />
          </div>
        </>
      )}
    </div>
  );
}
