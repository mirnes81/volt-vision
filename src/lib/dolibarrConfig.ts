// Dolibarr Configuration Manager

export interface DolibarrConfig {
  baseUrl: string;
  isConfigured: boolean;
  lastTest?: string;
  testStatus?: 'success' | 'error';
}

const CONFIG_KEY = 'mv3_dolibarr_config';

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
    // Ensure URL ends without trailing slash and add API path
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    return `${baseUrl}/api/index.php/mv3electricien`;
  }
  // Return empty string to trigger mock mode
  return '';
}

export function isDolibarrConfigured(): boolean {
  return getDolibarrConfig().isConfigured;
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
