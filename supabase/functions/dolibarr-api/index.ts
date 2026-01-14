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
      case 'login':
        // Dolibarr doesn't have a standard login endpoint
        // We search for the user by login OR email to validate they exist
        const loginValue = params.login?.replace(/'/g, "''"); // Escape single quotes
        endpoint = `/users?sqlfilters=(t.login:=:'${loginValue}')or(t.email:=:'${loginValue}')&limit=1`;
        break;
      
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
      case 'get-interventions':
        endpoint = '/interventions?sortfield=t.datec&sortorder=DESC&limit=50';
        break;
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
