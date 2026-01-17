import { useState, useEffect } from 'react';
import { Calendar, User, Save, Loader2, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
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
    intervention.assignedTo?.id?.toString() || ''
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

  // Load users when sheet opens
  useEffect(() => {
    if (isOpen && users.length === 0) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      console.log('[AdminEditSection] Loading users...');
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });
      
      console.log('[AdminEditSection] Users response:', { data, error });
      
      let mappedUsers: DolibarrUser[] = [];
      
      if (!error && Array.isArray(data) && data.length > 0) {
        mappedUsers = data.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.name || u.lastname || u.login || 'Inconnu',
          firstName: u.firstName || u.firstname || '',
          login: u.login || '',
        }));
        console.log('[AdminEditSection] Mapped users from API:', mappedUsers);
      } else {
        console.warn('[AdminEditSection] No users from API, using fallback');
      }
      
      // Fallback: add current assigned user if not in list
      if (intervention.assignedTo?.id) {
        const assignedId = intervention.assignedTo.id;
        const exists = mappedUsers.some(u => u.id === assignedId);
        if (!exists) {
          mappedUsers.unshift({
            id: assignedId,
            name: intervention.assignedTo.name || '',
            firstName: intervention.assignedTo.firstName || '',
            login: '',
          });
          console.log('[AdminEditSection] Added assigned user as fallback');
        }
      }
      
      // Also add current logged-in worker as fallback
      const currentWorker = getWorkerFromStorage();
      if (currentWorker?.id) {
        const workerId = parseInt(currentWorker.id);
        const exists = mappedUsers.some(u => u.id === workerId);
        if (!exists && workerId > 0) {
          mappedUsers.push({
            id: workerId,
            name: currentWorker.lastname || currentWorker.name || '',
            firstName: currentWorker.firstname || currentWorker.firstName || '',
            login: currentWorker.login || '',
          });
          console.log('[AdminEditSection] Added current worker as fallback');
        }
      }
      
      setUsers(mappedUsers);
    } catch (error) {
      console.error('[AdminEditSection] Error loading users:', error);
      
      // Even on error, provide fallback options
      const fallbackUsers: DolibarrUser[] = [];
      
      if (intervention.assignedTo?.id) {
        fallbackUsers.push({
          id: intervention.assignedTo.id,
          name: intervention.assignedTo.name || '',
          firstName: intervention.assignedTo.firstName || '',
          login: '',
        });
      }
      
      const currentWorker = getWorkerFromStorage();
      if (currentWorker?.id) {
        const workerId = parseInt(currentWorker.id);
        if (!fallbackUsers.some(u => u.id === workerId) && workerId > 0) {
          fallbackUsers.push({
            id: workerId,
            name: currentWorker.lastname || currentWorker.name || '',
            firstName: currentWorker.firstname || currentWorker.firstName || '',
            login: currentWorker.login || '',
          });
        }
      }
      
      setUsers(fallbackUsers);
      
      if (fallbackUsers.length === 0) {
        toast.error('Erreur lors du chargement des utilisateurs');
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async () => {
    // NOTE: L'API REST Dolibarr v18 ne supporte pas la méthode PUT pour les interventions.
    toast.error("L'API Dolibarr ne permet pas de modifier les interventions. Veuillez modifier directement dans Dolibarr.");
    setIsOpen(false);
  };

  if (!isAdmin) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="w-4 h-4" />
          Modifier
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Modifier l'intervention
          </SheetTitle>
          <SheetDescription>
            Modifier l'assignation et la date de {intervention.ref}
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 py-4">
          {/* Assignation */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Technicien assigné
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement des techniciens...
              </div>
            ) : users.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
                Aucun utilisateur disponible.
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Non assigné</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id.toString()}>
                    {user.firstName} {user.name} ({user.login})
                  </option>
                ))}
              </select>
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
        <div className="flex gap-2 pt-2 pb-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading} className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
