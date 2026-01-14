import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    let endpoint = '';
    let method = 'GET';
    let body = null;

    // Route actions to Dolibarr endpoints
    switch (action) {
      // Status
      case 'status':
        endpoint = '/status';
        break;

      // Login - find user by login OR email (all Dolibarr users can connect)
      case 'login': {
        // Dolibarr REST API uses a master API key for authentication
        // All active users in Dolibarr can connect to this app
        const loginValue = (params.login || '').replace(/'/g, "''").trim().toLowerCase();
        console.log(`[LOGIN] Attempting login for: "${loginValue}"`);
        
        // First, fetch ALL active users to find a match
        const allUsersEndpoint = `/users?limit=100`;
        console.log(`[LOGIN] Fetching all users from: ${allUsersEndpoint}`);
        
        const allUsersResponse = await fetch(`${baseUrl}${allUsersEndpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'DOLAPIKEY': DOLIBARR_API_KEY,
          },
        });
        
        if (!allUsersResponse.ok) {
          const errText = await allUsersResponse.text();
          console.error(`[LOGIN] Failed to fetch users: ${allUsersResponse.status}`, errText);
          return new Response(
            JSON.stringify({ error: `Erreur serveur: ${allUsersResponse.status}` }),
            { status: allUsersResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let allUsers = [];
        try {
          allUsers = await allUsersResponse.json();
        } catch { allUsers = []; }
        
        console.log(`[LOGIN] Found ${Array.isArray(allUsers) ? allUsers.length : 0} total users in Dolibarr`);
        
        // Log all available users for debugging
        if (Array.isArray(allUsers)) {
          allUsers.forEach((u: any) => {
            console.log(`[LOGIN] User available: login="${u.login}", email="${u.email}", id=${u.id}, statut=${u.statut}`);
          });
        }
        
        // Find matching user by login OR email (case-insensitive)
        let matchedUser = null;
        if (Array.isArray(allUsers)) {
          matchedUser = allUsers.find((u: any) => {
            const userLogin = (u.login || '').toLowerCase();
            const userEmail = (u.email || '').toLowerCase();
            return userLogin === loginValue || userEmail === loginValue;
          });
        }
        
        if (matchedUser) {
          console.log(`[LOGIN] SUCCESS - Found user: id=${matchedUser.id}, login="${matchedUser.login}", name="${matchedUser.firstname} ${matchedUser.lastname}"`);
          return new Response(
            JSON.stringify([matchedUser]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log(`[LOGIN] FAILED - No user found matching "${loginValue}"`);
          return new Response(
            JSON.stringify([]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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

      // Interventions
      case 'get-interventions': {
        // Build query with optional filters - increased limit to 1000
        let query = '?sortfield=t.datec&sortorder=DESC&limit=1000';
        
        // Filter by status if provided (0=draft, 1=validated, 2=done, 3=billed)
        if (params?.status !== undefined) {
          query += `&sqlfilters=(t.fk_statut:=:${params.status})`;
        }
        
        // Filter by user if provided
        if (params?.userId) {
          // Note: Dolibarr uses fk_user_author or fk_user_assign depending on version
          query += params.status !== undefined 
            ? `and(t.fk_user_author:=:${params.userId})`
            : `&sqlfilters=(t.fk_user_author:=:${params.userId})`;
        }
        
        endpoint = '/interventions' + query;
        console.log('Fetching interventions with endpoint:', endpoint);
        
        // Fetch interventions
        const intResponse = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'DOLAPIKEY': DOLIBARR_API_KEY,
          },
        });
        
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
        if (interventions.length > 0) {
          // Log intervention structure to see extrafields
          const sample = interventions[0];
          console.log('Sample intervention data:', JSON.stringify(sample).substring(0, 500));
          console.log('Sample intervention extrafields:', JSON.stringify(sample.array_options || sample.extrafields || {}).substring(0, 500));
        }
        
        // Fetch all users once to enrich with assignedTo info
        let usersMap = new Map();
        try {
          const usersResponse = await fetch(`${baseUrl}/users?limit=100`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'DOLAPIKEY': DOLIBARR_API_KEY,
            },
          });
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            console.log(`Found ${Array.isArray(usersData) ? usersData.length : 0} users`);
            if (Array.isArray(usersData)) {
              usersData.forEach((u: any) => {
                usersMap.set(String(u.id), {
                  id: parseInt(u.id),
                  name: u.lastname || u.login || '',
                  firstName: u.firstname || '',
                });
              });
            }
          }
        } catch (e) {
          console.error('Could not fetch users for enrichment:', e);
        }
        
        // Fetch all thirdparties (clients) with extrafields
        let clientsMap = new Map();
        try {
          // Fetch thirdparties with all available data including extrafields
          const clientsResponse = await fetch(`${baseUrl}/thirdparties?limit=1000`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'DOLAPIKEY': DOLIBARR_API_KEY,
            },
          });
          if (clientsResponse.ok) {
            const clientsData = await clientsResponse.json();
            console.log(`Found ${Array.isArray(clientsData) ? clientsData.length : 0} thirdparties`);
            if (Array.isArray(clientsData)) {
              // Log sample client to see extrafields structure
              if (clientsData.length > 0) {
                console.log('Sample client extrafields:', JSON.stringify(clientsData[0].array_options || clientsData[0].extrafields || {}).substring(0, 500));
              }
              clientsData.forEach((c: any) => {
                // Extract extrafields - Dolibarr stores them in array_options with 'options_' prefix
                const extrafields = c.array_options || c.extrafields || {};
                
                clientsMap.set(String(c.id), {
                  id: parseInt(c.id),
                  name: c.name || c.nom || '',
                  address: c.address || '',
                  zip: c.zip || '',
                  town: c.town || '',
                  phone: c.phone || '',
                  email: c.email || '',
                  // Include common extrafields - adjust names based on your Dolibarr config
                  extrafields: extrafields,
                  // Common extrafield examples
                  ref_client: c.ref_client || c.code_client || extrafields.options_ref_client || '',
                  contact_name: extrafields.options_contact_name || extrafields.options_contact || c.fk_prospectlevel || '',
                  intercom: extrafields.options_intercom || extrafields.options_code_intercom || '',
                  access_code: extrafields.options_code_acces || extrafields.options_access_code || '',
                  notes: c.note_public || c.note_private || '',
                });
              });
            }
          }
        } catch (e) {
          console.error('Could not fetch thirdparties for enrichment:', e);
        }
        
        // Enrich each intervention with assignedTo, client info and intervention extrafields
        const enrichedInterventions = interventions.map((int: any) => {
          // fk_user_author is the author, fk_user_valid is the validator
          const authorId = String(int.fk_user_author || int.user_author_id || '');
          const assignedUser = usersMap.get(authorId);
          
          // Get client info from socid
          const clientId = String(int.socid || int.fk_soc || '');
          const clientInfo = clientsMap.get(clientId);
          
          // Extract intervention extrafields - Dolibarr stores them in array_options with 'options_' prefix
          const intExtrafields = int.array_options || int.extrafields || {};
          
          // Get specific intervention extrafields based on actual Dolibarr field names:
          // options_bongerance = Bon de gérance
          // options_propimm = Propriétaire immobilier / Adresse
          // options_employe = Contact/Employé assigné (concierge)
          // options_cle = Clé
          // options_code = Code d'accès
          // options_noimm = N° immeuble
          // options_adresse = Adresse complète
          // options_ncompt = N° compteur
          const extraBon = intExtrafields.options_bongerance || intExtrafields.options_bon || '';
          const extraAdresse = intExtrafields.options_propimm || intExtrafields.options_adresse || '';
          const extraContact = intExtrafields.options_employe || intExtrafields.options_contact || '';
          const extraCle = intExtrafields.options_cle || '';
          const extraCode = intExtrafields.options_code || '';
          const extraNoImm = intExtrafields.options_noimm || '';
          const extraAdresseComplete = intExtrafields.options_adresse || '';
          const extraNCompt = intExtrafields.options_ncompt || '';
          
          // Log enriched extrafields for first few interventions
          if (interventions.indexOf(int) < 3) {
            console.log(`[Intervention ${int.ref}] Extrafields mapped:`, {
              bon: extraBon,
              adresse: extraAdresse ? extraAdresse.substring(0, 50) : null,
              contact: extraContact,
              cle: extraCle,
              code: extraCode,
              noImm: extraNoImm,
              adresseComplete: extraAdresseComplete ? extraAdresseComplete.substring(0, 50) : null,
              nCompt: extraNCompt,
            });
          }
          
          return {
            ...int,
            assignedTo: assignedUser || null,
            thirdparty_name: clientInfo?.name || int.thirdparty_name || '',
            client_address: clientInfo?.address || '',
            client_zip: clientInfo?.zip || '',
            client_town: clientInfo?.town || '',
            client_phone: clientInfo?.phone || '',
            client_email: clientInfo?.email || '',
            // Add client extrafields
            client_ref: clientInfo?.ref_client || '',
            client_contact_name: clientInfo?.contact_name || '',
            client_intercom: clientInfo?.intercom || '',
            client_access_code: clientInfo?.access_code || '',
            client_notes: clientInfo?.notes || '',
            client_extrafields: clientInfo?.extrafields || {},
            // Add intervention extrafields with correct field names
            extra_bon: extraBon,
            extra_adresse: extraAdresse,
            extra_contact: extraContact,
            extra_cle: extraCle,
            extra_code: extraCode,
            extra_no_imm: extraNoImm,
            extra_adresse_complete: extraAdresseComplete,
            extra_n_compt: extraNCompt,
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
        
        // Fetch intervention details
        const intResponse = await fetch(`${baseUrl}/interventions/${intId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'DOLAPIKEY': DOLIBARR_API_KEY,
          },
        });
        
        if (!intResponse.ok) {
          const errText = await intResponse.text();
          console.error('Error fetching intervention:', errText);
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${intResponse.status}` }),
            { status: intResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const intData = await intResponse.json();
        console.log('Intervention raw data:', JSON.stringify(intData).substring(0, 1000));
        
        // Fetch thirdparty (client) details
        let clientInfo = null;
        if (intData.socid) {
          try {
            const clientResponse = await fetch(`${baseUrl}/thirdparties/${intData.socid}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'DOLAPIKEY': DOLIBARR_API_KEY,
              },
            });
            if (clientResponse.ok) {
              clientInfo = await clientResponse.json();
              console.log('Client info:', clientInfo?.name);
            }
          } catch (e) {
            console.error('Could not fetch client:', e);
          }
        }
        
        // Fetch user (assigned) details
        let assignedUser = null;
        const authorId = intData.fk_user_author || intData.user_author_id;
        if (authorId) {
          try {
            const userResponse = await fetch(`${baseUrl}/users/${authorId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'DOLAPIKEY': DOLIBARR_API_KEY,
              },
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              assignedUser = {
                id: parseInt(userData.id),
                name: userData.lastname || userData.login || '',
                firstName: userData.firstname || '',
              };
              console.log('Assigned user:', assignedUser);
            }
          } catch (e) {
            console.error('Could not fetch user:', e);
          }
        }
        
        // Fetch linked proposal (devis) if exists
        let linkedProposalRef = null;
        if (intData.fk_projet) {
          try {
            // Try to find proposals linked to this project
            const propResponse = await fetch(`${baseUrl}/proposals?sqlfilters=(t.fk_projet:=:${intData.fk_projet})&limit=5`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'DOLAPIKEY': DOLIBARR_API_KEY,
              },
            });
            if (propResponse.ok) {
              const proposals = await propResponse.json();
              if (Array.isArray(proposals) && proposals.length > 0) {
                linkedProposalRef = proposals[0].ref;
                console.log('Linked proposal:', linkedProposalRef);
              }
            }
          } catch (e) {
            console.error('Could not fetch proposals:', e);
          }
        }
        
        // Fetch documents attached to intervention
        let documents: any[] = [];
        try {
          const docsResponse = await fetch(`${baseUrl}/documents?modulepart=ficheinter&id=${intId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'DOLAPIKEY': DOLIBARR_API_KEY,
            },
          });
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            if (Array.isArray(docsData)) {
              documents = docsData.map((doc: any) => ({
                name: doc.name || doc.filename,
                url: doc.fullname || doc.url || '',
                type: doc.type || 'file',
              }));
              console.log('Documents found:', documents.length);
            }
          }
        } catch (e) {
          console.error('Could not fetch documents:', e);
        }
        
        // Enrich lines with product details (for materials)
        const lines = intData.lines || [];
        const enrichedLines = [];
        for (const line of lines) {
          let productInfo = null;
          if (line.fk_product) {
            try {
              const prodResponse = await fetch(`${baseUrl}/products/${line.fk_product}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'DOLAPIKEY': DOLIBARR_API_KEY,
                },
              });
              if (prodResponse.ok) {
                productInfo = await prodResponse.json();
              }
            } catch (e) {
              // Ignore product fetch errors
            }
          }
          
          enrichedLines.push({
            ...line,
            product_ref: productInfo?.ref || line.product_ref || '',
            product_label: productInfo?.label || line.desc || '',
            product_price: productInfo?.price || line.subprice || 0,
          });
        }
        
        // Extract intervention extrafields for single intervention
        const singleIntExtrafields = intData.array_options || intData.extrafields || {};
        const singleExtraBon = singleIntExtrafields.options_bongerance || singleIntExtrafields.options_bon || '';
        const singleExtraAdresse = singleIntExtrafields.options_propimm || singleIntExtrafields.options_adresse || '';
        const singleExtraContact = singleIntExtrafields.options_employe || singleIntExtrafields.options_contact || '';
        const singleExtraCle = singleIntExtrafields.options_cle || '';
        const singleExtraCode = singleIntExtrafields.options_code || '';
        const singleExtraNoImm = singleIntExtrafields.options_noimm || '';
        const singleExtraAdresseComplete = singleIntExtrafields.options_adresse || '';
        const singleExtraNCompt = singleIntExtrafields.options_ncompt || '';
        
        // Build enriched response
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
          // Intervention extrafields
          extra_bon: singleExtraBon,
          extra_adresse: singleExtraAdresse,
          extra_contact: singleExtraContact,
          extra_cle: singleExtraCle,
          extra_code: singleExtraCode,
          extra_no_imm: singleExtraNoImm,
          extra_adresse_complete: singleExtraAdresseComplete,
          extra_n_compt: singleExtraNCompt,
          intervention_extrafields: singleIntExtrafields,
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
      
      // Stock (products with stock info)
      case 'get-stock': {
        console.log('Fetching stock from Dolibarr...');
        
        // Fetch all products with stock info
        const stockResponse = await fetch(`${baseUrl}/products?limit=500&includestockdata=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'DOLAPIKEY': DOLIBARR_API_KEY,
          },
        });
        
        if (!stockResponse.ok) {
          const errText = await stockResponse.text();
          console.error('Error fetching stock:', errText);
          return new Response(
            JSON.stringify({ error: `Erreur Dolibarr ${stockResponse.status}`, details: errText }),
            { status: stockResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const products = await stockResponse.json();
        console.log(`Found ${Array.isArray(products) ? products.length : 0} products`);
        
        // Map products to stock items format
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
        
        console.log(`Returning ${stockItems.length} stock items`);
        
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

      // Tasks (project tasks)
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

    const dolibarrResponse = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'DOLAPIKEY': DOLIBARR_API_KEY,
      },
      body,
    });

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
