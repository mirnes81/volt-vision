import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Intervention, WorkerHour, Material, Task } from '@/types/intervention';

// Export the pending sync item type
export interface PendingSyncItem {
  id: number;
  type: 'hour' | 'material' | 'task' | 'photo' | 'signature' | 'note';
  interventionId: number;
  data: unknown;
  createdAt: string;
  retryCount?: number;
}

interface MV3DB extends DBSchema {
  interventions: {
    key: number;
    value: Intervention;
    indexes: { 'by-status': string };
  };
  pendingSync: {
    key: number;
    value: PendingSyncItem;
  };
  voiceNotes: {
    key: number;
    value: {
      id: number;
      interventionId: number;
      audioBlob: Blob;
      duration: number;
      createdAt: string;
    };
  };
  vehicleStock: {
    key: number;
    value: {
      productId: number;
      productName: string;
      quantity: number;
      minQuantity: number;
      unit: string;
    };
  };
}

let db: IDBPDatabase<MV3DB> | null = null;

export async function initDB(): Promise<IDBPDatabase<MV3DB>> {
  if (db) return db;
  
  db = await openDB<MV3DB>('mv3-electricien', 2, {
    upgrade(db, oldVersion) {
      // Interventions store
      if (!db.objectStoreNames.contains('interventions')) {
        const interventionStore = db.createObjectStore('interventions', { keyPath: 'id' });
        interventionStore.createIndex('by-status', 'status');
      }
      
      // Pending sync store
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
      
      // Voice notes store
      if (!db.objectStoreNames.contains('voiceNotes')) {
        db.createObjectStore('voiceNotes', { keyPath: 'id', autoIncrement: true });
      }
      
      // Vehicle stock store
      if (!db.objectStoreNames.contains('vehicleStock')) {
        db.createObjectStore('vehicleStock', { keyPath: 'productId' });
      }
    },
  });
  
  return db;
}

// Interventions
export async function saveInterventionsOffline(interventions: Intervention[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('interventions', 'readwrite');
  
  for (const intervention of interventions) {
    await tx.store.put(intervention);
  }
  
  await tx.done;
}

export async function getInterventionsOffline(): Promise<Intervention[]> {
  const database = await initDB();
  return database.getAll('interventions');
}

export async function getInterventionOffline(id: number): Promise<Intervention | undefined> {
  const database = await initDB();
  return database.get('interventions', id);
}

// Pending sync
export async function addPendingSync(
  type: 'hour' | 'material' | 'task' | 'photo' | 'signature' | 'note',
  interventionId: number,
  data: unknown
): Promise<void> {
  const database = await initDB();
  await database.add('pendingSync', {
    id: Date.now(),
    type,
    interventionId,
    data,
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingSync(): Promise<PendingSyncItem[]> {
  const database = await initDB();
  return database.getAll('pendingSync');
}

export async function getPendingSyncCount(): Promise<number> {
  const database = await initDB();
  return database.count('pendingSync');
}

export async function deletePendingSyncItem(id: number): Promise<void> {
  const database = await initDB();
  await database.delete('pendingSync', id);
}

export async function clearPendingSync(): Promise<void> {
  const database = await initDB();
  await database.clear('pendingSync');
}

// Clean up corrupted pending sync items (e.g., with undefined interventionId)
export async function cleanupCorruptedPendingSync(): Promise<number> {
  const database = await initDB();
  const pending = await database.getAll('pendingSync');
  let removedCount = 0;
  
  for (const item of pending) {
    // Remove items with invalid interventionId
    if (!item.interventionId || isNaN(item.interventionId)) {
      await database.delete('pendingSync', item.id);
      removedCount++;
      console.log('[OfflineStorage] Removed corrupted sync item:', item.id, item.type);
    }
  }
  
  if (removedCount > 0) {
    console.log(`[OfflineStorage] Cleaned up ${removedCount} corrupted sync items`);
  }
  
  return removedCount;
}

// Voice notes
export async function saveVoiceNote(
  interventionId: number,
  audioBlob: Blob,
  duration: number
): Promise<number> {
  const database = await initDB();
  const id = await database.add('voiceNotes', {
    id: Date.now(),
    interventionId,
    audioBlob,
    duration,
    createdAt: new Date().toISOString(),
  });
  return id as number;
}

export async function getVoiceNotes(interventionId: number): Promise<MV3DB['voiceNotes']['value'][]> {
  const database = await initDB();
  const all = await database.getAll('voiceNotes');
  return all.filter(note => note.interventionId === interventionId);
}

export async function deleteVoiceNote(id: number): Promise<void> {
  const database = await initDB();
  await database.delete('voiceNotes', id);
}

// Vehicle stock
export async function initVehicleStock(): Promise<void> {
  const database = await initDB();
  const existing = await database.getAll('vehicleStock');
  
  if (existing.length === 0) {
    // Initialize with default stock
    const defaultStock = [
      { productId: 1, productName: 'Câble 2.5mm² (m)', quantity: 100, minQuantity: 20, unit: 'm' },
      { productId: 2, productName: 'Câble 4mm² (m)', quantity: 50, minQuantity: 15, unit: 'm' },
      { productId: 3, productName: 'Prise T13', quantity: 20, minQuantity: 5, unit: 'pce' },
      { productId: 4, productName: 'Prise T23', quantity: 15, minQuantity: 5, unit: 'pce' },
      { productId: 5, productName: 'Interrupteur simple', quantity: 15, minQuantity: 5, unit: 'pce' },
      { productId: 6, productName: 'Interrupteur double', quantity: 10, minQuantity: 3, unit: 'pce' },
      { productId: 7, productName: 'Disjoncteur 16A', quantity: 12, minQuantity: 4, unit: 'pce' },
      { productId: 8, productName: 'Disjoncteur 32A', quantity: 6, minQuantity: 2, unit: 'pce' },
      { productId: 9, productName: 'Différentiel 30mA', quantity: 4, minQuantity: 2, unit: 'pce' },
      { productId: 10, productName: 'Spot LED encastrable', quantity: 25, minQuantity: 10, unit: 'pce' },
    ];
    
    const tx = database.transaction('vehicleStock', 'readwrite');
    for (const item of defaultStock) {
      await tx.store.put(item);
    }
    await tx.done;
  }
}

export async function getVehicleStock(): Promise<MV3DB['vehicleStock']['value'][]> {
  const database = await initDB();
  return database.getAll('vehicleStock');
}

export async function updateVehicleStock(productId: number, quantityUsed: number): Promise<void> {
  const database = await initDB();
  const item = await database.get('vehicleStock', productId);
  
  if (item) {
    item.quantity = Math.max(0, item.quantity - quantityUsed);
    await database.put('vehicleStock', item);
  }
}

// Check online status
export function isOnline(): boolean {
  return navigator.onLine;
}

// Sync pending changes
export async function syncPendingChanges(): Promise<boolean> {
  if (!isOnline()) return false;
  
  const pending = await getPendingSync();
  if (pending.length === 0) return true;
  
  // In a real app, this would send data to the server
  console.log('Syncing pending changes:', pending);
  
  // Clear pending after successful sync
  await clearPendingSync();
  return true;
}
