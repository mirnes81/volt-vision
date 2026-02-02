import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SyncLog {
  id: string;
  supplier: string;
  status: string;
  products_added: number;
  products_updated: number;
  products_removed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface SyncStatusCardProps {
  log: SyncLog;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  running: {
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'En cours',
  },
  completed: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Terminé',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'Échec',
  },
};

const supplierNames: Record<string, string> = {
  feller: 'Feller',
  hager: 'Hager',
  em: 'Électromatériel',
};

export function SyncStatusCard({ log }: SyncStatusCardProps) {
  const config = statusConfig[log.status] || statusConfig.completed;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <Badge className={config.color}>
          {config.icon}
          <span className="ml-1">{config.label}</span>
        </Badge>
        <div>
          <div className="font-medium text-sm">
            {supplierNames[log.supplier] || log.supplier}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(log.started_at), "dd MMM yyyy à HH:mm", { locale: fr })}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        {log.status === 'completed' && (
          <div className="text-sm">
            <span className="text-green-600 dark:text-green-400">
              +{log.products_added}
            </span>
            {log.products_updated > 0 && (
              <span className="text-blue-600 dark:text-blue-400 ml-2">
                ~{log.products_updated}
              </span>
            )}
          </div>
        )}
        {log.status === 'failed' && log.error_message && (
          <div className="text-xs text-red-600 dark:text-red-400 max-w-48 truncate" title={log.error_message}>
            {log.error_message}
          </div>
        )}
      </div>
    </div>
  );
}
