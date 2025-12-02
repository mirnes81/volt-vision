import { Intervention, Material, Task, Worker, WorkerHour, Product } from '@/types/intervention';
import { mockInterventions, mockProducts, mockWorker, delay } from './mockData';
import { isDolibarrConfigured } from './dolibarrConfig';
import * as dolibarrApi from './dolibarrApi';

// Store for mock data mutations
let interventions = [...mockInterventions];
let currentToken: string | null = localStorage.getItem('mv3_token');

// Helper to check if we should use real API
function useRealApi(): boolean {
  return isDolibarrConfigured();
}

// Auth
export async function login(username: string, password: string): Promise<{ token: string; worker: Worker }> {
  // Use real API if configured
  if (useRealApi()) {
    const result = await dolibarrApi.dolibarrLogin(username, password);
    currentToken = result.token;
    return result;
  }
  
  // Mock mode
  await delay(800);
  if (username === 'demo' && password === 'demo') {
    const token = 'mock_token_' + Date.now();
    localStorage.setItem('mv3_token', token);
    localStorage.setItem('mv3_worker', JSON.stringify(mockWorker));
    currentToken = token;
    return { token, worker: mockWorker };
  }
  
  throw new Error('Identifiants invalides');
}

export function logout(): void {
  localStorage.removeItem('mv3_token');
  localStorage.removeItem('mv3_worker');
  currentToken = null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('mv3_token');
}

export function getCurrentWorker(): Worker | null {
  const data = localStorage.getItem('mv3_worker');
  return data ? JSON.parse(data) : null;
}

// Interventions
export async function getTodayInterventions(): Promise<Intervention[]> {
  if (useRealApi()) {
    return dolibarrApi.fetchInterventions();
  }
  
  await delay(500);
  return interventions.filter(i => i.status !== 'facture');
}

export async function getIntervention(id: number): Promise<Intervention> {
  if (useRealApi()) {
    return dolibarrApi.fetchIntervention(id);
  }
  
  await delay(300);
  const intervention = interventions.find(i => i.id === id);
  if (!intervention) throw new Error('Intervention non trouvée');
  return { ...intervention };
}

// Hours
export async function startHours(interventionId: number, workType: string): Promise<WorkerHour> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrStartHours(interventionId, workType);
  }
  
  await delay(300);
  const worker = getCurrentWorker();
  if (!worker) throw new Error('Non authentifié');
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id,
    userName: `${worker.firstName} ${worker.name}`,
    dateStart: new Date().toISOString(),
    workType,
  };
  
  intervention.hours.push(newHour);
  if (intervention.status === 'a_planifier') {
    intervention.status = 'en_cours';
  }
  
  return newHour;
}

export async function stopHours(interventionId: number, hourId: number): Promise<WorkerHour> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrStopHours(interventionId, hourId);
  }
  
  await delay(300);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  const hour = intervention.hours.find(h => h.id === hourId);
  if (!hour) throw new Error('Entrée horaire non trouvée');
  
  hour.dateEnd = new Date().toISOString();
  const start = new Date(hour.dateStart);
  const end = new Date(hour.dateEnd);
  hour.durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
  
  return hour;
}

export async function addManualHours(
  interventionId: number, 
  data: { dateStart: string; dateEnd: string; workType: string; comment?: string }
): Promise<WorkerHour> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrAddManualHours(interventionId, data);
  }
  
  await delay(300);
  const worker = getCurrentWorker();
  if (!worker) throw new Error('Non authentifié');
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  const start = new Date(data.dateStart);
  const end = new Date(data.dateEnd);
  
  const newHour: WorkerHour = {
    id: Date.now(),
    userId: worker.id,
    userName: `${worker.firstName} ${worker.name}`,
    dateStart: data.dateStart,
    dateEnd: data.dateEnd,
    durationHours: Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100,
    workType: data.workType,
    comment: data.comment,
  };
  
  intervention.hours.push(newHour);
  return newHour;
}

// Materials
export async function getProducts(): Promise<Product[]> {
  if (useRealApi()) {
    return dolibarrApi.fetchProducts();
  }
  
  await delay(200);
  return mockProducts;
}

