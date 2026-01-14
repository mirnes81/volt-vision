// Dolibarr API Client via Edge Function Proxy
import { Intervention, Material, Task, Worker, WorkerHour, Product } from '@/types/intervention';
import { supabase } from '@/integrations/supabase/client';
import { decodeHtmlEntities } from '@/lib/htmlUtils';

// Debug module loading
console.log('[DolibarrApi Module] Loaded, supabase client exists:', !!supabase);
// Helper to call the Dolibarr proxy
async function callDolibarrApi<T>(action: string, params: Record<string, any> = {}): Promise<T> {
  console.log('[DolibarrApi] Starting call:', action, params);
  console.log('[DolibarrApi] Supabase client:', !!supabase);
  
  try {
    const { data, error } = await supabase.functions.invoke('dolibarr-api', {
      body: { action, params },
    });
    
    console.log('[DolibarrApi] Response:', { data, error });
    
    if (error) {
      console.error('[DolibarrApi] Error:', error);
      throw new Error(error.message || 'Erreur de communication avec Dolibarr');
    }
    
    if (data?.error) {
      throw new Error(data.error);
    }
    
    return data as T;
  } catch (err) {
    console.error('[DolibarrApi] Exception caught:', err);
    throw err;
  }
}

// Test connection with timeout
export async function testDolibarrConnection(): Promise<{ success: boolean; version?: string }> {
  console.log('[testDolibarrConnection] Starting...');
  
  try {
    // Timeout of 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout après 10 secondes')), 10000)
    );
    
    const dataPromise = callDolibarrApi<any>('status');
    const data = await Promise.race([dataPromise, timeoutPromise]);
    
    console.log('[testDolibarrConnection] Received data:', data);
    
    return { 
      success: true, 
      version: data?.success?.dolibarr_version || data?.dolibarr_version || 'Version inconnue' 
    };
  } catch (error) {
    console.error('[testDolibarrConnection] Failed:', error);
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
export async function fetchInterventions(filters?: { userId?: number; status?: number }): Promise<Intervention[]> {
  const data = await callDolibarrApi<any[]>('get-interventions', filters || {});
  return data.map(mapDolibarrIntervention);
}

// Fetch only my interventions (assigned to current user)
export async function fetchMyInterventions(): Promise<Intervention[]> {
  const worker = JSON.parse(localStorage.getItem('mv3_worker') || '{}');
  if (worker.id) {
    return fetchInterventions({ userId: worker.id });
  }
  return fetchInterventions();
}

export async function fetchIntervention(id: number): Promise<Intervention> {
  const data = await callDolibarrApi<any>('get-intervention', { id });
  return mapDolibarrIntervention(data);
}

function mapDolibarrIntervention(data: any): Intervention {
  const lines = data.lines || [];
  
  // Build full address from client info if available
  let location = decodeHtmlEntities(data.address || '');
  if (data.client_address || data.client_zip || data.client_town) {
    const parts = [
      decodeHtmlEntities(data.client_address || ''),
      [data.client_zip, decodeHtmlEntities(data.client_town || '')].filter(Boolean).join(' ')
    ].filter(Boolean);
    location = parts.join(', ') || location;
  }
  
  // Debug: Log extrafields data received from backend
  console.log('[mapDolibarrIntervention] Extrafields:', {
    id: data.id,
    ref: data.ref,
    extra_bon: data.extra_bon,
    extra_adresse: data.extra_adresse,
    extra_contact: data.extra_contact,
    extra_cle: data.extra_cle,
    extra_code: data.extra_code,
    intervention_extrafields: data.intervention_extrafields,
  });
  
  console.log('[mapDolibarrIntervention]', {
    id: data.id,
    ref: data.ref,
    thirdparty_name: data.thirdparty_name,
    assignedTo: data.assignedTo,
    description: data.description?.substring(0, 50),
    note_public: data.note_public?.substring(0, 50),
    note_private: data.note_private?.substring(0, 50),
    linesCount: lines.length,
    documents: data.documents?.length || 0,
  });
  
  // Map lines to materials with product info - DECODE ALL TEXT FIELDS
  const materials = lines
    .filter((line: any) => line.fk_product)
    .map((line: any, index: number) => ({
      id: parseInt(line.id) || index,
      productId: parseInt(line.fk_product) || 0,
      productRef: decodeHtmlEntities(line.product_ref || ''),
      productName: decodeHtmlEntities(line.product_label || line.desc || 'Produit'),
      qtyUsed: parseFloat(line.qty) || 1,
      unit: decodeHtmlEntities(line.product_unit || 'pce'),
      price: parseFloat(line.product_price) || parseFloat(line.subprice) || 0,
      comment: decodeHtmlEntities(line.description || ''),
    }));
  
  // Map lines to tasks (lines without product = tasks) - DECODE ALL TEXT FIELDS
  const tasks = lines
    .filter((line: any) => !line.fk_product)
    .map((line: any, index: number) => ({
      id: parseInt(line.id) || index,
      label: decodeHtmlEntities(line.desc || line.description || `Tâche ${index + 1}`),
      order: index,
      status: (line.rang > 0 || line.finished) ? 'fait' as const : 'a_faire' as const,
      dateDone: (line.rang > 0 || line.finished) ? new Date().toISOString() : undefined,
    }));
  
  // Map documents to photos (filter images)
  const photos = (data.documents || [])
    .filter((doc: any) => /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name || ''))
    .map((doc: any, index: number) => ({
      id: index,
      type: 'pendant' as const,
      filePath: doc.url || doc.name,
      datePhoto: new Date().toISOString(),
    }));
  
  // DECODE ALL TEXT FIELDS from Dolibarr
  return {
    id: parseInt(data.id),
    ref: data.ref || `INT-${data.id}`,
    label: decodeHtmlEntities(data.description || data.label || 'Intervention'),
    clientId: parseInt(data.socid) || 0,
    clientName: decodeHtmlEntities(data.thirdparty_name || data.client?.name || 'Client inconnu'),
    clientPhone: data.client_phone || '',
    clientEmail: data.client_email || '',
    clientAddress: decodeHtmlEntities([data.client_address, data.client_zip, data.client_town].filter(Boolean).join(', ')),
    clientRef: data.client_ref || '',
    clientContactName: decodeHtmlEntities(data.client_contact_name || ''),
    clientIntercom: data.client_intercom || '',
    clientAccessCode: data.client_access_code || '',
    clientNotes: decodeHtmlEntities(data.client_notes || ''),
    clientExtrafields: data.client_extrafields || {},
    // Intervention extrafields (from Dolibarr array_options)
    extraBon: decodeHtmlEntities(data.extra_bon || ''),
    extraAdresse: decodeHtmlEntities(data.extra_adresse || ''),
    extraContact: decodeHtmlEntities(data.extra_contact || ''),
    extraCle: decodeHtmlEntities(data.extra_cle || ''),
    extraCode: decodeHtmlEntities(data.extra_code || ''),
    interventionExtrafields: data.intervention_extrafields || {},
    location: location,
    linkedProposalRef: data.linked_proposal_ref || undefined,
    projectRef: data.fk_projet ? `PROJ-${data.fk_projet}` : undefined,
    type: 'depannage',
    priority: 'normal',
    status: mapDolibarrStatus(parseInt(data.fk_statut || data.status || 0)),
    description: decodeHtmlEntities(data.note_public || ''),
    briefing: decodeHtmlEntities(data.note_private || data.description || ''),
    assignedTo: data.assignedTo || undefined,
    dateCreation: data.datec || new Date().toISOString(),
    dateStart: data.datei,
    datePlanned: data.datep,
    tasks: tasks.length > 0 ? tasks : [],
    materials: materials,
    hours: getLocalHours(parseInt(data.id)),
    photos: photos,
    documents: data.documents || [],
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

// Login function - validate user exists in Dolibarr
export async function dolibarrLogin(login: string, password: string): Promise<{ token: string; worker: Worker }> {
  console.log('[dolibarrLogin] Validating user:', login);
  
  try {
    // Search for user by login name
    const users = await callDolibarrApi<any[]>('login', { login, password });
    
    console.log('[dolibarrLogin] Response:', users);
    
    // Check if user was found
    if (Array.isArray(users) && users.length > 0) {
      const userInfo = users[0];
      
      // Check if user is active/enabled
      if (userInfo.statut === '0' || userInfo.statut === 0) {
        throw new Error('Votre compte est désactivé. Contactez votre administrateur.');
      }
      
      // Check if admin (admin field or superadmin)
      const isAdmin = userInfo.admin === '1' || userInfo.admin === 1 || 
                      userInfo.superadmin === '1' || userInfo.superadmin === 1;
      
      const worker = {
        id: parseInt(userInfo.id) || 1,
        login: userInfo.login || login,
        name: userInfo.lastname || userInfo.login || login,
        firstName: userInfo.firstname || '',
        email: userInfo.email || '',
        phone: userInfo.office_phone || '',
        admin: isAdmin ? '1' : '0',
        isAdmin: isAdmin,
      };
      
      // Generate a session token
      const token = `doli_${userInfo.id}_${Date.now()}`;
      
      localStorage.setItem('mv3_token', token);
      localStorage.setItem('mv3_worker', JSON.stringify(worker));
      // Also store as 'worker' for compatibility
      localStorage.setItem('worker', JSON.stringify(worker));
      
      return { token, worker: worker as Worker };
    }
    
    // No user found
    throw new Error(`Aucun compte trouvé pour "${login}". Vérifiez votre identifiant ou email.`);
  } catch (error) {
    console.error('[dolibarrLogin] Failed:', error);
    
    // Re-throw specific errors
    if (error instanceof Error) {
      if (error.message.includes('désactivé') || 
          error.message.includes('Aucun compte') ||
          error.message.includes('Configuration')) {
        throw error;
      }
      
      // Network/server errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion internet.');
      }
      
      if (error.message.includes('500')) {
        throw new Error('Erreur serveur Dolibarr. Contactez votre administrateur.');
      }
      
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Accès refusé. Vérifiez vos droits d\'accès.');
      }
    }
    
    // Generic error
    throw new Error('Identifiants incorrects. Vérifiez votre login et mot de passe.');
  }
}
