import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getPendingSync, 
  clearPendingSync, 
  deletePendingSyncItem,
  PendingSyncItem 
} from '@/lib/offlineStorage';
import { syncPendingItem } from '@/lib/syncService';
import { toast } from '@/components/ui/sonner';

interface SyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  errors: string[];
}

export function usePendingSync() {
  const [state, setState] = useState<SyncState>({
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    errors: [],
  });
  const syncInProgress = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load pending count on mount
  const loadPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSync();
      setState(prev => ({ ...prev, pendingCount: pending.length }));
    } catch (error) {
      console.error('[Sync] Failed to load pending count:', error);
    }
  }, []);

  // Sync all pending items
  const syncAll = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (syncInProgress.current || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    syncInProgress.current = true;
    setState(prev => ({ ...prev, isSyncing: true, errors: [] }));

    const pending = await getPendingSync();
    if (pending.length === 0) {
      syncInProgress.current = false;
      setState(prev => ({ ...prev, isSyncing: false }));
      return { success: 0, failed: 0 };
    }

    console.log(`[Sync] Starting sync of ${pending.length} items...`);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of pending) {
      try {
        await syncPendingItem(item);
        await deletePendingSyncItem(item.id);
        success++;
        console.log(`[Sync] Synced ${item.type} for intervention ${item.interventionId}`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push(`${item.type} (INT-${item.interventionId}): ${errorMsg}`);
        console.error(`[Sync] Failed to sync item ${item.id}:`, error);
      }
    }

    setState(prev => ({
      ...prev,
      pendingCount: failed,
      isSyncing: false,
      lastSyncAt: new Date(),
      errors,
    }));

    syncInProgress.current = false;

    // Show toast with results
    if (success > 0 && failed === 0) {
      toast.success(`${success} élément(s) synchronisé(s)`);
    } else if (success > 0 && failed > 0) {
      toast.warning(`${success} synchronisé(s), ${failed} en erreur`);
    } else if (failed > 0) {
      toast.error(`Échec de synchronisation: ${failed} élément(s)`);
    }

    return { success, failed };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Sync] Back online, triggering sync...');
      // Small delay to ensure connection is stable
      setTimeout(() => {
        syncAll();
      }, 1000);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAll]);

  // Periodic check for pending items
  useEffect(() => {
    loadPendingCount();

    // Check every 30 seconds
    intervalRef.current = setInterval(() => {
      loadPendingCount();
      // Auto-sync if online and has pending items
      if (navigator.onLine && state.pendingCount > 0 && !syncInProgress.current) {
        syncAll();
      }
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadPendingCount, syncAll, state.pendingCount]);

  // Manual trigger to update pending count (call after adding items)
  const refreshPendingCount = useCallback(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  return {
    pendingCount: state.pendingCount,
    isSyncing: state.isSyncing,
    lastSyncAt: state.lastSyncAt,
    errors: state.errors,
    syncAll,
    refreshPendingCount,
  };
}