export async function addMaterial(
  interventionId: number, 
  data: { productId: number; qty: number; comment?: string }
): Promise<Material> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrAddMaterial(interventionId, { 
      productId: data.productId, 
      qtyUsed: data.qty, 
      comment: data.comment 
    });
  }
  
  await delay(300);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  const product = mockProducts.find(p => p.id === data.productId);
  if (!product) throw new Error('Produit non trouvé');
  
  const newMaterial: Material = {
    id: Date.now(),
    productId: data.productId,
    productName: product.label,
    qtyUsed: data.qty,
    unit: product.unit,
    comment: data.comment,
  };
  
  intervention.materials.push(newMaterial);
  return newMaterial;
}

// Tasks
export async function updateTaskStatus(
  interventionId: number, 
  taskId: number, 
  status: 'a_faire' | 'fait'
): Promise<Task> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrUpdateTask(interventionId, taskId, status);
  }
  
  await delay(200);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  const task = intervention.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Tâche non trouvée');
  
  task.status = status;
  task.dateDone = status === 'fait' ? new Date().toISOString() : undefined;
  
  // Check if all tasks are done
  const allDone = intervention.tasks.every(t => t.status === 'fait');
  if (allDone && intervention.status === 'en_cours') {
    intervention.status = 'termine';
  }
  
  return task;
}

// Photos
export async function uploadPhoto(
  interventionId: number, 
  file: File, 
  type: 'avant' | 'pendant' | 'apres' | 'oibt' | 'defaut'
): Promise<{ id: number; filePath: string }> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrUploadPhoto(interventionId, file, type);
  }
  
  await delay(500);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  // Create object URL for preview (in real app, upload to server)
  const filePath = URL.createObjectURL(file);
  
  const photo = {
    id: Date.now(),
    type,
    filePath,
    datePhoto: new Date().toISOString(),
  };
  
  intervention.photos.push(photo);
  
  return { id: photo.id, filePath };
}

// Signature
export async function saveSignature(interventionId: number, signatureDataUrl: string, signerName?: string): Promise<void> {
  if (useRealApi()) {
    await dolibarrApi.dolibarrSaveSignature(interventionId, signatureDataUrl, signerName || 'Client');
    return;
  }
  
  await delay(300);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  intervention.signaturePath = signatureDataUrl;
}

// AI
export async function generateAiSummary(interventionId: number): Promise<string> {
  if (useRealApi()) {
    const result = await dolibarrApi.dolibarrGenerateAiSummary(interventionId);
    return result.summary;
  }
  
  await delay(1500);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  // Mock AI response
  const summary = `Intervention ${intervention.ref} - ${intervention.label}

Résumé automatique:
- Type: ${intervention.type}
- Client: ${intervention.clientName}
- Lieu: ${intervention.location}

Travaux effectués:
${intervention.tasks.filter(t => t.status === 'fait').map(t => `✓ ${t.label}`).join('\n')}

Travaux restants:
${intervention.tasks.filter(t => t.status === 'a_faire').map(t => `○ ${t.label}`).join('\n')}

Matériel utilisé:
${intervention.materials.map(m => `- ${m.qtyUsed} ${m.unit} ${m.productName}`).join('\n') || 'Aucun matériel enregistré'}

Heures travaillées: ${intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0).toFixed(1)}h`;

  intervention.aiSummary = summary;
  return summary;
}

export async function generateAiDiagnostic(interventionId: number): Promise<string> {
  if (useRealApi()) {
    return dolibarrApi.dolibarrGenerateAiDiagnostic(interventionId);
  }
  
  await delay(1500);
  
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention) throw new Error('Intervention non trouvée');
  
  // Mock AI diagnostic for troubleshooting
  const diagnostic = `Diagnostic IA - ${intervention.ref}

Basé sur la description: "${intervention.description}"

Pistes de diagnostic suggérées:
1. Vérifier le différentiel principal (30mA)
2. Contrôler l'isolation des circuits concernés
3. Rechercher un court-circuit éventuel
4. Tester les appareils un par un

Matériel recommandé:
- Multimètre
- Testeur d'isolation (Megger)
- Pince ampèremétrique

⚠️ Rappel sécurité: Toujours couper l'alimentation avant intervention`;

  intervention.aiDiagnostic = diagnostic;
  return diagnostic;
}
