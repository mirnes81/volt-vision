import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isDolibarrConfigured } from '@/lib/dolibarrConfig';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
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
          <label className="text-sm font-medium mb-2 block">Identifiant</label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Votre login Dolibarr"
            className="h-14 text-base rounded-xl"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Mot de passe</label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="h-14 text-base rounded-xl pr-12"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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

      {/* Demo hint */}
      <div className="mt-8 text-center animate-fade-in space-y-2" style={{ animationDelay: '0.3s' }}>
        {!isDolibarrConfigured() ? (
          <>
            <p className="text-xs text-muted-foreground">
              Mode démo: identifiant <strong>demo</strong> / mot de passe <strong>demo</strong>
            </p>
            <Link 
              to="/settings" 
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Settings className="w-3 h-3" />
              Configurer Dolibarr
            </Link>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Connectez-vous avec vos identifiants Dolibarr
          </p>
        )}
      </div>

      {/* Version */}
      <p className="absolute bottom-4 text-xs text-muted-foreground/50">
        SmartElectric Suite v1.0.0
      </p>
    </div>
  );
}
