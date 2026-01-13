import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2, Settings, Key, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getDolibarrConfig, isDolibarrConfigured } from '@/lib/dolibarrConfig';

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dolibarrUrl, setDolibarrUrl] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const config = getDolibarrConfig();
    if (config.baseUrl) {
      setDolibarrUrl(config.baseUrl);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      toast.error('Veuillez entrer votre clé API Dolibarr');
      return;
    }

    if (!isDolibarrConfigured()) {
      toast.error('Configurez d\'abord l\'URL Dolibarr dans les paramètres');
      return;
    }

    setIsLoading(true);
    try {
      await login(apiKey);
      toast.success('Connexion réussie');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de connexion';
      toast.error(message);
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isConfigured = isDolibarrConfigured();

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

      {/* Status Dolibarr */}
      <div className="w-full max-w-sm mb-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {isConfigured ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Dolibarr configuré</p>
              <p className="text-xs text-green-600 dark:text-green-400 truncate">{dolibarrUrl}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Dolibarr non configuré</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Configurez l'URL d'abord</p>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <label className="text-sm font-medium">Clé API Dolibarr (DOLAPIKEY)</label>
          </div>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Collez votre clé API ici"
              className="h-14 text-base rounded-xl pr-12 font-mono"
              autoComplete="off"
              disabled={!isConfigured}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Trouvez votre clé dans Dolibarr : Utilisateurs → Votre profil → Onglet API
          </p>
        </div>

        <Button
          type="submit"
          variant="worker"
          size="full"
          disabled={isLoading || !isConfigured}
          className="mt-6"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Se connecter'
          )}
        </Button>

        <Link to="/settings" className="block">
          <Button
            type="button"
            variant="outline"
            size="full"
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            {isConfigured ? 'Modifier configuration' : 'Configurer Dolibarr'}
          </Button>
        </Link>
      </form>

      {/* Demo mode */}
      <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <p className="text-xs text-muted-foreground">
          Mode démo : tapez <code className="bg-muted px-1 rounded font-mono">demo</code> comme clé API
        </p>
      </div>

      {/* Version */}
      <p className="absolute bottom-4 text-xs text-muted-foreground/50">
        SmartElectric Suite v1.0.0
      </p>
    </div>
  );
}
