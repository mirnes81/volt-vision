import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
      toast.error('Identifiants invalides');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-secondary/30">
      {/* Logo */}
      <div className="mb-8 text-center animate-slide-up">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Zap className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">MV3 Pro</h1>
        <p className="text-muted-foreground">Électricien</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <label className="text-sm font-medium mb-2 block">Identifiant</label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Votre login"
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
      <p className="mt-8 text-xs text-muted-foreground text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
        Demo: identifiant <strong>demo</strong> / mot de passe <strong>demo</strong>
      </p>
    </div>
  );
}
