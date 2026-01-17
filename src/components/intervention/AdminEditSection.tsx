import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Save, Loader2, X, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>(
    intervention.assignedTo?.id?.toString() || ''
  );
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Initialize date safely
  useEffect(() => {
    try {
      if (intervention.dateStart) {
        const date = new Date(intervention.dateStart);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date.toISOString().slice(0, 16));
        }
      }
    } catch (e) {
      console.error('[AdminEditSection] Error parsing date:', e);
    }
  }, [intervention.dateStart]);

  // Check admin status safely
  useEffect(() => {
    try {
      const worker = getWorkerFromStorage();
      const adminCheck = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
      setIsAdmin(adminCheck);
      console.log('[AdminEditSection] Admin check:', adminCheck);
    } catch (e) {
      console.error('[AdminEditSection] Error checking admin:', e);
      setIsAdmin(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (loadingUsers) return;
    setLoadingUsers(true);
    setLoadError(null);
    
    try {
      console.log('[AdminEditSection] Loading users...');
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });
      
      if (error) {
        console.error('[AdminEditSection] API error:', error);
        setLoadError('Erreur API');
        throw error;
      }
      
      console.log('[AdminEditSection] API response:', data);
      
      let mappedUsers: DolibarrUser[] = [];
      
      if (Array.isArray(data) && data.length > 0) {
        mappedUsers = data.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.name || u.lastname || u.login || 'Inconnu',
          firstName: u.firstName || u.firstname || '',
          login: u.login || '',
        })).filter((u: DolibarrUser) => u.id > 0);
        
        console.log('[AdminEditSection] Mapped', mappedUsers.length, 'users');
      }
      
      // Add current assigned user as fallback
      if (intervention.assignedTo?.id) {
        const exists = mappedUsers.some(u => u.id === intervention.assignedTo?.id);
        if (!exists) {
          mappedUsers.unshift({
            id: intervention.assignedTo.id,
            name: intervention.assignedTo.name || '',
            firstName: intervention.assignedTo.firstName || '',
            login: '',
          });
        }
      }
      
      // Add current worker as fallback
      const currentWorker = getWorkerFromStorage();
      if (currentWorker?.id) {
        const workerId = parseInt(currentWorker.id);
        if (workerId > 0 && !mappedUsers.some(u => u.id === workerId)) {
          mappedUsers.push({
            id: workerId,
            name: currentWorker.lastname || currentWorker.name || '',
            firstName: currentWorker.firstname || currentWorker.firstName || '',
            login: currentWorker.login || '',
          });
        }
      }
      
      setUsers(mappedUsers);
    } catch (error) {
      console.error('[AdminEditSection] Load error:', error);
      setLoadError('Impossible de charger les utilisateurs');
      
      // Fallback to assigned user only
      const fallback: DolibarrUser[] = [];
      if (intervention.assignedTo?.id) {
        fallback.push({
          id: intervention.assignedTo.id,
          name: intervention.assignedTo.name || '',
          firstName: intervention.assignedTo.firstName || '',
          login: '',
        });
      }
      setUsers(fallback);
    } finally {
      setLoadingUsers(false);
    }
  }, [intervention.assignedTo, loadingUsers]);

  const handleOpen = useCallback(() => {
    console.log('[AdminEditSection] Opening modal...');
    setIsOpen(true);
    loadUsers();
  }, [loadUsers]);

  const handleClose = useCallback(() => {
    console.log('[AdminEditSection] Closing modal...');
    setIsOpen(false);
  }, []);

  const handleSave = useCallback(() => {
    toast.info("Modification non supportée par l'API Dolibarr. Modifiez directement dans Dolibarr.");
    handleClose();
  }, [handleClose]);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleOpen}>
        <User className="w-4 h-4" />
        Modifier
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50"
            onClick={handleClose}
          />
          
          {/* Panel - Bottom Sheet Style */}
          <div className="fixed left-0 right-0 bottom-0 bg-background rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden">
            {/* Drag Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold text-foreground">Modifier l'intervention</span>
                </div>
                <button 
                  onClick={handleClose} 
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Assignation et date de {intervention.ref}
              </p>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-200px)]">
              {/* User Selection */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <User className="w-4 h-4 text-primary" />
                  Technicien assigné
                </label>
                
                {loadingUsers ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Chargement des utilisateurs...</span>
                  </div>
                ) : loadError ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={loadUsers} 
                      className="mt-2"
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full h-12 px-3 pr-10 text-base border border-input rounded-lg bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Non assigné</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id.toString()}>
                          {user.firstName} {user.name} {user.login ? `(${user.login})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                )}
                
                {users.length > 0 && !loadingUsers && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {users.length} utilisateur(s) disponible(s)
                  </p>
                )}
                
                {intervention.assignedTo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actuellement : {intervention.assignedTo.firstName} {intervention.assignedTo.name}
                  </p>
                )}
              </div>
              
              {/* Date Selection */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Date et heure
                </label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-12 px-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {intervention.dateStart && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actuellement : {new Date(intervention.dateStart).toLocaleString('fr-CH')}
                  </p>
                )}
              </div>
              
              {/* API Limitation Notice */}
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Note : L'API Dolibarr v18 ne supporte pas la modification de l'assignation via l'API. 
                  Utilisez l'interface Dolibarr pour modifier ces champs.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-border flex gap-3 bg-background">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                disabled={isLoading} 
                className="flex-1 h-12"
              >
                <X className="w-4 h-4 mr-2" />
                Fermer
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isLoading} 
                className="flex-1 h-12"
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
