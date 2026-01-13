// Dolibarr Native API Client - Direct API Key Authentication
import { Intervention, Material, Task, Worker, WorkerHour, Product, Photo } from '@/types/intervention';
import { getDolibarrConfig } from './dolibarrConfig';

function getApiUrl(): string {
  const config = getDolibarrConfig();
  if (!config.isConfigured || !config.baseUrl) {
    throw new Error('Dolibarr non configuré');
  }
  return `${config.baseUrl.replace(/\/+$/, '')}/api/index.php`;
}

function getToken(): string {
  const token = localStorage.getItem('mv3_token');
  if (!token) {
    throw new Error('Non authentifié');
  }
  return token;
}

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiUrl();
  const token = getToken();
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'DOLAPIKEY': token,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('mv3_token');
      localStorage.removeItem('mv3_worker');
      throw new Error('Session expirée - veuillez vous reconnecter');
    }
    
    const errorText = await response.text();
    throw new Error(errorText || `Erreur HTTP ${response.status}`);
  }
  
  return response.json();
}

// Auth - Validate API key by fetching user info
export async function dolibarrLogin(apiKey: string, username?: string): Promise<{ token: string; worker: Worker }> {
  const config = getDolibarrConfig();
  if (!config.isConfigured || !config.baseUrl) {
    throw new Error('Dolibarr non configuré - veuillez configurer l\'URL dans les paramètres');
  }
  
  const baseUrl = `${config.baseUrl.replace(/\/+$/, '')}/api/index.php`;
  
  try {
    // Test the API key by fetching user info
    const response = await fetch(`${baseUrl}/users/info`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'DOLAPIKEY': apiKey,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Clé API invalide');
      }
      if (response.status === 404) {
        throw new Error('API Dolibarr non accessible - vérifiez que le module API REST est activé');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(`Erreur serveur ${response.status}: ${errorText || response.statusText}`);
    }
    
    const userData = await response.json();
    
    const workerData: Worker = {
      id: parseInt(userData.id) || 1,
      login: userData.login || username || 'user',
      name: userData.lastname || userData.login || 'Utilisateur',
      firstName: userData.firstname || '',
      email: userData.email || '',
      phone: userData.user_mobile || userData.office_phone || '',
    };
    
    // Store credentials
    localStorage.setItem('mv3_token', apiKey);
    localStorage.setItem('mv3_worker', JSON.stringify(workerData));
    
    return { token: apiKey, worker: workerData };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Impossible de contacter le serveur - vérifiez l\'URL et les headers CORS');
    }
    throw error;
  }
}

// Clients - Use Dolibarr thirdparties endpoint
export async function fetchClients(search?: string): Promise<Array<{ id: number; name: string; address?: string; zip?: string; town?: string; email?: string }>> {
  const query = search ? `?sqlfilters=(t.nom:like:'%${search}%')&limit=50` : '?limit=100';
  const data = await apiRequest<any[]>(`/thirdparties${query}`);
  
  return data.map(client => ({
    id: parseInt(client.id),
    name: client.name || client.nom,
    address: client.address,
    zip: client.zip,
    town: client.town,
    email: client.email,
  }));
}

// Interventions - Use Dolibarr interventions (ficheinter) endpoint
export async function fetchInterventions(): Promise<Intervention[]> {
  const data = await apiRequest<any[]>('/interventions?sortfield=t.datec&sortorder=DESC&limit=50');
  
  return data.map(mapDolibarrIntervention);
}

export async function fetchIntervention(id: number): Promise<Intervention> {
  const data = await apiRequest<any>(`/interventions/${id}`);
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
  const payload = {
    socid: data.clientId,
    description: data.label,
    note_public: data.description || '',
    fk_statut: 0,
  };
  
  const result = await apiRequest<any>('/interventions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  return { 
    id: parseInt(result) || parseInt(result.id), 
    ref: result.ref || `INT-${result}` 
  };
}

// Products - Use Dolibarr products endpoint
export async function fetchProducts(search?: string): Promise<Product[]> {
  const query = search ? `?sqlfilters=(t.label:like:'%${search}%')&limit=50` : '?limit=100';
  const data = await apiRequest<any[]>(`/products${query}`);
  
  return data.map(product => ({
    id: parseInt(product.id),
    ref: product.ref,
    label: product.label,
    price: parseFloat(product.price) || 0,
    unit: product.unit || 'pce',
  }));
}

// Hours - Store locally (Dolibarr interventions don't have native time tracking)
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

// Materials - Add line to intervention
export async function dolibarrAddMaterial(
  interventionId: number,
  data: { productId: number; qtyUsed: number; comment?: string }
): Promise<Material> {
  const product = await apiRequest<any>(`/products/${data.productId}`);
  
  await apiRequest(`/interventions/${interventionId}/lines`, {
    method: 'POST',
    body: JSON.stringify({
      fk_product: data.productId,
      qty: data.qtyUsed,
      desc: data.comment || product.label,
    }),
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

// Tasks - Update intervention line
export async function dolibarrUpdateTask(
  interventionId: number,
  taskId: number,
  status: 'a_faire' | 'fait',
  comment?: string
): Promise<Task> {
  await apiRequest(`/interventions/${interventionId}/lines/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      rang: status === 'fait' ? 1 : 0,
    }),
  });
  
  return {
    id: taskId,
    label: comment || 'Tâche',
    order: 0,
    status,
    dateDone: status === 'fait' ? new Date().toISOString() : undefined,
  };
}

// Photos - Use Dolibarr documents endpoint
export async function dolibarrUploadPhoto(
  interventionId: number,
  file: File,
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut'
): Promise<{ id: number; filePath: string }> {
  const token = getToken();
  const baseUrl = getApiUrl();
  
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
    const response = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DOLAPIKEY': token,
      },
      body: JSON.stringify({
        filename: filename,
        modulepart: 'ficheinter',
        ref: interventionId.toString(),
        subdir: '',
        filecontent: base64,
        fileencoding: 'base64',
        overwriteifexists: 0,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { id: Date.now(), filePath: data.fullname || filename };
    }
  } catch (error) {
    console.log('Upload to Dolibarr failed, storing locally');
  }
  
  // Fallback to local storage
  const filePath = URL.createObjectURL(file);
  return { id: Date.now(), filePath };
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
  
  // Update intervention status
  try {
    await apiRequest(`/interventions/${interventionId}`, {
      method: 'PUT',
      body: JSON.stringify({ fk_statut: 2 }),
    });
  } catch (error) {
    console.log('Could not update intervention status:', error);
  }
}

// PDF
export async function generatePdf(interventionId: number): Promise<{ filePath: string; fileName: string; downloadUrl?: string }> {
  const token = getToken();
  const baseUrl = getApiUrl();
  
  try {
    const response = await fetch(`${baseUrl}/documents/builddoc`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'DOLAPIKEY': token,
      },
      body: JSON.stringify({
        modulepart: 'ficheinter',
        original_file: interventionId.toString(),
        doctemplate: 'soleil',
        langcode: 'fr_FR',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        filePath: data.filename || `intervention_${interventionId}.pdf`,
        fileName: `intervention_${interventionId}.pdf`,
        downloadUrl: data.fullname,
      };
    }
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
    const data = await apiRequest<any[]>('/products?mode=1&limit=50');
    
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

// Helper to get locally stored hours
export function getLocalHours(interventionId: number): WorkerHour[] {
  const hoursKey = `intervention_hours_${interventionId}`;
  return JSON.parse(localStorage.getItem(hoursKey) || '[]');
}
