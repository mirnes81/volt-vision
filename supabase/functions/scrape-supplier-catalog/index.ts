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
    photoPattern: 'https://online-katalog.feller.ch/pict/FET/FET_{reference}.PNG',
  },
  hager: {
    name: 'Hager',
    baseUrl: 'https://hager.com/ch-fr',
    photoPattern: 'https://media.hager.com/pm/{reference}.jpg',
  },
  em: {
    name: 'Électromatériel',
    baseUrl: 'https://www.em-schweiz.ch',
    photoPattern: null, // Will need to scrape from page
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

// Parse Feller catalog HTML
function parseFellerCatalog(html: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];
  
  // Match product entries in the HTML
  // Pattern: <a href="/fr/[category]/[subcategory]/[reference]"...>
  const productPattern = /<a[^>]*href="\/fr\/([^\/]+)\/([^\/]+)\/([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  
  let match;
  const seen = new Set<string>();
  
  while ((match = productPattern.exec(html)) !== null) {
    const [, category, subcategory, reference, name] = match;
    
    if (reference && !seen.has(reference) && name?.trim()) {
      seen.add(reference);
      
      // Generate photo URL from reference
      const photoUrl = SUPPLIERS.feller.photoPattern.replace('{reference}', reference.replace(/\./g, '').toUpperCase());
      
      products.push({
        supplier: 'feller',
        reference: reference.trim(),
        name: name.trim(),
        category: decodeURIComponent(category).replace(/-/g, ' '),
        subcategory: decodeURIComponent(subcategory).replace(/-/g, ' '),
        currency: 'CHF',
        photo_url: photoUrl,
        product_url: `${SUPPLIERS.feller.baseUrl}/fr/${category}/${subcategory}/${reference}`,
      });
    }
  }
  
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
  
  // Fallback: parse HTML structure
  const productCardPattern = /<article[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  
  while ((match = productCardPattern.exec(html)) !== null) {
    const cardHtml = match[1];
    
    const refMatch = /data-ref="([^"]+)"/i.exec(cardHtml);
    const nameMatch = /<h[23][^>]*>([^<]+)<\/h[23]>/i.exec(cardHtml);
    const priceMatch = /CHF\s*([\d.,]+)/i.exec(cardHtml);
    const imgMatch = /<img[^>]*src="([^"]+)"[^>]*>/i.exec(cardHtml);
    
    if (refMatch && nameMatch) {
      products.push({
        supplier: 'hager',
        reference: refMatch[1],
        name: nameMatch[1].trim(),
        price: priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : undefined,
        currency: 'CHF',
        photo_url: imgMatch?.[1],
      });
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
  
  // Parse product cards from HTML
  // Pattern for EM product listings
  const productCardPattern = /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  
  while ((match = productCardPattern.exec(html)) !== null) {
    const cardHtml = match[1];
    
    // Extract reference (article number)
    const refMatch = /(?:Art\.?\s*(?:Nr\.?|no\.?|n°)?|Réf\.?|SKU)[\s:]*([A-Z0-9\-\.]+)/i.exec(cardHtml);
    // Extract name from heading or title
    const nameMatch = /<(?:h[1-6]|span|a)[^>]*class="[^"]*(?:title|name|product-name)[^"]*"[^>]*>([^<]+)/i.exec(cardHtml);
    // Extract price
    const priceMatch = /(?:CHF|Fr\.?)\s*([\d'.,]+)/i.exec(cardHtml);
    // Extract image
    const imgMatch = /<img[^>]*src="([^"]+)"[^>]*>/i.exec(cardHtml);
    // Extract product URL
    const urlMatch = /<a[^>]*href="([^"]*\/[a-z0-9\-]+)"[^>]*>/i.exec(cardHtml);
    
    const reference = refMatch?.[1]?.trim();
    const name = nameMatch?.[1]?.trim();
    
    if (reference && name && !seen.has(reference)) {
      seen.add(reference);
      products.push({
        supplier: 'em',
        reference,
        name,
        price: priceMatch ? parseFloat(priceMatch[1].replace(/[',]/g, '').replace(',', '.')) : undefined,
        currency: 'CHF',
        photo_url: imgMatch?.[1],
        product_url: urlMatch?.[1] ? `${SUPPLIERS.em.baseUrl}${urlMatch[1]}` : undefined,
      });
    }
  }
  
  // Alternative pattern for list-style layouts
  const listItemPattern = /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  
  while ((match = listItemPattern.exec(html)) !== null) {
    const itemHtml = match[1];
    
    const refMatch = /(?:Art|Réf|SKU)[\s.:]*([A-Z0-9\-\.]+)/i.exec(itemHtml);
    const nameMatch = /<(?:a|span|strong)[^>]*>([^<]{5,80})<\/(?:a|span|strong)>/i.exec(itemHtml);
    const priceMatch = /(?:CHF|Fr)\s*([\d'.,]+)/i.exec(itemHtml);
    const imgMatch = /(?:src|data-src)="([^"]+\.(?:jpg|png|webp))"/i.exec(itemHtml);
    
    const reference = refMatch?.[1]?.trim();
    const name = nameMatch?.[1]?.trim();
    
    if (reference && name && !seen.has(reference)) {
      seen.add(reference);
      products.push({
        supplier: 'em',
        reference,
        name,
        price: priceMatch ? parseFloat(priceMatch[1].replace(/[',]/g, '')) : undefined,
        currency: 'CHF',
        photo_url: imgMatch?.[1],
      });
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
        },
      });
      
      if (response.ok) {
        return await response.text();
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
        // Feller has category pages we can scrape
        const categories = [
          '/fr/interrupteurs-et-prises',
          '/fr/domotique',
          '/fr/led-et-eclairage',
        ];
        
        for (const category of categories) {
          const html = await fetchWithRetry(`${supplierConfig.baseUrl}${category}`);
          if (html) {
            const categoryProducts = parseFellerCatalog(html);
            products.push(...categoryProducts);
          }
        }
      } else if (supplier === 'hager') {
        // Hager catalog
        const html = await fetchWithRetry(`${supplierConfig.baseUrl}/catalogue`);
        if (html) {
          products = parseHagerCatalog(html);
        }
      } else if (supplier === 'em') {
        // EM (Électromatériel) catalog
        const categories = [
          '/fr/catalogue/appareillage',
          '/fr/catalogue/eclairage',
          '/fr/catalogue/cables',
          '/fr/catalogue/tableaux',
        ];
        
        for (const category of categories) {
          const html = await fetchWithRetry(`${supplierConfig.baseUrl}${category}`);
          if (html) {
            const categoryProducts = parseEMCatalog(html);
            products.push(...categoryProducts);
          }
        }
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
      
      console.log(`Found ${products.length} products for ${supplier}`);
      
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
