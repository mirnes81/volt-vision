import * as React from 'react';
import { Worker } from '@/types/intervention';
import { login as apiLogin, logout as apiLogout, isAuthenticated, getCurrentWorker } from '@/lib/api';

interface AuthContextType {
  worker: Worker | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Check existing auth on mount
    const authenticated = isAuthenticated();
    if (authenticated) {
      const savedWorker = getCurrentWorker();
      setWorker(savedWorker);
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setWorker(result.worker);
    setIsLoggedIn(true);
  }, []);

  const logout = React.useCallback(() => {
    apiLogout();
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
