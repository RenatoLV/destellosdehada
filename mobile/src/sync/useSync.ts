import { useState, useEffect, useCallback } from 'react';
import { 
  getPendingSyncCount, 
  syncAll, 
  subscribeSyncState, 
  SyncState 
} from './syncEngine';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    processingCount: 0,
    failedCount: 0,
    blockedCount: 0,
    lastSyncTime: null,
    lastError: null,
  });

  useEffect(() => {
    // Suscribirse a cambios en el estado de sincronización
    const unsubscribe = subscribeSyncState((newState) => {
      setSyncState(newState);
    });

    // Cargar conteo inicial
    getPendingSyncCount().then((count) => {
      setSyncState((prev) => ({ ...prev, pendingCount: count }));
    });

    return () => unsubscribe();
  }, []);

  const triggerSync = useCallback(async () => {
    return await syncAll();
  }, []);

  return {
    ...syncState,
    syncNow: triggerSync,
  };
}
