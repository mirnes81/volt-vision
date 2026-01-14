import * as React from 'react';
import { Worker } from '@/types/intervention';
import { mockWorker, delay } from '@/lib/mockData';

interface AuthContextType {
  worker: Worker | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

async function performLogin(token: string): Promise<{ token: string; worker: Worker }> {
  // Demo mode
  if (token === 'demo') {
    await delay(500);
    localStorage.setItem('mv3_token', 'demo_token');
    localStorage.setItem('mv3_worker', JSON.stringify(mockWorker));
    return { token: 'demo_token', worker: mockWorker };
  }
  
  // Real mode - worker data is already set by dolibarrLogin
  // Just retrieve what was already stored
  const savedWorker = getSavedWorker();
  if (savedWorker) {
    return { token, worker: savedWorker };
  }
  
  // Fallback if no worker data (shouldn't happen)
  const worker: Worker = {
    id: 1,
    login: 'user',
    name: 'Utilisateur',
    firstName: '',
    email: '',
    phone: '',
  };
  
  localStorage.setItem('mv3_worker', JSON.stringify(worker));
  return { token, worker };
}

function performLogout(): void {
  localStorage.removeItem('mv3_token');
  localStorage.removeItem('mv3_worker');
}

function checkAuthenticated(): boolean {
  return !!localStorage.getItem('mv3_token');
}

function getSavedWorker(): Worker | null {
  const data = localStorage.getItem('mv3_worker');
  return data ? JSON.parse(data) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const authenticated = checkAuthenticated();
    if (authenticated) {
      const savedWorker = getSavedWorker();
      setWorker(savedWorker);
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, []);

  const login = React.useCallback(async (token: string) => {
    const result = await performLogin(token);
    setWorker(result.worker);
    setIsLoggedIn(true);
  }, []);

  const logout = React.useCallback(() => {
    performLogout();
    setWorker(null);
    setIsLoggedIn(false);
  }, []);

  const value = React.useMemo(() => ({ 
    worker, 
    isLoggedIn, 
    isLoading, 
    login, 
    logout 
  }), [worker, isLoggedIn, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
