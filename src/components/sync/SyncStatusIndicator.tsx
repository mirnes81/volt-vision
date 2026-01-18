import * as React from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePendingSync } from '@/hooks/usePendingSync';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function SyncStatusIndicator({ className, showLabel = false }: SyncStatusIndicatorProps) {
  const { pendingCount, isSyncing, lastSyncAt, errors, syncAll } = usePendingSync();
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
    }
    if (isOffline) {
      return <CloudOff className="h-4 w-4 text-destructive" />;
    }
    if (pendingCount > 0) {
      return <Cloud className="h-4 w-4 text-warning" />;
    }
    if (errors.length > 0) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isSyncing) return 'Synchronisation...';
    if (isOffline) return 'Hors ligne';
    if (pendingCount > 0) return `${pendingCount} en attente`;
    if (errors.length > 0) return 'Erreurs de sync';
    return 'Synchronisé';
  };

  const handleSync = async () => {
    if (!isOffline && pendingCount > 0) {
      await syncAll();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'relative gap-2 px-2',
            pendingCount > 0 && 'text-warning',
            isOffline && 'text-destructive',
            className
          )}
        >
          {getStatusIcon()}
          {showLabel && <span className="text-xs">{getStatusText()}</span>}
          {pendingCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">État de synchronisation</h4>
            {getStatusIcon()}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Connexion</span>
              <span className={isOffline ? 'text-destructive' : 'text-green-500'}>
                {isOffline ? 'Hors ligne' : 'En ligne'}
              </span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>En attente</span>
              <span className={pendingCount > 0 ? 'text-warning font-medium' : ''}>
                {pendingCount} élément(s)
              </span>
            </div>

            {lastSyncAt && (
              <div className="flex justify-between text-muted-foreground">
                <span>Dernière sync</span>
                <span>{formatLastSync(lastSyncAt)}</span>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs">
              <p className="font-medium text-destructive mb-1">Erreurs:</p>
              <ul className="list-disc list-inside space-y-1 text-destructive/80">
                {errors.slice(0, 3).map((error, i) => (
                  <li key={i} className="truncate">{error}</li>
                ))}
                {errors.length > 3 && (
                  <li>...et {errors.length - 3} autres</li>
                )}
              </ul>
            </div>
          )}

          {pendingCount > 0 && !isOffline && (
            <Button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="w-full"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 mr-2" />
                  Synchroniser maintenant
                </>
              )}
            </Button>
          )}

          {isOffline && pendingCount > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Les modifications seront synchronisées automatiquement au retour de la connexion.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatLastSync(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  return date.toLocaleDateString('fr-CH');
}
