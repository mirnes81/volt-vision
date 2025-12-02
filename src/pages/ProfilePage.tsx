import { LogOut, User, Phone, Mail, Shield, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { worker, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Déconnexion réussie');
    navigate('/login');
  };

  return (
    <div className="pb-4">
      <Header title="Mon profil" />

      <div className="px-4 space-y-6 pt-4">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mx-auto mb-4 shadow-glow">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">
            {worker?.firstName} {worker?.name}
          </h2>
          <p className="text-muted-foreground">{worker?.login}</p>
        </div>

        {/* Info Cards */}
        <div className="space-y-3">
          {worker?.email && (
            <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium truncate">{worker.email}</p>
              </div>
            </div>
          )}

          {worker?.phone && (
            <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Téléphone</p>
                <p className="font-medium">{worker.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button className="w-full bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4 text-left btn-press">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Sécurité</p>
              <p className="text-xs text-muted-foreground">Changer mot de passe</p>
            </div>
          </button>

          <button className="w-full bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center gap-4 text-left btn-press">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Aide</p>
              <p className="text-xs text-muted-foreground">Support et documentation</p>
            </div>
          </button>
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          size="full"
          onClick={handleLogout}
          className="gap-3"
        >
          <LogOut className="w-5 h-5" />
          Se déconnecter
        </Button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          MV3 Pro Électricien v1.0.0
        </p>
      </div>
    </div>
  );
}
