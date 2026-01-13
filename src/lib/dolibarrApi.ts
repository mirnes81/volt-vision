// Dolibarr API Client via Edge Function Proxy
import { Intervention, Material, Task, Worker, WorkerHour, Product } from '@/types/intervention';
import { supabase } from '@/integrations/supabase/client';

// Helper to call the Dolibarr proxy
async function callDolibarrApi<T>(action: string, params: Record<string, any> = {}): Promise<T> {
  console.log('Calling dolibarr-api:', action, params);
  
  const { data, error } = await supabase.functions.invoke('dolibarr-api', {
    body: { action, params },
  });
  
  if (error) {
    console.error('Dolibarr API error:', error);
    throw new Error(error.message || 'Erreur de communication avec Dolibarr');
  }
  
  if (data?.error) {
    throw new Error(data.error);
  }
  
  return data as T;
}

// Test connection
export async function testDolibarrConnection(): Promise<{ success: boolean; version?: string }> {
  try {
    const data = await callDolibarrApi<any>('status');
    return { 
      success: true, 
      version: data?.success?.dolibarr_version || 'Version inconnue' 
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    return { success: false };
  }
}

// Clients
export async function fetchClients(search?: string): Promise<Array<{ id: number; name: string; address?: string; zip?: string; town?: string; email?: string }>> {
  const data = await callDolibarrApi<any[]>('get-thirdparties', { search });
  
  return data.map(client => ({
    id: parseInt(client.id),
    name: client.name || client.nom,
    address: client.address,
    zip: client.zip,
    town: client.town,
    email: client.email,
  }));
}

// Interventions
export async function fetchInterventions(): Promise<Intervention[]> {
  const data = await callDolibarrApi<any[]>('get-interventions');
  return data.map(mapDolibarrIntervention);
}

export async function fetchIntervention(id: number): Promise<Intervention> {
  const data = await callDolibarrApi<any>('get-intervention', { id });
  return mapDolibarrIntervention(data);
}

function mapDolibarrIntervention(data: any): Intervention {
  const lines = data.lines || [];
  
  return {
    id: parseInt(data.id),
    ref: data.ref || `INT-${data.id}`,
    label: data.description || data.label || 'Intervention',
    clientId: parseInt(data.socid) || 0,
    clientName: data.thirdparty_name || data.client?.name || 'Client',
    location: data.address || '',
    type: 'depannage',
    priority: 'normal',
    status: mapDolibarrStatus(parseInt(data.fk_statut || data.status || 0)),
    description: data.note_public || data.description || '',
    dateCreation: data.datec || new Date().toISOString(),
    dateStart: data.datei,
    tasks: lines.map((line: any, index: number) => ({
      id: parseInt(line.id) || index,
      label: line.desc || line.description || `Tâche ${index + 1}`,
      order: index,
      status: line.rang > 0 ? 'fait' as const : 'a_faire' as const,
      dateDone: line.rang > 0 ? new Date().toISOString() : undefined,
    })),
    materials: [],
    hours: getLocalHours(parseInt(data.id)),
    photos: [],
  };
}

function mapDolibarrStatus(status: number): Intervention['status'] {
  switch (status) {
    case 0: return 'a_planifier';
    case 1: return 'en_cours';
    case 2: return 'termine';
    case 3: return 'facture';
    default: return 'a_planifier';
  }
}

export async function createIntervention(data: {
  clientId: number;
  label: string;
  location?: string;
  type?: string;
  priority?: number;
  description?: string;
}): Promise<{ id: number; ref: string }> {
  const result = await callDolibarrApi<any>('create-intervention', data);
  return { 
    id: parseInt(result) || parseInt(result.id), 
    ref: result.ref || `INT-${result}` 
  };
}

// Products
export async function fetchProducts(search?: string): Promise<Product[]> {
  const data = await callDolibarrApi<any[]>('get-products', { search });
  
  return data.map(product => ({
    id: parseInt(product.id),
    ref: product.ref,
    label: product.label,
    price: parseFloat(product.price) || 0,
    unit: product.unit || 'pce',
  }));
}

// Hours - Store locally
export async function dolibarrStartHours(interventionId: number, workType: string): Promise<WorkerHour> {
  const worker = JSON.parse(localStorage.getItem('mv3_worker') || '{}');
  
  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id || 1,
    userName: `${worker.firstName || ''} ${worker.name || ''}`.trim() || 'Technicien',
    dateStart: new Date().toISOString(),
    workType,
  };
  
  const hoursKey = `intervention_hours_${interventionId}`;
  const existingHours = JSON.parse(localStorage.getItem(hoursKey) || '[]');
  existingHours.push(newHour);
  localStorage.setItem(hoursKey, JSON.stringify(existingHours));
  
  return newHour;
}

