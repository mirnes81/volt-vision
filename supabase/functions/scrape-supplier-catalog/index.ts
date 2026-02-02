import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Supplier configurations
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
  subcategory?: string;
  price?: number;
  currency: string;
  stock_status?: string;
  photo_url?: string;
  product_url?: string;
  specifications?: Record<string, unknown>;
}

// Parse Feller catalog HTML - simplified pattern matching
function parseFellerCatalog(html: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];
  const seen = new Set<string>();
  
  // Match product image URLs to extract references
  // Pattern: FET_REFERENCE.PNG
  const imgPattern = /pict\/FET\/FET_([A-Z0-9][A-Z0-9\-\.]+)\.PNG/gi;
  
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const reference = match[1];
    
    if (reference && !seen.has(reference) && reference.length > 3) {
      seen.add(reference);
      
      // Try to find the description for this reference
      const descRegex = new RegExp(`${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<br>\\s*<span class="cx-ProduktKurztextBox"[^>]*title="([^"]*)"`, 'i');
      const descMatch = descRegex.exec(html);
      
      // Try to find category
      const catRegex = new RegExp(`<b>([^<]+)<\\/b><br>\\s*${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const catMatch = catRegex.exec(html);
      
      const description = descMatch?.[1]?.trim();
      const category = catMatch?.[1]?.trim();
      
      products.push({
        supplier: 'feller',
        reference: reference.trim(),
        name: description || reference.trim(),
        description,
        category,
        currency: 'CHF',
        photo_url: `https://online-katalog.feller.ch/pict/FET/FET_${reference}.PNG`,
        product_url: `https://online-katalog.feller.ch/kat_details.php?fnr=${encodeURIComponent(reference)}&sc_lang=fr`,
      });
    }
  }
  
  console.log(`Parsed ${products.length} products from Feller HTML`);
  return products;
}

// Parse Hager catalog
function parseHagerCatalog(html: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];
  
  // Look for product data in JSON-LD or structured data
  const jsonLdPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  
  let match;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product' || (Array.isArray(data) && data[0]?.['@type'] === 'Product')) {
        const productData = Array.isArray(data) ? data[0] : data;
        products.push({
          supplier: 'hager',
          reference: productData.sku || productData.productID || '',
          name: productData.name || '',
          description: productData.description,
          price: productData.offers?.price ? parseFloat(productData.offers.price) : undefined,
          currency: productData.offers?.priceCurrency || 'CHF',
          photo_url: productData.image,
          product_url: productData.url,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }
  
  return products;
}

// Parse EM (Électromatériel) catalog
function parseEMCatalog(html: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];
  const seen = new Set<string>();
  
  // Try JSON-LD first
  const jsonLdPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product') {
        const ref = data.sku || data.mpn || '';
        if (ref && !seen.has(ref)) {
          seen.add(ref);
          products.push({
            supplier: 'em',
            reference: ref,
            name: data.name || '',
            description: data.description,
            price: data.offers?.price ? parseFloat(data.offers.price) : undefined,
            currency: data.offers?.priceCurrency || 'CHF',
            photo_url: data.image,
            product_url: data.url,
          });
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }
  
  return products;
}

// Fetch a catalog page with retry
async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      
      if (response.ok) {
        const text = await response.text();
        console.log(`Successfully fetched ${url}, got ${text.length} chars`);
        return text;
      }
      
      console.log(`Fetch attempt ${i + 1} failed with status ${response.status}`);
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} error:`, error);
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  
  return null;
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
            id,
            name: config.name,
            baseUrl: config.baseUrl,
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!supplier || !SUPPLIERS[supplier as keyof typeof SUPPLIERS]) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid supplier. Valid options: feller, hager, em' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supplierConfig = SUPPLIERS[supplier as keyof typeof SUPPLIERS];
    
    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('supplier_sync_logs')
      .insert({
        tenant_id: TENANT_ID,
        supplier,
        status: 'running',
      })
      .select()
      .single();
    
    if (syncLogError) {
      console.error('Error creating sync log:', syncLogError);
    }
    
    let products: SupplierProduct[] = [];
    let errorMessage: string | null = null;
    
    try {
      // Fetch catalog pages based on supplier
      if (supplier === 'feller') {
        // Feller online catalog - limit to one search term, one page to avoid timeout
        const searchTerms = ['prise', 'interrupteur'];
        
        for (const term of searchTerms) {
          const url = `${supplierConfig.catalogUrl}?suchfeld=${encodeURIComponent(term)}&seite=1&anzahl=50&sc_lang=fr`;
          console.log(`Fetching Feller catalog: ${url}`);
          
          const html = await fetchWithRetry(url);
          if (html) {
            const pageProducts = parseFellerCatalog(html);
            console.log(`Found ${pageProducts.length} products for term "${term}"`);
            products.push(...pageProducts);
          }
        }
      } else if (supplier === 'hager') {
        // Hager requires API access via developer.hager.com
        // For now, return info about how to access their API
        console.log('Hager requires developer API access - manual import needed');
        errorMessage = 'Hager nécessite un accès API via developer.hager.com. Utilisez l\'import CSV/Excel manuel.';
      } else if (supplier === 'em') {
        // EM (Elektro-Material) requires professional account
        // Catalog available as PDF only
        console.log('EM requires professional account - manual import needed');
        errorMessage = 'EM nécessite un compte professionnel. Téléchargez le catalogue PDF depuis elektro-material.ch et importez-le manuellement.';
      }
      
      // Remove duplicates
      const uniqueProducts = products.reduce((acc, product) => {
        const key = `${product.supplier}-${product.reference}`;
        if (!acc.has(key)) {
          acc.set(key, product);
        }
        return acc;
      }, new Map<string, SupplierProduct>());
      
      products = Array.from(uniqueProducts.values());
      
      console.log(`Found ${products.length} unique products for ${supplier}`);
      
      // Upsert products to database
      let productsAdded = 0;
      let productsUpdated = 0;
      
      for (const product of products) {
        const { error } = await supabase
          .from('supplier_products')
          .upsert({
            tenant_id: TENANT_ID,
            supplier: product.supplier,
            reference: product.reference,
            name: product.name,
            description: product.description,
            category: product.category,
            subcategory: product.subcategory,
            price: product.price,
            currency: product.currency,
            stock_status: product.stock_status,
            photo_url: product.photo_url,
            product_url: product.product_url,
            specifications: product.specifications || {},
            last_sync_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,supplier,reference',
          });
        
        if (!error) {
          productsAdded++;
        } else {
          console.error(`Error upserting product ${product.reference}:`, error);
        }
      }
      
      // Update sync log
      if (syncLog) {
        await supabase
          .from('supplier_sync_logs')
          .update({
            status: errorMessage ? 'failed' : 'completed',
            products_added: productsAdded,
            products_updated: productsUpdated,
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      
      return new Response(
        JSON.stringify({
          success: !errorMessage,
          supplier,
          productsFound: products.length,
          productsAdded,
          productsUpdated,
          error: errorMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (scrapeError) {
      console.error('Scraping error:', scrapeError);
      
      // Update sync log with error
      if (syncLog) {
        await supabase
          .from('supplier_sync_logs')
          .update({
            status: 'failed',
            error_message: scrapeError instanceof Error ? scrapeError.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      
      throw scrapeError;
    }
    
  } catch (error) {
    console.error('Error in scrape-supplier-catalog:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
