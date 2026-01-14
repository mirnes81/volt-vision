import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, RefreshCw, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { testDolibarrConnection, dolibarrLogin } from '@/lib/dolibarrApi';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [dolibarrVersion, setDolibarrVersion] = useState<string>('');
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  // Test connection on mount
  useEffect(() => {
    console.log('[LoginPage] useEffect triggered, testing connection...');
    testConnection();
  }, []);

  const testConnection = async () => {
    console.log('[LoginPage] Testing connection...');
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    
    try {
      const result = await testDolibarrConnection();
      console.log('[LoginPage] Connection result:', result);
      if (result.success) {
        setConnectionStatus('success');
        setDolibarrVersion(result.version || '');
        console.log('[LoginPage] Connection successful, version:', result.version);
      } else {
        setConnectionStatus('error');
        console.log('[LoginPage] Connection failed');
      }
    } catch (error) {
      console.error('[LoginPage] Connection error:', error);
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!login.trim()) {
      toast.error('Veuillez entrer votre identifiant');
      return;
    }
    
    if (!password.trim()) {
      toast.error('Veuillez entrer votre mot de passe');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await dolibarrLogin(login.trim(), password);
      await authLogin(result.token);
      toast.success(`Bienvenue, ${result.worker.name || login} !`);
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Identifiants incorrects';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await authLogin('demo');
      toast.success('Mode démonstration activé');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo */}
      <div className="mb-6 text-center animate-slide-up">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-glow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
          <Zap className="w-10 h-10 text-primary-foreground drop-shadow-lg" />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          SmartElectric
        </h1>
        <p className="text-sm text-muted-foreground">Suite Électricien Suisse</p>
      </div>

      {/* Connection Status */}
      <div className="w-full max-w-sm mb-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
          connectionStatus === 'testing' 
            ? 'bg-muted/50 border-muted-foreground/20'
            : connectionStatus === 'success' 
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        }`}>
          {connectionStatus === 'testing' ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : connectionStatus === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <RefreshCw className="w-4 h-4 text-red-600" />
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
                ? 'Connexion au serveur...'
                : connectionStatus === 'success' 
                ? `Dolibarr ${dolibarrVersion}`
                : 'Serveur non disponible'}
            </p>
          </div>
          {connectionStatus === 'error' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={testConnection}
              disabled={isTestingConnection}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${isTestingConnection ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="space-y-2">
          <Label htmlFor="login" className="text-sm font-medium">
            Identifiant Dolibarr
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="login"
              type="text"
              placeholder="votre.identifiant"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="pl-10 h-12 text-base"
              autoComplete="username"
              autoCapitalize="none"
              disabled={connectionStatus !== 'success'}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-12 h-12 text-base"
              autoComplete="current-password"
              disabled={connectionStatus !== 'success'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="worker"
          size="full"
          disabled={isLoading || connectionStatus !== 'success'}
          className="h-12 text-base font-semibold"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Se connecter'
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="full"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="h-12"
        >
          Mode Démonstration
        </Button>
      </form>

      {/* Version */}
      <p className="mt-8 text-xs text-muted-foreground/50">
        SmartElectric Suite v1.0.0
      </p>
    </div>
  );
}
