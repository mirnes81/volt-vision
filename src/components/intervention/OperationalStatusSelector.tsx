import * as React from 'react';
import { 
  Clock, Play, Wrench, XCircle, RotateCcw, CheckCircle2, ChevronDown,
  AlertTriangle, Camera, PenTool, Lock
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
  
  const isAdmin = isUserAdmin();
  const canEdit = isAdmin && !readOnly;

  // Load from Supabase
  React.useEffect(() => {
    loadOperationalStatus(intervention.id).then(status => {
      setCurrentStatus(status || 'a_faire');
      setIsLoading(false);
    });
  }, [intervention.id]);

  const handleSelect = async (newStatus: OperationalStatus) => {
    if (!canEdit || isSaving) return;
    setIsOpen(false);

    // If trying to set "terminé", validate prerequisites
    if (newStatus === 'termine') {
      const hasPhotos = intervention.photos.length > 0;
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
      has_closing_photos: intervention.photos.length > 0,
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
          "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border",
          config.bgColor,
          config.color,
          isTermine && 'border-success/40',
          !isTermine && 'border-transparent',
          canEdit && !isSaving && "hover:ring-2 hover:ring-primary/30 cursor-pointer",
          (!canEdit || isSaving) && "cursor-default opacity-90"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{config.label}</span>
        {canEdit && !isSaving && (
          <ChevronDown className={cn("w-3.5 h-3.5 ml-0.5 transition-transform", isOpen && "rotate-180")} />
        )}
        {!canEdit && (
          <Lock className="w-3 h-3 ml-0.5 opacity-50" />
        )}
        {isSaving && (
          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin ml-0.5" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && canEdit && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[220px]">
            <div className="p-2 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground px-2">Changer le statut opérationnel</p>
            </div>
            <div className="p-1">
              {STATUS_ORDER.map((s) => {
                const cfg = OPERATIONAL_STATUS_CONFIG[s];
                const Ic = cfg.icon;
                const isSelected = s === status;
                const isTermineOption = s === 'termine';
                const canSelectTermine = isTermineOption ? (intervention.photos.length > 0 && !!intervention.signaturePath) : true;
                
                return (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    disabled={!canSelectTermine}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/80",
                      !canSelectTermine && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Ic className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.color)} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold leading-tight", cfg.color)}>{cfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{cfg.description}</p>
                      {isTermineOption && !canSelectTermine && (
                        <div className="flex items-center gap-1 mt-1">
                           <AlertTriangle className="w-3 h-3 text-warning" />
                           <span className="text-[10px] text-warning font-medium">
                            {!intervention.signaturePath && !intervention.photos.length 
                              ? 'Signature + photos requises'
                              : !intervention.signaturePath ? 'Signature requise'
                              : 'Au moins 1 photo requise'}
                          </span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 shrink-0 ml-auto text-primary mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Info for non-admins: should never show since canEdit=false, but defensive */}
            <div className="px-3 py-2 border-t border-border/50 bg-muted/30">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3 h-3 text-muted-foreground" />
                <PenTool className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Photos + signature obligatoires pour clôturer</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