export async function dolibarrStopHours(interventionId: number, hourId: number, comment?: string): Promise<WorkerHour> {
  const hoursKey = `intervention_hours_${interventionId}`;
  const hours: WorkerHour[] = JSON.parse(localStorage.getItem(hoursKey) || '[]');
  
  const hour = hours.find(h => h.id === hourId);
  if (!hour) throw new Error('Entrée horaire non trouvée');
  
  hour.dateEnd = new Date().toISOString();
  const start = new Date(hour.dateStart);
  const end = new Date(hour.dateEnd);
  hour.durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
  hour.comment = comment;
  
  localStorage.setItem(hoursKey, JSON.stringify(hours));
  
  return hour;
}

export async function dolibarrAddManualHours(
  interventionId: number,
  data: { dateStart: string; dateEnd: string; workType: string; comment?: string }
): Promise<WorkerHour> {
  const worker = JSON.parse(localStorage.getItem('mv3_worker') || '{}');
  const start = new Date(data.dateStart);
  const end = new Date(data.dateEnd);
  
  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id || 1,
    userName: `${worker.firstName || ''} ${worker.name || ''}`.trim() || 'Technicien',
    dateStart: data.dateStart,
    dateEnd: data.dateEnd,
    durationHours: Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100,
    workType: data.workType,
    comment: data.comment,
  };
  
  const hoursKey = `intervention_hours_${interventionId}`;
  const existingHours = JSON.parse(localStorage.getItem(hoursKey) || '[]');
  existingHours.push(newHour);
  localStorage.setItem(hoursKey, JSON.stringify(existingHours));
  
  return newHour;
}

// Materials
export async function dolibarrAddMaterial(
  interventionId: number,
  data: { productId: number; qtyUsed: number; comment?: string }
): Promise<Material> {
  const product = await callDolibarrApi<any>('get-product', { id: data.productId });
  
  await callDolibarrApi('add-intervention-line', {
    interventionId,
    productId: data.productId,
    qty: data.qtyUsed,
    description: data.comment || product.label,
  });
  
  return {
    id: Date.now(),
    productId: data.productId,
    productName: product.label,
    qtyUsed: data.qtyUsed,
    unit: product.unit || 'pce',
    comment: data.comment,
  };
}

// Tasks
export async function dolibarrUpdateTask(
  interventionId: number,
  taskId: number,
  status: 'a_faire' | 'fait',
  comment?: string
): Promise<Task> {
  await callDolibarrApi('update-intervention-line', {
    interventionId,
    lineId: taskId,
    data: { rang: status === 'fait' ? 1 : 0 },
  });
  
  return {
    id: taskId,
    label: comment || 'Tâche',
    order: 0,
    status,
    dateDone: status === 'fait' ? new Date().toISOString() : undefined,
  };
}

// Photos
export async function dolibarrUploadPhoto(
  interventionId: number,
  file: File,
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut'
): Promise<{ id: number; filePath: string }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
  const filename = `${type}_${Date.now()}_${file.name}`;
  
  try {
    await callDolibarrApi('upload-document', {
      filename,
      modulepart: 'ficheinter',
      ref: interventionId.toString(),
      filecontent: base64,
    });
    
    return { id: Date.now(), filePath: filename };
  } catch (error) {
    console.log('Upload to Dolibarr failed, storing locally');
    const filePath = URL.createObjectURL(file);
    return { id: Date.now(), filePath };
  }
}

