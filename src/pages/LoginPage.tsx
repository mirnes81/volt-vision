import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2, Settings, Key, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isDolibarrConfigured } from '@/lib/dolibarrConfig';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      toast.error('Veuillez entrer votre clé API Dolibarr');
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-secondary/30">
      {/* Logo SmartElectric */}
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <label className="text-sm font-medium">Clé API Dolibarr</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Trouvez votre clé API dans Dolibarr :<br />
                    <strong>Accueil → Configuration → Utilisateurs → [Votre utilisateur] → Onglet API</strong>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Votre clé DOLAPIKEY"
              className="h-14 text-base rounded-xl pr-12 font-mono"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="worker"
          size="full"
          disabled={isLoading}
          className="mt-6"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Se connecter'
          )}
        </Button>
      </form>

      {/* Help section */}
      <div className="mt-8 text-center animate-fade-in space-y-3" style={{ animationDelay: '0.3s' }}>
        {!isDolibarrConfigured() ? (
          <>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 max-w-sm">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                ⚠️ Configurez d'abord l'URL de votre Dolibarr
              </p>
            </div>
            <Link 
              to="/settings" 
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Settings className="w-4 h-4" />
              Configurer Dolibarr
            </Link>
          </>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 max-w-sm">
            <p className="text-xs text-muted-foreground">
              Connectez-vous avec votre clé API Dolibarr.<br />
              <span className="text-primary">Mode démo :</span> utilisez <code className="bg-muted px-1 rounded">demo</code>
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
