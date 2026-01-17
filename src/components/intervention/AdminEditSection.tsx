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
    } catch (e) {
      console.error('[AdminEditSection] Error checking admin:', e);
      setIsAdmin(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (loadingUsers) return;
    setLoadingUsers(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });
      
      if (error) throw error;
      
      let mappedUsers: DolibarrUser[] = [];
      
      if (Array.isArray(data) && data.length > 0) {
        mappedUsers = data.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.name || u.lastname || u.login || 'Inconnu',
          firstName: u.firstName || u.firstname || '',
          login: u.login || '',
        })).filter((u: DolibarrUser) => u.id > 0);
      }
      
      // Add fallbacks
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
      console.error('[AdminEditSection] Error:', error);
      
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
    setIsOpen(true);
    if (users.length === 0) {
      loadUsers();
    }
  }, [users.length, loadUsers]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedUserId && !selectedDate) {
      toast.warning("Aucune modification à enregistrer.");
      handleClose();
      return;
    }
    
    setIsLoading(true);
    
    try {
      const updateData: Record<string, any> = {};
      
      // Prepare user assignment update
      if (selectedUserId && selectedUserId !== (intervention.assignedTo?.id?.toString() || '')) {
        updateData.fk_user_author = parseInt(selectedUserId);
      }
      
      // Prepare date update
      if (selectedDate) {
        const dateObj = new Date(selectedDate);
        if (!isNaN(dateObj.getTime())) {
          // Dolibarr expects Unix timestamp
          updateData.dateo = Math.floor(dateObj.getTime() / 1000);
          updateData.date_intervention = Math.floor(dateObj.getTime() / 1000);
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info("Aucune modification détectée.");
        handleClose();
        return;
      }
      
      console.log('[AdminEditSection] Updating intervention:', intervention.id, updateData);
      
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { 
          action: 'update-intervention',
          params: {
            id: intervention.id,
            data: updateData
          }
        },
      });
      
      if (error) {
        console.error('[AdminEditSection] Update error:', error);
        throw new Error(error.message || 'Erreur de mise à jour');
      }
      
      if (data?.error) {
        console.error('[AdminEditSection] API error:', data.error);
        throw new Error(data.error);
      }
      
      toast.success("Intervention mise à jour avec succès");
      handleClose();
      onUpdate();
    } catch (error: any) {
      console.error('[AdminEditSection] Save error:', error);
      toast.error(`Erreur: ${error.message || 'Impossible de mettre à jour'}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, selectedDate, intervention.id, intervention.assignedTo?.id, handleClose, onUpdate]);

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
      
      {/* Modal rendered inline - no portal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          
          {/* Panel */}
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">Modifier l'intervention</span>
                </div>
                <button onClick={handleClose} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Assignation et date de {intervention.ref}
              </p>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
              {/* User Selection */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <User className="w-4 h-4 text-primary" />
                  Technicien assigné
                </label>
                
                {loadingUsers ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Chargement...</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full h-12 px-3 pr-10 text-base border border-input rounded-lg bg-background appearance-none cursor-pointer"
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
                
                {intervention.assignedTo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actuellement : {intervention.assignedTo.firstName} {intervention.assignedTo.name}
                  </p>
                )}
              </div>
              
              {/* Date Selection */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Date et heure
                </label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-12 px-3 text-base border border-input rounded-lg bg-background"
                />
                {intervention.dateStart && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actuellement : {new Date(intervention.dateStart).toLocaleString('fr-CH')}
                  </p>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1 h-12">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isLoading} className="flex-1 h-12">
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