// Signature
export async function dolibarrSaveSignature(
  interventionId: number,
  signatureData: string,
  signerName: string
): Promise<void> {
  localStorage.setItem(`signature_${interventionId}`, JSON.stringify({
    data: signatureData,
    signer: signerName,
    date: new Date().toISOString(),
  }));
  
  try {
    await callDolibarrApi('update-intervention', {
      id: interventionId,
      data: { fk_statut: 2 },
    });
  } catch (error) {
    console.log('Could not update intervention status:', error);
  }
}

// PDF
export async function generatePdf(interventionId: number): Promise<{ filePath: string; fileName: string; downloadUrl?: string }> {
  try {
    const data = await callDolibarrApi<any>('build-document', {
      ref: interventionId.toString(),
      modulepart: 'ficheinter',
    });
    
    return {
      filePath: data.filename || `intervention_${interventionId}.pdf`,
      fileName: `intervention_${interventionId}.pdf`,
      downloadUrl: data.fullname,
    };
  } catch (error) {
    console.log('PDF generation via Dolibarr failed');
  }
  
  return { 
    filePath: `/documents/intervention_${interventionId}.pdf`, 
    fileName: `intervention_${interventionId}.pdf` 
  };
}

// Email
export async function sendInterventionEmail(interventionId: number, recipientEmail?: string): Promise<void> {
  console.log('Email request for intervention:', interventionId, 'to:', recipientEmail);
  
  const emailRequests = JSON.parse(localStorage.getItem('pending_emails') || '[]');
  emailRequests.push({
    interventionId,
    recipientEmail,
    requestedAt: new Date().toISOString(),
  });
  localStorage.setItem('pending_emails', JSON.stringify(emailRequests));
}

// AI - Placeholder
export async function dolibarrGenerateAiSummary(interventionId: number): Promise<{ summary: string; clientText: string }> {
  const intervention = await fetchIntervention(interventionId);
  
  const summary = `Intervention ${intervention.ref}
Client: ${intervention.clientName}
Description: ${intervention.description || intervention.label}

Résumé généré automatiquement.`;

  return { summary, clientText: summary };
}

export async function dolibarrGenerateAiDiagnostic(interventionId: number, symptoms?: string): Promise<string> {
  return `Diagnostic automatique
Symptômes: ${symptoms || 'Non spécifiés'}

Veuillez effectuer un diagnostic manuel.`;
}

// Vehicle Stock
export async function fetchVehicleStock(): Promise<Array<{
  productId: number;
  productRef: string;
  productLabel: string;
  qtyAvailable: number;
  qtyMin: number;
  isLowStock: boolean;
}>> {
  try {
    const data = await callDolibarrApi<any[]>('get-products');
    
    return data.map(product => ({
      productId: parseInt(product.id),
      productRef: product.ref,
      productLabel: product.label,
      qtyAvailable: parseInt(product.stock_reel) || 0,
      qtyMin: parseInt(product.seuil_stock_alerte) || 5,
      isLowStock: (parseInt(product.stock_reel) || 0) <= (parseInt(product.seuil_stock_alerte) || 5),
    }));
  } catch {
    return [];
  }
}

// Helper
export function getLocalHours(interventionId: number): WorkerHour[] {
  const hoursKey = `intervention_hours_${interventionId}`;
  return JSON.parse(localStorage.getItem(hoursKey) || '[]');
}

// Legacy login function - now just stores the user info
export async function dolibarrLogin(apiKey: string, username?: string): Promise<{ token: string; worker: Worker }> {
  // With Edge Function, we don't need the API key client-side
  // Just create a default worker
  const worker: Worker = {
    id: 1,
    login: username || 'user',
    name: 'Utilisateur',
    firstName: '',
    email: '',
    phone: '',
  };
  
  localStorage.setItem('mv3_token', 'authenticated');
  localStorage.setItem('mv3_worker', JSON.stringify(worker));
  
  return { token: 'authenticated', worker };
}
