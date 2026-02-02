import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const SUPPLIERS = {
  feller: {
    name: 'Feller',
    baseUrl: 'https://online-katalog.feller.ch',
    catalogUrl: 'https://online-katalog.feller.ch/kat.php',
  },
  hager: {
    name: 'Hager',
    baseUrl: 'https://hager.com/ch-fr',
    catalogUrl: 'https://hager.com/ch-fr/catalogue',
  },
  em: {
    name: 'Électromatériel',
    baseUrl: 'https://www.em-schweiz.ch',
    catalogUrl: 'https://www.em-schweiz.ch/fr/catalogue',
  }
};

interface SupplierProduct {
  supplier: string;
  reference: string;
  name: string;
  description?: string;
  category?: string;
  currency: string;
  photo_url?: string;
  product_url?: string;
}

// Parse Feller catalog HTML
function parseFellerCatalog(html: string, searchTerm?: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];
  const seen = new Set<string>();
  
  const imgPattern = /pict\/FET\/FET_([A-Z0-9][A-Z0-9\-\.]+)\.PNG/gi;
  
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const reference = match[1];
    
    if (reference && !seen.has(reference) && reference.length > 3) {
      seen.add(reference);
      
      const descRegex = new RegExp(`${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<br>\\s*<span class="cx-ProduktKurztextBox"[^>]*title="([^"]*)"`, 'i');
      const descMatch = descRegex.exec(html);
      
      const description = descMatch?.[1]?.trim();
      
      products.push({
        supplier: 'feller',
        reference: reference.trim(),
        name: description || reference.trim(),
        description,
        category: searchTerm,
        currency: 'CHF',
        photo_url: `https://online-katalog.feller.ch/pict/FET/FET_${reference}.PNG`,
        product_url: `https://online-katalog.feller.ch/kat_details.php?fnr=${encodeURIComponent(reference)}&sc_lang=fr`,
      });
    }
  }
  
  return products;
}

// Fetch with minimal retry
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (response.ok) return await response.text();
  } catch (e) {
    console.error('Fetch error:', e);
  }
  return null;
}

// Save products to database immediately
async function saveProducts(supabase: SupabaseClient, products: SupplierProduct[]): Promise<number> {
  if (products.length === 0) return 0;
  
  const batch = products.map(p => ({
    tenant_id: TENANT_ID,
    supplier: p.supplier,
    reference: p.reference,
    name: p.name,
    description: p.description,
    category: p.category,
    currency: p.currency,
    photo_url: p.photo_url,
    product_url: p.product_url,
    specifications: {},
    last_sync_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from('supplier_products')
    .upsert(batch, { onConflict: 'tenant_id,supplier,reference' });
  
  if (error) {
    console.error('Upsert error:', error);
    return 0;
  }
  return products.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier, action = 'sync' } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    if (action === 'list-suppliers') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          suppliers: Object.entries(SUPPLIERS).map(([id, config]) => ({
            id, name: config.name, baseUrl: config.baseUrl,
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!supplier || !SUPPLIERS[supplier as keyof typeof SUPPLIERS]) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid supplier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supplierConfig = SUPPLIERS[supplier as keyof typeof SUPPLIERS];
    
    // Create sync log
    const { data: syncLog } = await supabase
      .from('supplier_sync_logs')
      .insert({ tenant_id: TENANT_ID, supplier, status: 'running' })
      .select()
      .single();
    
    let totalProducts = 0;
    let errorMessage: string | null = null;
    
    try {
      if (supplier === 'feller') {
        // Optimized: fewer terms, save immediately after each batch
        const searchTerms = [
          'prise', 'interrupteur', 'variateur', 'poussoir',
          'edizio', 'zeptrion', 'knx', 'wiser',
          'USB', 'RJ45', 'detecteur', 'thermostat',
          'plaque', 'cadre',
        ];
        
        const seenRefs = new Set<string>();
        console.log(`Feller sync: ${searchTerms.length} terms`);
        
        for (const term of searchTerms) {
          const url = `${supplierConfig.catalogUrl}?suchfeld=${encodeURIComponent(term)}&seite=1&anzahl=100&sc_lang=fr`;
          const html = await fetchPage(url);
          
          if (html) {
            const pageProducts = parseFellerCatalog(html, term);
            const newProducts = pageProducts.filter(p => {
              if (seenRefs.has(p.reference)) return false;
              seenRefs.add(p.reference);
              return true;
            });
            
            if (newProducts.length > 0) {
              const saved = await saveProducts(supabase, newProducts);
              totalProducts += saved;
              console.log(`${term}: ${saved} saved`);
            }
            
            // If page was full, get page 2
            if (pageProducts.length >= 80) {
              const url2 = `${supplierConfig.catalogUrl}?suchfeld=${encodeURIComponent(term)}&seite=2&anzahl=100&sc_lang=fr`;
              const html2 = await fetchPage(url2);
              if (html2) {
                const page2Products = parseFellerCatalog(html2, term);
                const newPage2 = page2Products.filter(p => {
                  if (seenRefs.has(p.reference)) return false;
                  seenRefs.add(p.reference);
                  return true;
                });
                if (newPage2.length > 0) {
                  const saved2 = await saveProducts(supabase, newPage2);
                  totalProducts += saved2;
                  console.log(`${term} p2: ${saved2} saved`);
                }
              }
            }
          }
        }
        
        console.log(`Feller complete: ${totalProducts} total`);
        
      } else if (supplier === 'hager') {
        errorMessage = 'Hager nécessite un accès API via developer.hager.com';
      } else if (supplier === 'em') {
        errorMessage = 'EM nécessite un compte professionnel';
      }
      
      // Update sync log
      if (syncLog) {
        await supabase
          .from('supplier_sync_logs')
          .update({
            status: errorMessage ? 'failed' : 'completed',
            products_added: totalProducts,
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      
      return new Response(
        JSON.stringify({
          success: !errorMessage,
          supplier,
          productsFound: totalProducts,
          productsAdded: totalProducts,
          error: errorMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (scrapeError) {
      console.error('Error:', scrapeError);
      
      if (syncLog) {
        await supabase
          .from('supplier_sync_logs')
          .update({
            status: 'partial',
            products_added: totalProducts,
            error_message: 'Sync interrompu mais produits partiellement sauvegardés',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      
      throw scrapeError;
    }
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
