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

      // Login - find user by login OR email (authentication is handled by DOLAPIKEY)
      case 'login': {
        // Dolibarr doesn't have a standard login endpoint
        // We search for the user by login first, then by email if not found
        const loginValue = (params.login || '').replace(/'/g, "''").trim();
        console.log(`Login attempt for: ${loginValue}`);
        
        // Try to find user by login first
        let userEndpoint = `/users?sqlfilters=(t.login:=:'${loginValue}')&limit=1`;
        let userResponse = await fetch(`${baseUrl}${userEndpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'DOLAPIKEY': DOLIBARR_API_KEY,
          },
        });
        
        let users = [];
        if (userResponse.ok) {
          try {
            users = await userResponse.json();
          } catch { users = []; }
        }
        
        // If not found by login, try by email
        if (!Array.isArray(users) || users.length === 0) {
          console.log('User not found by login, trying email...');
          userEndpoint = `/users?sqlfilters=(t.email:=:'${loginValue}')&limit=1`;
          userResponse = await fetch(`${baseUrl}${userEndpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'DOLAPIKEY': DOLIBARR_API_KEY,
            },
          });
          
          if (userResponse.ok) {
            try {
              users = await userResponse.json();
            } catch { users = []; }
          }
        }
        
        console.log(`Found ${Array.isArray(users) ? users.length : 0} user(s)`);
        
        return new Response(
          JSON.stringify(Array.isArray(users) ? users : []),
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

      // Interventions
      case 'get-interventions': {
        // Build query with optional filters
        let query = '?sortfield=t.datec&sortorder=DESC&limit=200';
        
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
        break;
      }
      case 'get-intervention':
        endpoint = `/interventions/${params.id}`;
        break;
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
