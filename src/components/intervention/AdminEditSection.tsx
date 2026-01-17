import { useState, useEffect } from 'react';
import { Calendar, User, Save, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Intervention } from '@/types/intervention';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

interface AdminEditSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

interface DolibarrUser {
  id: number;
  name: string;
  firstName: string;
  login: string;
}

// Safe localStorage getter
function getWorkerFromStorage(): any | null {
  try {
    const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
    if (!workerData) return null;
    return JSON.parse(workerData);
  } catch (e) {
    console.error('[AdminEditSection] Error parsing worker data:', e);
    return null;
  }
}

export function AdminEditSection({ intervention, onUpdate }: AdminEditSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<DolibarrUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>(
    intervention.assignedTo?.id?.toString() || 'none'
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      if (intervention.dateStart) {
        return new Date(intervention.dateStart).toISOString().slice(0, 16);
      }
    } catch (e) {
      console.error('[AdminEditSection] Error parsing date:', e);
    }
    return '';
  });

  // Check admin status safely
  useEffect(() => {
    const worker = getWorkerFromStorage();
    const adminCheck = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
    setIsAdmin(adminCheck);
    console.log('[AdminEditSection] Admin check:', { 
      hasWorker: !!worker, 
      admin: worker?.admin, 
      isAdmin: worker?.isAdmin, 
      result: adminCheck 
    });
  }, []);

  // Load users when dialog opens
  useEffect(() => {
    if (isOpen && users.length === 0) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });
      
      if (error) throw error;
      
      if (Array.isArray(data)) {
        setUsers(data.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.lastname || u.login || '',
          firstName: u.firstname || '',
          login: u.login || '',
        })));
      }
    } catch (error) {
      console.error('[AdminEditSection] Error loading users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async () => {
    // NOTE: L'API REST Dolibarr v18 ne supporte pas la méthode PUT pour les interventions.
    // La mise à jour doit être faite directement dans Dolibarr.
    toast.error("L'API Dolibarr ne permet pas de modifier les interventions. Veuillez modifier directement dans Dolibarr.");
    setIsOpen(false);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="w-4 h-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier l'intervention
          </DialogTitle>
          <DialogDescription>
            Modifier l'assignation et la date de l'intervention {intervention.ref}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Assignation */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Technicien assigné
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            ) : (
              <Select value={selectedUserId || "none"} onValueChange={(val) => setSelectedUserId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un technicien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.firstName} {user.name} ({user.login})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {intervention.assignedTo && (
              <p className="text-xs text-muted-foreground">
                Actuellement : {intervention.assignedTo.firstName} {intervention.assignedTo.name}
              </p>
            )}
          </div>
          
          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Date et heure d'intervention
            </label>
            <Input
              type="datetime-local"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
            {intervention.dateStart && (
              <p className="text-xs text-muted-foreground">
                Actuellement : {new Date(intervention.dateStart).toLocaleString('fr-CH')}
              </p>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
