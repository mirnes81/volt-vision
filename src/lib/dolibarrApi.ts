// SmartElectric API Client
import { Intervention, Material, Task, Worker, WorkerHour, Product, Photo } from '@/types/intervention';
import { getDolibarrConfig } from './dolibarrConfig';

function getApiUrl(): string {
  const config = getDolibarrConfig();
  if (!config.isConfigured || !config.baseUrl) {
    throw new Error('SmartElectric non configuré');
  }
  return `${config.baseUrl.replace(/\/+$/, '')}/api/index.php/smartelectric`;
}

function getToken(): string {
  const token = localStorage.getItem('smelec_token');
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
      localStorage.removeItem('smelec_token');
      localStorage.removeItem('smelec_worker');
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
    throw new Error('SmartElectric non configuré');
  }
  
  const baseUrl = `${config.baseUrl.replace(/\/+$/, '')}/api/index.php/smartelectric`;
  
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ login: username, password }),
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Identifiants invalides');
    }
    throw new Error('Erreur de connexion au serveur');
  }
  
  const data = await response.json();
  
  // Store credentials
  localStorage.setItem('smelec_token', data.token);
  localStorage.setItem('smelec_worker', JSON.stringify(data.worker));
  
  return data;
}

// Interventions
export async function fetchInterventions(): Promise<Intervention[]> {
  return apiRequest<Intervention[]>('/worker/interventions');
}

export async function fetchIntervention(id: number): Promise<Intervention> {
  return apiRequest<Intervention>(`/intervention/${id}`);
}

// Hours
export async function dolibarrStartHours(interventionId: number, workType: string): Promise<WorkerHour> {
  return apiRequest<WorkerHour>(`/intervention/${interventionId}/hours`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'start',
      data: { workType },
    }),
  });
}

export async function dolibarrStopHours(interventionId: number, hourId: number, comment?: string): Promise<WorkerHour> {
  return apiRequest<WorkerHour>(`/intervention/${interventionId}/hours`, {
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
  return apiRequest<WorkerHour>(`/intervention/${interventionId}/hours`, {
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
  return apiRequest<Material>(`/intervention/${interventionId}/material`, {
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
  return apiRequest<Task>(`/intervention/${interventionId}/task/${taskId}`, {
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
  
  const response = await fetch(`${baseUrl}/intervention/${interventionId}/photo`, {
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
  await apiRequest(`/intervention/${interventionId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signatureData, signerName }),
  });
}

// AI
export async function dolibarrGenerateAiSummary(interventionId: number): Promise<{ summary: string; clientText: string }> {
  return apiRequest<{ summary: string; clientText: string }>(`/intervention/${interventionId}/ai-summary`, {
    method: 'POST',
  });
}

export async function dolibarrGenerateAiDiagnostic(interventionId: number, symptoms?: string): Promise<string> {
  const result = await apiRequest<{ diagnostic: string }>(`/intervention/${interventionId}/ai-diagnostic`, {
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
