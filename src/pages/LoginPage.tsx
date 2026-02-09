import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, RefreshCw, User, Lock, Eye, EyeOff, Wrench, AlertCircle, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logoEnes from '@/assets/logo-enes.png';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { testDolibarrConnection, dolibarrLogin } from '@/lib/dolibarrApi';

export default function LoginPage() {
  const [login, setLogin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isTestingConnection, setIsTestingConnection] = React.useState(true);
  const [connectionStatus, setConnectionStatus] = React.useState<'testing' | 'success' | 'error'>('testing');
  const [dolibarrVersion, setDolibarrVersion] = React.useState<string>('');
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
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
      console.error('[LoginPage] Connection error:', error);
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    
    if (!login.trim()) {
      setLoginError('Veuillez entrer votre identifiant');
      return;
    }
    
    if (!password.trim()) {
      setLoginError('Veuillez entrer votre mot de passe');
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
      setLoginError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <img 
            src={logoEnes} 
            alt="ENES Électricité" 
            className="h-14 max-w-[200px] object-contain mb-8 drop-shadow-2xl"
          />
          <h1 className="text-4xl xl:text-5xl font-bold mb-4 leading-tight">
            Suite Électricien
            <br />
            <span className="text-white/90">Professionnelle</span>
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-md">
            Gérez vos interventions, suivez vos heures et restez connecté avec votre équipe, où que vous soyez.
          </p>
          
          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Synchronisation temps réel</p>
                <p className="text-sm text-white/70">Connecté à Dolibarr</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Mode hors-ligne</p>
                <p className="text-sm text-white/70">Travaillez sans connexion</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-background relative">
        {/* Mobile Logo */}
        <div className="lg:hidden text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary shadow-lg mb-4">
            <img 
              src={logoEnes} 
              alt="ENES" 
              className="h-10 max-w-[120px] object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ENES Électricité</h1>
          <p className="text-sm text-muted-foreground mt-1">Suite Électricien Suisse</p>
        </div>

        {/* Desktop Title */}
        <div className="hidden lg:block text-center mb-8 animate-slide-up">
          <h2 className="text-3xl font-bold text-foreground mb-2">Connexion</h2>
          <p className="text-muted-foreground">Accédez à votre espace technicien</p>
        </div>

        {/* Connection Status */}
        {/* Connection status hidden from UI but still checked internally */}

        {/* Login Error Alert */}
        {loginError && (
          <div className="w-full max-w-sm mb-6 animate-shake">
            <div className="flex items-start gap-3 p-4 rounded-2xl border-2 bg-destructive/5 border-destructive/30">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-semibold text-destructive">
                  Échec de connexion
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loginError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-2">
            <Label htmlFor="login" className="text-sm font-semibold text-foreground">
              Identifiant
            </Label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center transition-colors group-focus-within:bg-primary/10">
                <User className="w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              </div>
              <Input
                id="login"
                type="text"
                placeholder="votre.identifiant"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="pl-16 h-14 text-base rounded-2xl border-2 focus:border-primary transition-all"
                autoComplete="username"
                autoCapitalize="none"
                disabled={connectionStatus !== 'success'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-foreground">
              Mot de passe
            </Label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center transition-colors group-focus-within:bg-primary/10">
                <Lock className="w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-16 pr-14 h-14 text-base rounded-2xl border-2 focus:border-primary transition-all"
                autoComplete="current-password"
                disabled={connectionStatus !== 'success'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || connectionStatus !== 'success'}
            className="w-full h-14 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 transition-all shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Se connecter
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground/50">
            ENES Électricité v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
