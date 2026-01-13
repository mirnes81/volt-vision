import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { testDolibarrConnection } from '@/lib/dolibarrApi';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [dolibarrVersion, setDolibarrVersion] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    
    try {
      const result = await testDolibarrConnection();
      if (result.success) {
        setConnectionStatus('success');
        setDolibarrVersion(result.version || '');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await login('authenticated');
      toast.success('Connexion réussie');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de connexion';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-secondary/30">
      {/* Logo */}
      <div className="mb-8 text-center animate-slide-up">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-glow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
          <Zap className="w-12 h-12 text-primary-foreground drop-shadow-lg" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          SmartElectric
        </h1>
        <p className="text-muted-foreground mt-1">Suite Électricien Suisse</p>
      </div>

      {/* Connection Status */}
      <div className="w-full max-w-sm mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          connectionStatus === 'testing' 
            ? 'bg-muted/50 border-muted-foreground/20'
            : connectionStatus === 'success' 
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        }`}>
          {connectionStatus === 'testing' ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : connectionStatus === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <RefreshCw className="w-5 h-5 text-red-600" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              connectionStatus === 'testing' 
                ? 'text-muted-foreground'
                : connectionStatus === 'success' 
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              {connectionStatus === 'testing' 
                ? 'Test de connexion...'
                : connectionStatus === 'success' 
                ? 'Dolibarr connecté'
                : 'Connexion échouée'}
            </p>
            {connectionStatus === 'success' && dolibarrVersion && (
              <p className="text-xs text-green-600 dark:text-green-400">{dolibarrVersion}</p>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400">Vérifiez la configuration</p>
            )}
          </div>
          {connectionStatus === 'error' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={testConnection}
              disabled={isTestingConnection}
            >
              <RefreshCw className={`w-4 h-4 ${isTestingConnection ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Login Button */}
      <div className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Button
          onClick={handleLogin}
          variant="worker"
          size="full"
          disabled={isLoading || connectionStatus !== 'success'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Accéder à l\'application'
          )}
        </Button>

        {connectionStatus === 'success' && (
          <p className="text-xs text-center text-muted-foreground">
            Connecté à Dolibarr via API sécurisée
          </p>
        )}

        {connectionStatus === 'error' && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Les secrets <code className="bg-muted px-1 rounded">DOLIBARR_URL</code> et{' '}
              <code className="bg-muted px-1 rounded">DOLIBARR_API_KEY</code> doivent être configurés.
            </p>
          </div>
        )}
      </div>

      {/* Version */}
      <p className="absolute bottom-4 text-xs text-muted-foreground/50">
        SmartElectric Suite v1.0.0
      </p>
    </div>
  );
}
