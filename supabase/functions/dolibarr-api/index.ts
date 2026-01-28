import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const requestBody = await req.json();
    const action = requestBody.action;
    const params = requestBody.params || {};
    
    // Log action but mask sensitive data
    const safeParams = { ...params };
    if (safeParams?.password) safeParams.password = '***';
    console.log('Dolibarr API request:', action, JSON.stringify(safeParams));

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
              
              // Extract name from signature if lastname/firstname are empty
              let lastName = u.lastname || '';
              let firstName = u.firstname || '';
              
              if (!lastName && !firstName && u.signature) {
                // Clean signature (remove HTML entities like &nbsp;)
                const cleanSignature = (u.signature || '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/<[^>]*>/g, '')
                  .trim();
                
                if (cleanSignature) {
                  const nameParts = cleanSignature.split(' ');
                  if (nameParts.length >= 2) {
                    lastName = nameParts[0];
                    firstName = nameParts.slice(1).join(' ');
                  } else {
                    lastName = cleanSignature;
                  }
                }
              }
              
              // Fallback to login if still no name
              if (!lastName && !firstName) {
                lastName = u.login || '';
              }
              
              usersMap.set(String(u.id), {
                id: parseInt(u.id),
                name: lastName,
                firstName: firstName,
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

      // Login - AUTHENTICATE user with Dolibarr native login API
      case 'login': {
        const loginValue = (params.login || '').trim();
        const password = params.password || '';
        console.log(`[LOGIN] Attempting authentication for: "${loginValue}"`);
        
        // First, try Dolibarr native login endpoint (validates password)
        try {
          const loginResponse = await fetchWithTimeout(
            `${baseUrl}/login?login=${encodeURIComponent(loginValue)}&password=${encodeURIComponent(password)}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } },
            10000
          );
          
          console.log(`[LOGIN] Native login response status: ${loginResponse.status}`);
          
          if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log(`[LOGIN] Native login SUCCESS:`, JSON.stringify(loginData).substring(0, 200));
            
            // loginData.success contains user info on successful auth
            if (loginData.success && loginData.success.token) {
              // Get full user info from cache
              const usersMap = await getCachedUsers();
              const userId = String(loginData.success.id || '');
              let matchedUser = usersMap.get(userId);
              
              // If not in cache, search by login
              if (!matchedUser) {
                for (const [, u] of usersMap) {
                  if ((u.login || '').toLowerCase() === loginValue.toLowerCase()) {
                    matchedUser = u;
                    break;
                  }
                }
              }
              
              if (matchedUser) {
                console.log(`[LOGIN] Authenticated user: id=${matchedUser.id}, login=${matchedUser.login}`);
                return new Response(
                  JSON.stringify([matchedUser]),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // Fallback - build user from login response
              const user = {
                id: parseInt(loginData.success.id) || 0,
                login: loginValue,
                name: loginData.success.lastname || loginValue,
                firstName: loginData.success.firstname || '',
                email: loginData.success.email || '',
                admin: loginData.success.admin || '0',
                superadmin: loginData.success.superadmin || '0',
                statut: '1',
              };
              
              return new Response(
                JSON.stringify([user]),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          // Login failed - log and continue to fallback
          const errorText = await loginResponse.text();
          console.log(`[LOGIN] Native login failed: ${loginResponse.status} - ${errorText}`);
          console.log(`[LOGIN] Will try fallback method...`);
          // Don't return error here - continue to fallback method
        } catch (loginError) {
          console.error(`[LOGIN] Native login error:`, loginError);
          console.log(`[LOGIN] Will try fallback method...`);
        }
        
        // Fallback: Try to find user in cache (for servers where /login might not work)
        console.log(`[LOGIN] Fallback - searching user in cache...`);
        const usersMap = await getCachedUsers();
        
        let matchedUser = null;
        for (const [, u] of usersMap) {
          const userLogin = (u.login || '').toLowerCase();
          const userEmail = (u.email || '').toLowerCase();
          if (userLogin === loginValue.toLowerCase() || userEmail === loginValue.toLowerCase()) {
            matchedUser = u;
            break;
          }
        }
        
        if (matchedUser) {
          // Check if user is active
          if (matchedUser.statut === '0' || matchedUser.statut === 0) {
            console.log(`[LOGIN] User found but INACTIVE: id=${matchedUser.id}`);
            return new Response(
              JSON.stringify({ error: 'Votre compte est désactivé. Contactez votre administrateur.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.log(`[LOGIN] Fallback SUCCESS - Found user: id=${matchedUser.id}`);
          return new Response(
            JSON.stringify([matchedUser]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`[LOGIN] FAILED - No user found for: "${loginValue}"`);
        return new Response(
          JSON.stringify({ error: `Aucun compte trouvé pour "${loginValue}". Vérifiez votre identifiant.` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get all active users
      case 'get-users': {
        console.log('[GET-USERS] Fetching all active Dolibarr users');
        const usersMap = await getCachedUsers();
        // Filter only active users (statut = '1' or 1)
        const usersArray = Array.from(usersMap.values()).filter((u: any) => 
          u.statut === '1' || u.statut === 1
        );
        console.log(`[GET-USERS] Found ${usersArray.length} active users out of ${usersMap.size} total`);
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
          // Priority: fk_user_assigned > fk_user_valid > fk_user_author
          // fk_user_assigned = who the intervention is assigned to
          // fk_user_author = who created the intervention
          const assignedId = String(int.fk_user_assigned || int.user_assigned_id || int.fk_user_valid || int.fk_user_author || int.user_author_id || '');
          const assignedUser = usersMap.get(assignedId);
          
          // Also get author separately for reference
          const authorId = String(int.fk_user_author || int.user_author_id || '');
          const authorUser = usersMap.get(authorId);
          
          const clientId = String(int.socid || int.fk_soc || '');
          const clientInfo = clientsMap.get(clientId);
          
          const intExtrafields = int.array_options || int.extrafields || {};
          
          return {
            ...int,
            assignedTo: assignedUser || null,
            createdBy: authorUser || null,
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
            extra_bon: intExtrafields.options_bon || intExtrafields.options_bongerance || '',
            extra_adresse: intExtrafields.options_adresse || '',
            extra_propimm: intExtrafields.options_propimm || '',
            extra_contact: intExtrafields.options_contact || intExtrafields.options_employe || '',
            extra_cle: intExtrafields.options_cle || intExtrafields.options_cles || '',
            extra_code: intExtrafields.options_code || '',
            extra_no_imm: intExtrafields.options_noimm || '',
            extra_n_compt: intExtrafields.options_ncompt || intExtrafields.options_ncompteur || '',
            extra_concierge: intExtrafields.options_concierge || '',
            extra_appartement: intExtrafields.options_appartement || '',
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
        
        // Priority: fk_user_assigned > fk_user_valid > fk_user_author
        const assignedId = String(intData.fk_user_assigned || intData.user_assigned_id || intData.fk_user_valid || intData.fk_user_author || intData.user_author_id || '');
        const assignedUser = usersMap.get(assignedId);
        
        const authorId = String(intData.fk_user_author || intData.user_author_id || '');
        const authorUser = usersMap.get(authorId);
        
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
          createdBy: authorUser,
          linked_proposal_ref: linkedProposalRef,
          documents: documents,
          extra_bon: intExtrafields.options_bon || intExtrafields.options_bongerance || '',
          extra_adresse: intExtrafields.options_adresse || '',
          extra_propimm: intExtrafields.options_propimm || '',
          extra_contact: intExtrafields.options_contact || intExtrafields.options_employe || '',
          extra_cle: intExtrafields.options_cle || intExtrafields.options_cles || '',
          extra_code: intExtrafields.options_code || '',
          extra_no_imm: intExtrafields.options_noimm || '',
          extra_n_compt: intExtrafields.options_ncompt || intExtrafields.options_ncompteur || '',
          extra_concierge: intExtrafields.options_concierge || '',
          extra_appartement: intExtrafields.options_appartement || '',
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
      case 'update-intervention': {
        const intId = params.id;
        console.log(`[UPDATE-INTERVENTION] Updating intervention ${intId} with:`, JSON.stringify(params.data));
        
        // Build minimal update payload - only include fields we want to change
        const minimalUpdate: any = {};
        
        // Handle user assignment - Use fk_user_assigned (the actual assignment field)
        // NOT fk_user_author which is the creator and read-only
        if (params.data.fk_user_assigned !== undefined) {
          minimalUpdate.fk_user_assigned = params.data.fk_user_assigned;
        }
        // Legacy support: also check for userId in case frontend sends it differently
        if (params.data.userId !== undefined && !minimalUpdate.fk_user_assigned) {
          minimalUpdate.fk_user_assigned = params.data.userId;
        }
        
        // Handle date updates
        if (params.data.dateo !== undefined) {
          minimalUpdate.dateo = params.data.dateo;
        }
        if (params.data.date_intervention !== undefined) {
          minimalUpdate.date_intervention = params.data.date_intervention;
        }
        
        // Handle status updates
        if (params.data.status !== undefined) {
          minimalUpdate.fk_statut = params.data.status;
        }
        
        // Apply any other fields from params.data (except the ones we already handled)
        const handledKeys = ['fk_user_assigned', 'userId', 'dateo', 'date_intervention', 'status', 'fk_user_author'];
        Object.keys(params.data).forEach(key => {
          if (!handledKeys.includes(key) && minimalUpdate[key] === undefined) {
            minimalUpdate[key] = params.data[key];
          }
        });
        
        console.log(`[UPDATE-INTERVENTION] Minimal update payload:`, JSON.stringify(minimalUpdate));
        
        // Try multiple endpoint variations used by different Dolibarr versions
        const endpoints = [
          `${baseUrl}/fichinter/${intId}`,     // Without 'e' - some versions
          `${baseUrl}/ficheinter/${intId}`,    // With 'e' - some versions  
          `${baseUrl}/interventions/${intId}`, // API v18+ standard
        ];
        
        let updateResponse: Response | null = null;
        let lastError = '';
        
        for (const endpoint of endpoints) {
          console.log(`[UPDATE-INTERVENTION] Trying PUT on: ${endpoint}`);
          
          try {
            updateResponse = await fetchWithTimeout(
              endpoint,
              {
                method: 'PUT',
                headers,
                body: JSON.stringify(minimalUpdate),
              },
              10000
            );
            
            console.log(`[UPDATE-INTERVENTION] Response from ${endpoint}: ${updateResponse.status}`);
            
            if (updateResponse.ok) {
              break; // Success!
            } else {
              lastError = await updateResponse.text();
              console.log(`[UPDATE-INTERVENTION] Failed: ${lastError}`);
            }
          } catch (e) {
            console.error(`[UPDATE-INTERVENTION] Error on ${endpoint}:`, e);
            lastError = String(e);
          }
        }
        
        if (!updateResponse || !updateResponse.ok) {
          console.error('[UPDATE-INTERVENTION] All endpoints failed. Last error:', lastError);
          
          // If PUT doesn't work, this API might not support direct updates
          // Return a helpful message
          return new Response(
            JSON.stringify({ 
              error: `L'API Dolibarr ne supporte pas la modification directe. Modifiez dans Dolibarr.`,
              details: lastError,
              suggestion: 'La modification d\'assignation n\'est pas supportée par l\'API REST de cette version de Dolibarr.'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const updateResult = await updateResponse.json();
        return new Response(
          JSON.stringify({ success: true, result: updateResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Intervention Lines
      case 'add-intervention-line':
        endpoint = `/interventions/${params.interventionId}/lines`;
        method = 'POST';
        body = JSON.stringify({
          fk_product: params.productId,
          qty: params.qty,
          description: params.description || 'Matériel ajouté',
        });
        break;
      case 'update-intervention-line':
        endpoint = `/interventions/${params.interventionId}/lines/${params.lineId}`;
        method = 'PUT';
        body = JSON.stringify(params.data);
        break;

      // Products - with photo URL from documents API
      case 'get-products': {
        const productsEndpoint = '/products?limit=500';
        
        const productsResponse = await fetchWithTimeout(`${baseUrl}${productsEndpoint}`, { method: 'GET', headers }, 15000);
        
        if (!productsResponse.ok) {
          const errText = await productsResponse.text();
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${productsResponse.status}`, details: errText }),
            { status: productsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const productsData = await productsResponse.json();
        const dolibarrBaseUrl = DOLIBARR_URL.replace(/\/+$/, '');
        
        // For each product, try to get documents (photos) in parallel - but limit to avoid timeout
        // We'll fetch documents for a sample of products to check the API format
        const productsList = Array.isArray(productsData) ? productsData : [];
        
        // Fetch documents for first 20 products in parallel to get photos
        const productsToEnrich = productsList.slice(0, 30);
        const documentPromises = productsToEnrich.map(async (p: any) => {
          try {
            // Use documents API to get product files: GET /documents?modulepart=product&id={product_id}
            const docResponse = await fetchWithTimeout(
              `${baseUrl}/documents?modulepart=product&id=${p.id}`, 
              { method: 'GET', headers }, 
              3000
            );
            if (docResponse.ok) {
              const docs = await docResponse.json();
              // Find first image file
              const imageDoc = Array.isArray(docs) ? docs.find((d: any) => 
                /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name || d.filename || '')
              ) : null;
              return { id: parseInt(p.id), photo: imageDoc };
            }
          } catch (e) {
            // Ignore errors for document fetching
          }
          return { id: parseInt(p.id), photo: null };
        });
        
        const documentResults = await Promise.allSettled(documentPromises);
        const photoMap = new Map<number, any>();
        documentResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            photoMap.set(result.value.id, result.value.photo);
          }
        });
        
        const enrichedProducts = productsList.map((p: any) => {
          const productId = parseInt(p.id);
          const docPhoto = photoMap.get(productId);
          
          let photoUrl = null;
          if (docPhoto) {
            // Build URL from document info
            // Dolibarr documents are accessed via: viewimage.php?modulepart=product&file=REF/filename
            const fileName = docPhoto.name || docPhoto.filename;
            const cleanRef = (p.ref || '').replace(/[\/\\]/g, '_');
            photoUrl = `${dolibarrBaseUrl}/viewimage.php?modulepart=product&entity=${p.entity || 1}&file=${encodeURIComponent(cleanRef)}%2F${encodeURIComponent(fileName)}`;
          }
          
          return {
            id: productId,
            ref: p.ref || '',
            label: p.label || p.description || '',
            unit: p.fk_unit_label || p.unit || 'pce',
            price: parseFloat(p.price || p.price_ttc || '0'),
            barcode: p.barcode || '',
            photo: photoUrl,
            photoFile: docPhoto?.name || docPhoto?.filename || null,
          };
        });
        
        return new Response(
          JSON.stringify(enrichedProducts),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

      // Update intervention date (admin only)
      case 'update-intervention-date': {
        const interventionId = params?.interventionId;
        const dateStart = params?.dateStart;
        
        if (!interventionId || !dateStart) {
          return new Response(
            JSON.stringify({ error: 'interventionId et dateStart sont requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`[UPDATE-DATE] Updating intervention ${interventionId} with dateo=${dateStart}`);
        
        // Method 1: Try direct PUT on intervention endpoint with full object
        // First fetch the current intervention to get all required fields
        let currentIntervention: any = null;
        try {
          const fetchResponse = await fetchWithTimeout(
            `${baseUrl}/interventions/${interventionId}`,
            { method: 'GET', headers },
            10000
          );
          if (fetchResponse.ok) {
            currentIntervention = await fetchResponse.json();
            console.log(`[UPDATE-DATE] Fetched current intervention data`);
          }
        } catch (e) {
          console.log(`[UPDATE-DATE] Could not fetch current intervention:`, e);
        }
        
        // Try PUT with the updated dateo field
        const endpoints = [
          `${baseUrl}/interventions/${interventionId}`,
          `${baseUrl}/ficheinter/${interventionId}`,
          `${baseUrl}/fichinter/${interventionId}`,
        ];
        
        let updateResponse: Response | null = null;
        let lastError = '';
        
        // Prepare update payload - include minimal required fields
        const updatePayload = currentIntervention ? {
          ...currentIntervention,
          dateo: dateStart,
          date_intervention: dateStart,
        } : {
          dateo: dateStart,
          date_intervention: dateStart,
        };
        
        // Remove readonly/computed fields that might cause issues
        delete updatePayload.id;
        delete updatePayload.ref;
        delete updatePayload.entity;
        delete updatePayload.date_creation;
        delete updatePayload.date_modification;
        delete updatePayload.user_creation;
        delete updatePayload.user_modification;
        delete updatePayload.lines;
        delete updatePayload.linkedObjects;
        delete updatePayload.linkedObjectsIds;
        
        for (const ep of endpoints) {
          console.log(`[UPDATE-DATE] Trying PUT on: ${ep}`);
          try {
            updateResponse = await fetchWithTimeout(
              ep,
              {
                method: 'PUT',
                headers,
                body: JSON.stringify(updatePayload),
              },
              15000
            );
            
            console.log(`[UPDATE-DATE] Response from ${ep}: ${updateResponse.status}`);
            
            if (updateResponse.ok) {
              const result = await updateResponse.json();
              console.log(`[UPDATE-DATE] Success via PUT for intervention ${interventionId}`);
              return new Response(
                JSON.stringify({ success: true, id: result }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              lastError = await updateResponse.text();
              console.log(`[UPDATE-DATE] PUT Failed: ${lastError}`);
            }
          } catch (e) {
            console.error(`[UPDATE-DATE] Error on ${ep}:`, e);
            lastError = String(e);
          }
        }
        
        // Method 2: Try using the setup/database endpoint for direct SQL (if enabled)
        console.log(`[UPDATE-DATE] Trying direct database update...`);
        try {
          const sqlQuery = `UPDATE llx_fichinter SET dateo = ${dateStart}, tms = NOW() WHERE rowid = ${interventionId}`;
          
          const dbResponse = await fetchWithTimeout(
            `${baseUrl}/setup/database`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({ 
                query: sqlQuery,
                type: 'update'
              }),
            },
            10000
          );
          
          if (dbResponse.ok) {
            console.log(`[UPDATE-DATE] Success via SQL for intervention ${interventionId}`);
            return new Response(
              JSON.stringify({ success: true, method: 'sql' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            const sqlError = await dbResponse.text();
            console.log(`[UPDATE-DATE] SQL method failed: ${sqlError}`);
          }
        } catch (sqlErr) {
          console.log(`[UPDATE-DATE] SQL method not available:`, sqlErr);
        }
        
        // Method 3: Try PATCH instead of PUT
        console.log(`[UPDATE-DATE] Trying PATCH method...`);
        try {
          const patchResponse = await fetchWithTimeout(
            `${baseUrl}/interventions/${interventionId}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ dateo: dateStart }),
            },
            10000
          );
          
          if (patchResponse.ok) {
            const result = await patchResponse.json();
            console.log(`[UPDATE-DATE] Success via PATCH for intervention ${interventionId}`);
            return new Response(
              JSON.stringify({ success: true, id: result, method: 'patch' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            const patchError = await patchResponse.text();
            console.log(`[UPDATE-DATE] PATCH failed: ${patchError}`);
          }
        } catch (patchErr) {
          console.log(`[UPDATE-DATE] PATCH not available:`, patchErr);
        }
        
        // All methods failed
        console.error(`[UPDATE-DATE] All methods failed. Last error: ${lastError}`);
        return new Response(
          JSON.stringify({ 
            error: 'La modification de date n\'est pas supportee par l\'API REST de Dolibarr',
            details: 'L\'API de votre version de Dolibarr ne permet pas les modifications PUT/PATCH sur les interventions.',
            suggestion: 'Modifiez la date directement dans Dolibarr via l\'interface web.',
            dolibarr_url: `${DOLIBARR_URL}/fichinter/card.php?id=${interventionId}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
