import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for users and clients (refreshed every 5 minutes)
let usersCache: { data: Map<string, any>; timestamp: number } | null = null;
let clientsCache: { data: Map<string, any>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOLIBARR_URL = Deno.env.get('DOLIBARR_URL');
    const DOLIBARR_API_KEY = Deno.env.get('DOLIBARR_API_KEY');

    if (!DOLIBARR_URL || !DOLIBARR_API_KEY) {
      console.error('Missing DOLIBARR_URL or DOLIBARR_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuration Dolibarr manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, params } = await req.json();
    console.log('Dolibarr API request:', action, params);

    const baseUrl = DOLIBARR_URL.replace(/\/+$/, '') + '/api/index.php';
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'DOLAPIKEY': DOLIBARR_API_KEY,
    };
    
    let endpoint = '';
    let method = 'GET';
    let body = null;

    // Helper to get cached users
    async function getCachedUsers(): Promise<Map<string, any>> {
      const now = Date.now();
      if (usersCache && (now - usersCache.timestamp) < CACHE_TTL) {
        return usersCache.data;
      }
      
      const usersMap = new Map();
      try {
        const response = await fetchWithTimeout(`${baseUrl}/users?limit=100`, { method: 'GET', headers }, 8000);
        if (response.ok) {
          const usersData = await response.json();
          console.log('[getCachedUsers] First user raw data:', JSON.stringify(usersData[0] || {}).substring(0, 500));
          if (Array.isArray(usersData)) {
            usersData.forEach((u: any) => {
              // Check admin status - admin=1 or superadmin=1 or login='admin'
              const isAdmin = u.admin === '1' || u.admin === 1 || 
                              u.superadmin === '1' || u.superadmin === 1 ||
                              (u.login || '').toLowerCase() === 'admin';
              
              usersMap.set(String(u.id), {
                id: parseInt(u.id),
                name: u.lastname || u.login || '',
                firstName: u.firstname || '',
                login: u.login || '',
                email: u.email || '',
                admin: isAdmin ? '1' : '0',
                superadmin: u.superadmin || '0',
                statut: u.statut || '1',
              });
            });
          }
        }
      } catch (e) {
        console.error('Could not fetch users:', e);
      }
      
      usersCache = { data: usersMap, timestamp: now };
      return usersMap;
    }

    // Helper to get cached clients
    async function getCachedClients(): Promise<Map<string, any>> {
      const now = Date.now();
      if (clientsCache && (now - clientsCache.timestamp) < CACHE_TTL) {
        return clientsCache.data;
      }
      
      const clientsMap = new Map();
      try {
        const response = await fetchWithTimeout(`${baseUrl}/thirdparties?limit=1000`, { method: 'GET', headers }, 15000);
        if (response.ok) {
          const clientsData = await response.json();
          if (Array.isArray(clientsData)) {
            clientsData.forEach((c: any) => {
              const extrafields = c.array_options || c.extrafields || {};
              clientsMap.set(String(c.id), {
                id: parseInt(c.id),
                name: c.name || c.nom || '',
                address: c.address || '',
                zip: c.zip || '',
                town: c.town || '',
                phone: c.phone || '',
                email: c.email || '',
                extrafields: extrafields,
                ref_client: c.ref_client || c.code_client || extrafields.options_ref_client || '',
                contact_name: extrafields.options_contact_name || extrafields.options_contact || '',
                intercom: extrafields.options_intercom || extrafields.options_code_intercom || '',
                access_code: extrafields.options_code_acces || extrafields.options_access_code || '',
                notes: c.note_public || c.note_private || '',
              });
            });
          }
        }
      } catch (e) {
        console.error('Could not fetch thirdparties:', e);
      }
      
      clientsCache = { data: clientsMap, timestamp: now };
      return clientsMap;
    }

    // Route actions to Dolibarr endpoints
    switch (action) {
      // Status
      case 'status':
        endpoint = '/status';
        break;

      // Login - find user by login OR email
      case 'login': {
        const loginValue = (params.login || '').replace(/'/g, "''").trim().toLowerCase();
        console.log(`[LOGIN] Attempting login for: "${loginValue}"`);
        
        const usersMap = await getCachedUsers();
        
        let matchedUser = null;
        for (const [, u] of usersMap) {
          const userLogin = (u.login || '').toLowerCase();
          const userEmail = (u.email || '').toLowerCase();
          if (userLogin === loginValue || userEmail === loginValue) {
            matchedUser = u;
            break;
          }
        }
        
        if (matchedUser) {
          console.log(`[LOGIN] SUCCESS - Found user: id=${matchedUser.id}`);
          return new Response(
            JSON.stringify([matchedUser]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log(`[LOGIN] FAILED - No user found`);
          return new Response(
            JSON.stringify([]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Get all users with emails
      case 'get-users': {
        console.log('[GET-USERS] Fetching all Dolibarr users');
        const usersMap = await getCachedUsers();
        const usersArray = Array.from(usersMap.values());
        console.log(`[GET-USERS] Found ${usersArray.length} users`);
        return new Response(
          JSON.stringify(usersArray),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get current user info
      case 'get-current-user':
        endpoint = '/users/info';
        break;

      // Thirdparties (Clients)
      case 'get-thirdparties':
        endpoint = '/thirdparties' + (params?.search ? `?sqlfilters=(t.nom:like:'%${params.search}%')&limit=50` : '?limit=100');
        break;
      case 'get-thirdparty':
        endpoint = `/thirdparties/${params.id}`;
        break;

      // Interventions - OPTIMIZED: Parallel fetching
      case 'get-interventions': {
        let query = '?sortfield=t.datec&sortorder=DESC&limit=500';
        
        if (params?.status !== undefined) {
          query += `&sqlfilters=(t.fk_statut:=:${params.status})`;
        }
        
        if (params?.userId) {
          query += params.status !== undefined 
            ? `and(t.fk_user_author:=:${params.userId})`
            : `&sqlfilters=(t.fk_user_author:=:${params.userId})`;
        }
        
        endpoint = '/interventions' + query;
        console.log('Fetching interventions (optimized)...');
        
        // Fetch interventions + users + clients in PARALLEL
        const [intResponse, usersMap, clientsMap] = await Promise.all([
          fetchWithTimeout(`${baseUrl}${endpoint}`, { method: 'GET', headers }, 20000),
          getCachedUsers(),
          getCachedClients(),
        ]);
        
        if (!intResponse.ok) {
          const errText = await intResponse.text();
          console.error('Error fetching interventions:', errText);
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${intResponse.status}`, details: errText }),
            { status: intResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let interventions = await intResponse.json();
        if (!Array.isArray(interventions)) {
          interventions = [];
        }
        
        console.log(`Found ${interventions.length} interventions`);
        
        // Enrich each intervention (no additional API calls needed!)
        const enrichedInterventions = interventions.map((int: any) => {
          const authorId = String(int.fk_user_author || int.user_author_id || '');
          const assignedUser = usersMap.get(authorId);
          
          const clientId = String(int.socid || int.fk_soc || '');
          const clientInfo = clientsMap.get(clientId);
          
          const intExtrafields = int.array_options || int.extrafields || {};
          
          return {
            ...int,
            assignedTo: assignedUser || null,
            thirdparty_name: clientInfo?.name || int.thirdparty_name || '',
            client_address: clientInfo?.address || '',
            client_zip: clientInfo?.zip || '',
            client_town: clientInfo?.town || '',
            client_phone: clientInfo?.phone || '',
            client_email: clientInfo?.email || '',
            client_ref: clientInfo?.ref_client || '',
            client_contact_name: clientInfo?.contact_name || '',
            client_intercom: clientInfo?.intercom || '',
            client_access_code: clientInfo?.access_code || '',
            client_notes: clientInfo?.notes || '',
            client_extrafields: clientInfo?.extrafields || {},
            extra_bon: intExtrafields.options_bongerance || intExtrafields.options_bon || '',
            extra_adresse: intExtrafields.options_propimm || intExtrafields.options_adresse || '',
            extra_contact: intExtrafields.options_employe || intExtrafields.options_contact || '',
            extra_cle: intExtrafields.options_cle || '',
            extra_code: intExtrafields.options_code || '',
            extra_no_imm: intExtrafields.options_noimm || '',
            extra_adresse_complete: intExtrafields.options_adresse || '',
            extra_n_compt: intExtrafields.options_ncompt || '',
            intervention_extrafields: intExtrafields,
          };
        });
        
        return new Response(
          JSON.stringify(enrichedInterventions),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'get-intervention': {
        const intId = params.id;
        console.log('Fetching single intervention:', intId);
        
        // Fetch intervention + users + clients in PARALLEL
        const [intResponse, usersMap, clientsMap] = await Promise.all([
          fetchWithTimeout(`${baseUrl}/interventions/${intId}`, { method: 'GET', headers }, 10000),
          getCachedUsers(),
          getCachedClients(),
        ]);
        
        if (!intResponse.ok) {
          const errText = await intResponse.text();
          console.error('Error fetching intervention:', errText);
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${intResponse.status}` }),
            { status: intResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const intData = await intResponse.json();
        
        // Get client and user from cache
        const clientId = String(intData.socid || intData.fk_soc || '');
        const clientInfo = clientsMap.get(clientId);
        
        const authorId = String(intData.fk_user_author || intData.user_author_id || '');
        const assignedUser = usersMap.get(authorId);
        
        // Fetch documents and proposals in parallel
        let documents: any[] = [];
        let linkedProposalRef = null;
        
        const [docsResponse, propResponse] = await Promise.allSettled([
          fetchWithTimeout(`${baseUrl}/documents?modulepart=ficheinter&id=${intId}`, { method: 'GET', headers }, 5000),
          intData.fk_projet 
            ? fetchWithTimeout(`${baseUrl}/proposals?sqlfilters=(t.fk_projet:=:${intData.fk_projet})&limit=1`, { method: 'GET', headers }, 5000)
            : Promise.resolve(null),
        ]);
        
        if (docsResponse.status === 'fulfilled' && docsResponse.value?.ok) {
          const docsData = await docsResponse.value.json();
          if (Array.isArray(docsData)) {
            documents = docsData.map((doc: any) => ({
              name: doc.name || doc.filename,
              url: doc.fullname || doc.url || '',
              type: doc.type || 'file',
            }));
          }
        }
        
        if (propResponse.status === 'fulfilled' && propResponse.value?.ok) {
          const proposals = await propResponse.value.json();
          if (Array.isArray(proposals) && proposals.length > 0) {
            linkedProposalRef = proposals[0].ref;
          }
        }
        
        // Enrich lines with product info (batch if possible)
        const lines = intData.lines || [];
        const productIds = Array.from(new Set(lines.filter((l: any) => l.fk_product).map((l: any) => String(l.fk_product)))) as string[];
        
        // Fetch all products in parallel
        const productsMap = new Map();
        if (productIds.length > 0) {
          const idsToFetch = productIds.slice(0, 20);
          const productPromises = idsToFetch.map((pid) => 
            fetchWithTimeout(`${baseUrl}/products/${pid}`, { method: 'GET', headers }, 5000)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          );
          
          const productResults = await Promise.all(productPromises);
          idsToFetch.forEach((pid, idx) => {
            if (productResults[idx]) {
              productsMap.set(pid, productResults[idx]);
            }
          });
        }
        
        const enrichedLines = lines.map((line: any) => {
          const productInfo = productsMap.get(String(line.fk_product));
          return {
            ...line,
            product_ref: productInfo?.ref || line.product_ref || '',
            product_label: productInfo?.label || line.desc || '',
            product_price: productInfo?.price || line.subprice || 0,
          };
        });
        
        const intExtrafields = intData.array_options || intData.extrafields || {};
        
        const enrichedIntervention = {
          ...intData,
          lines: enrichedLines,
          thirdparty_name: clientInfo?.name || intData.thirdparty_name || '',
          client_address: clientInfo?.address || '',
          client_zip: clientInfo?.zip || '',
          client_town: clientInfo?.town || '',
          client_phone: clientInfo?.phone || '',
          client_email: clientInfo?.email || '',
          assignedTo: assignedUser,
          linked_proposal_ref: linkedProposalRef,
          documents: documents,
          extra_bon: intExtrafields.options_bongerance || intExtrafields.options_bon || '',
          extra_adresse: intExtrafields.options_propimm || intExtrafields.options_adresse || '',
          extra_contact: intExtrafields.options_employe || intExtrafields.options_contact || '',
          extra_cle: intExtrafields.options_cle || '',
          extra_code: intExtrafields.options_code || '',
          extra_no_imm: intExtrafields.options_noimm || '',
          extra_adresse_complete: intExtrafields.options_adresse || '',
          extra_n_compt: intExtrafields.options_ncompt || '',
          intervention_extrafields: intExtrafields,
        };
        
        return new Response(
          JSON.stringify(enrichedIntervention),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'create-intervention':
        endpoint = '/interventions';
        method = 'POST';
        body = JSON.stringify({
          socid: params.clientId,
          description: params.label,
          note_public: params.description || '',
          fk_statut: 0,
        });
        break;
      case 'update-intervention':
        endpoint = `/interventions/${params.id}`;
        method = 'PUT';
        body = JSON.stringify(params.data);
        break;

      // Intervention Lines
      case 'add-intervention-line':
        endpoint = `/interventions/${params.interventionId}/lines`;
        method = 'POST';
        body = JSON.stringify({
          fk_product: params.productId,
          qty: params.qty,
          desc: params.description || '',
        });
        break;
      case 'update-intervention-line':
        endpoint = `/interventions/${params.interventionId}/lines/${params.lineId}`;
        method = 'PUT';
        body = JSON.stringify(params.data);
        break;

      // Products
      case 'get-products':
        endpoint = '/products' + (params?.search ? `?sqlfilters=(t.label:like:'%${params.search}%')&limit=50` : '?limit=100');
        break;
      case 'get-product':
        endpoint = `/products/${params.id}`;
        break;
      
      // Stock
      case 'get-stock': {
        console.log('Fetching stock from Dolibarr...');
        
        const stockResponse = await fetchWithTimeout(`${baseUrl}/products?limit=500&includestockdata=1`, { method: 'GET', headers }, 15000);
        
        if (!stockResponse.ok) {
          const errText = await stockResponse.text();
          console.error('Error fetching stock:', errText);
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${stockResponse.status}`, details: errText }),
            { status: stockResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const products = await stockResponse.json();
        
        const stockItems = Array.isArray(products) ? products.map((p: any) => ({
          productId: parseInt(p.id),
          productRef: p.ref || '',
          productName: p.label || p.description || '',
          quantity: parseFloat(p.stock_reel || p.stock || '0'),
          minQuantity: parseFloat(p.seuil_stock_alerte || p.desiredstock || '0'),
          unit: p.fk_unit_label || p.unit || 'unité',
          price: parseFloat(p.price || p.price_ttc || '0'),
          barcode: p.barcode || '',
          category: p.category_label || '',
        })).filter((item: any) => item.quantity !== 0 || item.minQuantity > 0) : [];
        
        return new Response(
          JSON.stringify(stockItems),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Users
      case 'get-users':
        endpoint = '/users?limit=100';
        break;
      case 'get-user':
        endpoint = `/users/${params.id}`;
        break;

      // Documents
      case 'upload-document':
        endpoint = '/documents/upload';
        method = 'POST';
        body = JSON.stringify({
          filename: params.filename,
          modulepart: params.modulepart || 'ficheinter',
          ref: params.ref,
          subdir: params.subdir || '',
          filecontent: params.filecontent,
          fileencoding: 'base64',
          overwriteifexists: params.overwrite ? 1 : 0,
        });
        break;
      case 'build-document':
        endpoint = '/documents/builddoc';
        method = 'PUT';
        body = JSON.stringify({
          modulepart: params.modulepart || 'ficheinter',
          original_file: params.ref,
          doctemplate: params.template || 'soleil',
          langcode: params.lang || 'fr_FR',
        });
        break;
      case 'download-document': {
        // Download a document from Dolibarr
        const docPath = params.path;
        console.log('Downloading document:', docPath);
        
        const downloadResponse = await fetchWithTimeout(
          `${baseUrl}/documents/download?modulepart=${params.modulepart || 'ficheinter'}&original_file=${encodeURIComponent(docPath)}`,
          { method: 'GET', headers },
          30000
        );
        
        if (!downloadResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Document non trouvé' }),
            { status: downloadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const docData = await downloadResponse.json();
        return new Response(
          JSON.stringify(docData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Agenda / Events
      case 'get-agenda':
        endpoint = '/agendaevents' + (params?.userId ? `?userassigned=${params.userId}` : '') + '&limit=100';
        break;
      case 'create-event':
        endpoint = '/agendaevents';
        method = 'POST';
        body = JSON.stringify(params.data);
        break;

      // Projects
      case 'get-projects':
        endpoint = '/projects?limit=100';
        break;
      case 'get-project':
        endpoint = `/projects/${params.id}`;
        break;

      // Tasks
      case 'get-tasks':
        endpoint = '/tasks' + (params?.projectId ? `?sqlfilters=(t.fk_projet:=:${params.projectId})` : '') + '&limit=100';
        break;
      case 'add-task-time':
        endpoint = `/tasks/${params.taskId}/timespent`;
        method = 'POST';
        body = JSON.stringify({
          datespent: params.date,
          task_duration: params.duration,
          fk_user: params.userId,
          note: params.note || '',
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Action inconnue: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Calling Dolibarr: ${method} ${baseUrl}${endpoint}`);

    const dolibarrResponse = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body,
    }, 20000);

    const responseText = await dolibarrResponse.text();
    console.log(`Dolibarr response: ${dolibarrResponse.status}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!dolibarrResponse.ok) {
      console.error('Dolibarr error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: `Erreur Dolibarr ${dolibarrResponse.status}`,
          details: responseData 
        }),
        { status: dolibarrResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in dolibarr-api:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
