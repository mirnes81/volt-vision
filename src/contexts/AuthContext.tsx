import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Worker } from '@/types/intervention';
import { login as apiLogin, logout as apiLogout, isAuthenticated, getCurrentWorker } from '@/lib/api';

interface AuthContextType {
  worker: Worker | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check existing auth on mount
    const authenticated = isAuthenticated();
    if (authenticated) {
      const savedWorker = getCurrentWorker();
      setWorker(savedWorker);
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setWorker(result.worker);
    setIsLoggedIn(true);
  };

  const logout = () => {
    apiLogout();
    setWorker(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ worker, isLoggedIn, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
