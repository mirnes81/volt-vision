import { Intervention, Material, Task, Worker, WorkerHour, Product } from '@/types/intervention';
import * as dolibarrApi from './dolibarrApi';
import { addPendingSync } from './offlineStorage';

// Check if we should queue for offline sync
function shouldQueueOffline(): boolean {
  return !navigator.onLine && isAuthenticated();
}

export function logout(): void {
  localStorage.removeItem('mv3_token');
  localStorage.removeItem('mv3_worker');
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('mv3_token');
}

export function getCurrentWorker(): Worker | null {
  const data = localStorage.getItem('mv3_worker');
  return data ? JSON.parse(data) : null;
}

// Clients
export async function getClients(search?: string): Promise<Array<{ id: number; name: string; address?: string; zip?: string; town?: string; email?: string }>> {
  return dolibarrApi.fetchClients(search);
}

// Interventions
// Get recent interventions (for dashboard - limit 10)
export async function getRecentInterventions(limit: number = 10): Promise<Intervention[]> {
  const all = await dolibarrApi.fetchInterventions();
  // Sort by creation date descending and take first 'limit'
  return all
    .sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime())
    .slice(0, limit);
}

export async function getTodayInterventions(): Promise<Intervention[]> {
  return dolibarrApi.fetchInterventions();
}

// Get interventions assigned to current user
export async function getMyInterventions(): Promise<Intervention[]> {
  return dolibarrApi.fetchMyInterventions();
}

// Get all interventions (no filter)
export async function getAllInterventions(): Promise<Intervention[]> {
  return dolibarrApi.fetchInterventions();
}

export async function getIntervention(id: number): Promise<Intervention> {
  return dolibarrApi.fetchIntervention(id);
}

export async function createIntervention(data: {
  clientId: number;
  label: string;
  location?: string;
  type?: string;
  priority?: number;
  description?: string;
}): Promise<{ id: number; ref: string }> {
  return dolibarrApi.createIntervention(data);
}

// Hours
export async function startHours(interventionId: number, workType: string): Promise<WorkerHour> {
  const worker = getCurrentWorker();
  if (!worker) throw new Error('Non authentifié');

  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id,
    userName: `${worker.firstName} ${worker.name}`,
    dateStart: new Date().toISOString(),
    workType,
  };

  // Queue for offline sync if no connection
  if (shouldQueueOffline()) {
    await addPendingSync('hour', interventionId, {
      workType,
      dateStart: newHour.dateStart,
      isManual: false,
    });
    console.log('[Offline] Hour start queued for sync');
    return newHour;
  }
  
  return dolibarrApi.dolibarrStartHours(interventionId, workType);
}

export async function stopHours(interventionId: number, hourId: number, comment?: string): Promise<WorkerHour> {
  const hoursKey = `intervention_hours_${interventionId}`;
  const hours: WorkerHour[] = JSON.parse(localStorage.getItem(hoursKey) || '[]');
  const hour = hours.find(h => h.id === hourId);
  
  if (hour) {
    hour.dateEnd = new Date().toISOString();
    const start = new Date(hour.dateStart);
    const end = new Date(hour.dateEnd);
    hour.durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
    hour.comment = comment;
    localStorage.setItem(hoursKey, JSON.stringify(hours));
  }

  // Queue for offline sync if no connection
  if (shouldQueueOffline() && hour) {
    await addPendingSync('hour', interventionId, {
      workType: hour.workType,
      dateStart: hour.dateStart,
      dateEnd: hour.dateEnd,
      durationHours: hour.durationHours,
      comment: hour.comment,
      isManual: false,
    });
    console.log('[Offline] Hour stop queued for sync');
    return hour;
  }
  
  return dolibarrApi.dolibarrStopHours(interventionId, hourId, comment);
}

export async function addManualHours(
  interventionId: number, 
  data: { dateStart: string; dateEnd: string; workType: string; comment?: string }
): Promise<WorkerHour> {
  const worker = getCurrentWorker();
  if (!worker) throw new Error('Non authentifié');

  const start = new Date(data.dateStart);
  const end = new Date(data.dateEnd);
  const durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
  const durationMinutes = Math.round(durationHours * 60);
  
  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id,
    userName: `${worker.firstName} ${worker.name}`,
    dateStart: data.dateStart,
    dateEnd: data.dateEnd,
    durationHours,
    workType: data.workType,
    comment: data.comment,
  };

  // Queue for offline sync if no connection
  if (shouldQueueOffline()) {
    await addPendingSync('hour', interventionId, {
      workType: data.workType,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      durationHours,
      comment: data.comment,
      isManual: true,
    });
    console.log('[Offline] Manual hours queued for sync');
    
    // Save locally too
    const hoursKey = `intervention_hours_${interventionId}`;
    const existingHours = JSON.parse(localStorage.getItem(hoursKey) || '[]');
    existingHours.push(newHour);
    localStorage.setItem(hoursKey, JSON.stringify(existingHours));
    
    return newHour;
  }
  
  // Also insert into Supabase work_time_entries for time tracking page
  // Note: duration_minutes is a generated column, we only set clock_in/clock_out
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
    
    const { error } = await supabase
      .from('work_time_entries')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        user_id: String(worker.id),
        clock_in: data.dateStart,
        clock_out: data.dateEnd,
        work_type: data.workType,
        intervention_id: interventionId,
        intervention_ref: `INT-${interventionId}`,
        comment: data.comment,
        status: 'pending',
      });
    
    if (error) {
      console.error('[API] Supabase insert error:', error);
    } else {
      console.log('[API] Hours synced to Supabase work_time_entries');
    }
  } catch (error) {
    console.error('[API] Failed to sync hours to Supabase:', error);
    // Continue anyway - local storage is primary
  }
  
  return dolibarrApi.dolibarrAddManualHours(interventionId, data);
}

