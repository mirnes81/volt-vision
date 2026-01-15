/**
 * Sync Service - Handles synchronization of pending offline actions
 */

import { PendingSyncItem } from '@/lib/offlineStorage';

// Import the edge function caller
async function callDolibarrApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/dolibarr-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error || 'Erreur API');
  }

  return response.json();
}

interface HourSyncData {
  workType: string;
  dateStart: string;
  dateEnd?: string;
  durationHours?: number;
  comment?: string;
  isManual?: boolean;
}

interface MaterialSyncData {
  productId: number;
  qtyUsed: number;
  comment?: string;
}

interface TaskSyncData {
  taskId: number;
  status: 'a_faire' | 'fait';
}

interface PhotoSyncData {
  base64: string;
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut';
  filename: string;
}

interface SignatureSyncData {
  signatureBase64: string;
  signerName: string;
}

interface NoteSyncData {
  note_private: string;
}

/**
 * Sync a single pending item to the server
 */
export async function syncPendingItem(item: PendingSyncItem): Promise<void> {
  switch (item.type) {
    case 'hour':
      await syncHour(item.interventionId, item.data as HourSyncData);
      break;
    case 'material':
      await syncMaterial(item.interventionId, item.data as MaterialSyncData);
      break;
    case 'task':
      await syncTask(item.interventionId, item.data as TaskSyncData);
      break;
    case 'photo':
      await syncPhoto(item.interventionId, item.data as PhotoSyncData);
      break;
    case 'signature':
      await syncSignature(item.interventionId, item.data as SignatureSyncData);
      break;
    case 'note':
      await syncNote(item.interventionId, item.data as NoteSyncData);
      break;
    default:
      console.warn(`[Sync] Unknown sync type: ${item.type}`);
  }
}

async function syncHour(interventionId: number, data: HourSyncData): Promise<void> {
  // For manual hours with start and end, create a time tracking entry
  if (data.isManual && data.dateStart && data.dateEnd) {
    await callDolibarrApi('add-timespent', {
      interventionId,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      duration: data.durationHours ? data.durationHours * 3600 : 0, // Convert to seconds
      workType: data.workType,
      comment: data.comment || '',
    });
  } else {
    // For timer-based entries
    await callDolibarrApi('add-timespent', {
      interventionId,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd || new Date().toISOString(),
      duration: data.durationHours ? data.durationHours * 3600 : 0,
      workType: data.workType,
      comment: data.comment || '',
    });
  }
}

async function syncMaterial(interventionId: number, data: MaterialSyncData): Promise<void> {
  await callDolibarrApi('add-intervention-line', {
    interventionId,
    productId: data.productId,
    qty: data.qtyUsed,
    description: data.comment || '',
  });
}

async function syncTask(interventionId: number, data: TaskSyncData): Promise<void> {
  await callDolibarrApi('update-task', {
    interventionId,
    taskId: data.taskId,
    status: data.status,
  });
}

async function syncPhoto(interventionId: number, data: PhotoSyncData): Promise<void> {
  await callDolibarrApi('upload-photo', {
    interventionId,
    base64: data.base64,
    type: data.type,
    filename: data.filename,
  });
}

async function syncSignature(interventionId: number, data: SignatureSyncData): Promise<void> {
  await callDolibarrApi('save-signature', {
    interventionId,
    signatureBase64: data.signatureBase64,
    signerName: data.signerName,
  });
}

async function syncNote(interventionId: number, data: NoteSyncData): Promise<void> {
  await callDolibarrApi('update-intervention', {
    id: interventionId,
    data: {
      note_private: data.note_private,
    },
  });
}
