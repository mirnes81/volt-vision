// ENES Électricité Configuration Manager

export interface DolibarrConfig {
  baseUrl: string;
  apiKey: string;
  isConfigured: boolean;
  lastTest?: string;
  testStatus?: 'success' | 'error';
}

const CONFIG_KEY = 'smelec_config';

export function getDolibarrConfig(): DolibarrConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid stored config
    }
  }
  return {
    baseUrl: '',
    apiKey: '',
    isConfigured: false,
  };
}

export function saveDolibarrConfig(config: Partial<DolibarrConfig>): DolibarrConfig {
  const current = getDolibarrConfig();
  const updated: DolibarrConfig = {
    ...current,
    ...config,
    isConfigured: !!config.baseUrl && config.baseUrl.length > 0,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

export function getApiBaseUrl(): string {
  const config = getDolibarrConfig();
  if (config.isConfigured && config.baseUrl) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    return `${baseUrl}/api/index.php`;
  }
  return '';
}

export function isDolibarrConfigured(): boolean {
  // Check localStorage config OR assume server-side config via Edge Function secrets
  // The Edge Function has DOLIBARR_URL and DOLIBARR_API_KEY secrets configured
  const localConfig = getDolibarrConfig();
  if (localConfig.isConfigured) return true;
  
  // Server-side is always configured for ENES Électricité
  // This flag indicates we're using the Edge Function with Supabase secrets
  return true;
}

export async function testDolibarrConnection(url: string): Promise<{ success: boolean; message: string; version?: string }> {
  try {
    // Clean and format URL
    const baseUrl = url.replace(/\/+$/, '');
    const testUrl = `${baseUrl}/api/index.php/status`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Connexion réussie !',
        version: data.success?.dolibarr_version || 'Version inconnue',
      };
    } else if (response.status === 401) {
      // API requires auth but is accessible
      return {
        success: true,
        message: 'API Dolibarr accessible (authentification requise)',
      };
    } else {
      return {
        success: false,
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    // Try alternate endpoint
    try {
      const baseUrl = url.replace(/\/+$/, '');
      const altUrl = `${baseUrl}/api/index.php`;
      
      const response = await fetch(altUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok || response.status === 401 || response.status === 403) {
        return {
          success: true,
          message: 'API Dolibarr détectée',
        };
      }
    } catch {
      // Both attempts failed
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur de connexion - vérifiez l\'URL et CORS',
    };
  }
}