// Materials
export async function getProducts(): Promise<Product[]> {
  return dolibarrApi.fetchProducts();
}

export async function addMaterial(
  interventionId: number, 
  data: { productId: number; qty: number; comment?: string }
): Promise<Material> {
  // Create local material object for immediate UI feedback
  const productName = await getProductName(data.productId);
  const newMaterial: Material = {
    id: Date.now(),
    productId: data.productId,
    productName,
    qtyUsed: data.qty,
    unit: 'pce',
    comment: data.comment,
  };

  // Queue for offline sync if no connection
  if (shouldQueueOffline()) {
    await addPendingSync('material', interventionId, {
      productId: data.productId,
      qtyUsed: data.qty,
      comment: data.comment,
    });
    console.log('[Offline] Material queued for sync');
    
    // Save locally for immediate display
    const materialsKey = `intervention_materials_${interventionId}`;
    const existingMaterials = JSON.parse(localStorage.getItem(materialsKey) || '[]');
    existingMaterials.push(newMaterial);
    localStorage.setItem(materialsKey, JSON.stringify(existingMaterials));
    
    return newMaterial;
  }
  
  return dolibarrApi.dolibarrAddMaterial(interventionId, { 
    productId: data.productId, 
    qtyUsed: data.qty, 
    comment: data.comment 
  });
}

// Helper to get product name (from cache or API)
async function getProductName(productId: number): Promise<string> {
  try {
    const products = await getProducts();
    const product = products.find(p => p.id === productId);
    return product?.label || `Produit #${productId}`;
  } catch {
    return `Produit #${productId}`;
  }
}

// Tasks
export async function updateTaskStatus(
  interventionId: number, 
  taskId: number, 
  status: 'a_faire' | 'fait'
): Promise<Task> {
  return dolibarrApi.dolibarrUpdateTask(interventionId, taskId, status);
}

// Photos
export async function uploadPhoto(
  interventionId: number, 
  file: File, 
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut'
): Promise<{ id: number; filePath: string; offline?: boolean }> {
  const worker = getCurrentWorker();
  const filename = `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const storagePath = `${interventionId}/${filename}`;

  // Check if we should queue offline
  if (shouldQueueOffline()) {
    const localFilePath = URL.createObjectURL(file);
    console.log('[API] Photo queued for offline display (no connection):', filename);
    return { id: Date.now(), filePath: localFilePath, offline: true };
  }
  
  try {
    // Upload to Supabase Storage (bypasses Dolibarr WAF issues)
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('intervention-photos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('[API] Storage upload error:', uploadError);
      throw new Error(uploadError.message);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('intervention-photos')
      .getPublicUrl(storagePath);
    
    const publicUrl = urlData.publicUrl;
    
    // Save photo record to database
    const tenantId = localStorage.getItem('mv3_tenant_id') || 'default';
    const { error: dbError } = await supabase
      .from('intervention_photos' as any)
      .insert({
        intervention_id: interventionId,
        tenant_id: tenantId,
        uploaded_by: worker ? String(worker.id) : 'unknown',
        photo_type: type,
        storage_path: storagePath,
        public_url: publicUrl,
        original_filename: file.name,
      });
    
    if (dbError) {
      console.warn('[API] DB photo record error (non-critical):', dbError);
    }
    
    console.log('[API] Photo uploaded to storage:', publicUrl);
    return { id: Date.now(), filePath: publicUrl };
    
  } catch (error) {
    console.error('[API] Upload failed, using local blob URL:', error);
    // Fallback: local blob URL for current session display
    const localFilePath = URL.createObjectURL(file);
    return { id: Date.now(), filePath: localFilePath, offline: true };
  }
}

// Signature
export async function saveSignature(interventionId: number, signatureDataUrl: string, signerName?: string): Promise<{ offline?: boolean }> {
  // Check if we should queue offline
  if (shouldQueueOffline()) {
    // Extract base64 from data URL
    const base64 = signatureDataUrl.split(',')[1];
    
    await addPendingSync('signature', interventionId, {
      signatureBase64: base64,
      signerName: signerName || 'Client',
      dataUrl: signatureDataUrl, // Keep original for local display
    });
    
    console.log('[API] Signature queued for offline sync');
    return { offline: true };
  }
  
  await dolibarrApi.dolibarrSaveSignature(interventionId, signatureDataUrl, signerName || 'Client');
  return {};
}

// PDF
export async function generatePdf(interventionId: number): Promise<{ filePath: string; fileName: string }> {
  return dolibarrApi.generatePdf(interventionId);
}

// Email
export async function sendInterventionEmail(interventionId: number, recipientEmail?: string): Promise<void> {
  return dolibarrApi.sendInterventionEmail(interventionId, recipientEmail);
}

// AI
export async function generateAiSummary(interventionId: number): Promise<string> {
  const result = await dolibarrApi.dolibarrGenerateAiSummary(interventionId);
  return result.summary;
}

export async function generateAiDiagnostic(interventionId: number): Promise<string> {
  return dolibarrApi.dolibarrGenerateAiDiagnostic(interventionId);
}

// Workers
export async function fetchAllWorkers(): Promise<Worker[]> {
  return dolibarrApi.fetchAllDolibarrUsers();
}
