import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import logoEnes from '@/assets/logo-enes.png';

const Index = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isLoading) {
      if (isLoggedIn) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [isLoggedIn, isLoading, navigate]);

  // Show a nice loading screen instead of just a spinner
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img 
          src={logoEnes} 
          alt="ENES Électricité" 
          className="h-16 w-auto"
        />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
};

export default Index;
