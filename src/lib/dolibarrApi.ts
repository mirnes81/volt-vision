// SmartElectric API Client - MV-3 PRO
import { Intervention, Material, Task, Worker, WorkerHour, Product, Photo } from '@/types/intervention';
import { getDolibarrConfig } from './dolibarrConfig';

function getApiUrl(): string {
  const config = getDolibarrConfig();
  if (!config.isConfigured || !config.baseUrl) {
    throw new Error('SmartElectric non configuré');
  }
  return `${config.baseUrl.replace(/\/+$/, '')}/api/index.php/electricien`;
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

// Auth
export async function dolibarrLogin(username: string, password: string): Promise<{ token: string; worker: Worker }> {
  const config = getDolibarrConfig();
  if (!config.isConfigured || !config.baseUrl) {
    throw new Error('SmartElectric non configuré - veuillez configurer l\'URL Dolibarr dans les paramètres');
  }
  
  const baseUrl = `${config.baseUrl.replace(/\/+$/, '')}/api/index.php/electricien`;
  
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ login: username, password }),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Identifiants invalides');
      }
      if (response.status === 404) {
        throw new Error('Module Électricien non trouvé sur Dolibarr - vérifiez qu\'il est activé');
      }
      if (response.status === 0) {
        throw new Error('Erreur CORS - configurez les headers dans Dolibarr');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(`Erreur serveur ${response.status}: ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Store credentials
    localStorage.setItem('mv3_token', data.token);
    localStorage.setItem('mv3_worker', JSON.stringify(data.worker));
    
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Impossible de contacter le serveur - vérifiez l\'URL et les headers CORS');
    }
    throw error;
  }
}

// Clients
export async function fetchClients(search?: string): Promise<Array<{ id: number; name: string; address?: string; zip?: string; town?: string; email?: string }>> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(`/clients${query}`);
}

// Interventions
export async function fetchInterventions(): Promise<Intervention[]> {
  return apiRequest<Intervention[]>('/worker/interventions');
}

export async function fetchIntervention(id: number): Promise<Intervention> {
  return apiRequest<Intervention>(`/interventions/${id}`);
}

export async function createIntervention(data: {
  clientId: number;
  label: string;
  location?: string;
  type?: string;
  priority?: number;
  description?: string;
}): Promise<{ id: number; ref: string }> {
  return apiRequest<{ id: number; ref: string }>('/interventions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Hours
export async function dolibarrStartHours(interventionId: number, workType: string): Promise<WorkerHour> {
  return apiRequest<WorkerHour>(`/interventions/${interventionId}/hours`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'start',
      data: { workType },
    }),
  });
}

export async function dolibarrStopHours(interventionId: number, hourId: number, comment?: string): Promise<WorkerHour> {
  return apiRequest<WorkerHour>(`/interventions/${interventionId}/hours`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'stop',
      data: { hourId, comment },
    }),
  });
}

export async function dolibarrAddManualHours(
  interventionId: number,
  data: { dateStart: string; dateEnd: string; workType: string; comment?: string }
): Promise<WorkerHour> {
  return apiRequest<WorkerHour>(`/interventions/${interventionId}/hours`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'manual',
      data,
    }),
  });
}

// Materials
export async function fetchProducts(search?: string): Promise<Product[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<Product[]>(`/products${query}`);
}

export async function dolibarrAddMaterial(
  interventionId: number,
  data: { productId: number; qtyUsed: number; comment?: string }
): Promise<Material> {
  return apiRequest<Material>(`/interventions/${interventionId}/materials`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Tasks
export async function dolibarrUpdateTask(
  interventionId: number,
  taskId: number,
  status: 'a_faire' | 'fait',
  comment?: string
): Promise<Task> {
  return apiRequest<Task>(`/interventions/${interventionId}/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ status, comment }),
  });
}

// Photos
export async function dolibarrUploadPhoto(
  interventionId: number,
  file: File,
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut'
): Promise<{ id: number; filePath: string }> {
  const token = getToken();
  const baseUrl = getApiUrl();
  
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('type', type);
  
  const response = await fetch(`${baseUrl}/interventions/${interventionId}/photos`, {
    method: 'POST',
    headers: {
      'DOLAPIKEY': token,
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Erreur lors de l\'upload de la photo');
  }
  
  return response.json();
}

// Signature
export async function dolibarrSaveSignature(
  interventionId: number,
  signatureData: string,
  signerName: string
): Promise<void> {
  await apiRequest(`/interventions/${interventionId}/signature`, {
    method: 'POST',
    body: JSON.stringify({ signatureData, signerName }),
  });
}

// PDF
export async function generatePdf(interventionId: number): Promise<{ filePath: string; fileName: string; downloadUrl?: string }> {
  return apiRequest<{ filePath: string; fileName: string; downloadUrl?: string }>(`/interventions/${interventionId}/pdf`, {
    method: 'POST',
  });
}

// Email
export async function sendInterventionEmail(interventionId: number, recipientEmail?: string): Promise<void> {
  await apiRequest(`/interventions/${interventionId}/send-email`, {
    method: 'POST',
    body: JSON.stringify({ recipientEmail }),
  });
}

// AI
export async function dolibarrGenerateAiSummary(interventionId: number): Promise<{ summary: string; clientText: string }> {
  return apiRequest<{ summary: string; clientText: string }>(`/interventions/${interventionId}/ai-summary`, {
    method: 'POST',
  });
}

export async function dolibarrGenerateAiDiagnostic(interventionId: number, symptoms?: string): Promise<string> {
  const result = await apiRequest<{ diagnostic: string }>(`/interventions/${interventionId}/ai-diagnostic`, {
    method: 'POST',
    body: JSON.stringify({ symptoms }),
  });
  return result.diagnostic;
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
  return apiRequest('/vehicle-stock');
}
