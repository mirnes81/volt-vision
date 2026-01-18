import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Save, Loader2, X, Settings, ChevronDown, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/types/intervention';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
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

  // Auto-hide success indicator after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

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
      const updateData: any = {};
      
      // Use fk_user_assigned for technician assignment (NOT fk_user_author which is read-only)
      if (selectedUserId) {
        updateData.fk_user_assigned = parseInt(selectedUserId);
      }
      
      // Add date if changed
      if (selectedDate) {
        const timestamp = Math.floor(new Date(selectedDate).getTime() / 1000);
        updateData.dateo = timestamp;
        updateData.date_intervention = timestamp;
      }
      
      console.log('[AdminEditSection] Sending update:', updateData);
      
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { 
          action: 'update-intervention',
          params: {
            id: intervention.id,
            data: updateData
          }
        },
      });
      
      if (error) throw error;
      
      if (data?.error) {
        // Dolibarr API doesn't support PUT on interventions - inform user clearly
        toast.error(
          <div className="space-y-1">
            <p className="font-medium">Modification non supportée par Dolibarr</p>
            <p className="text-sm">L'API REST Dolibarr v18 ne permet pas la modification d'assignation via PUT.</p>
            <p className="text-sm text-muted-foreground">Modifiez directement dans Dolibarr ou utilisez le panneau d'assignation multiple.</p>
          </div>,
          { duration: 8000 }
        );
      } else {
        // Show success state
        setShowSuccess(true);
        setLastUpdated(new Date());
        
        // Get the selected user name for the toast
        const selectedUser = users.find(u => u.id.toString() === selectedUserId);
        const userName = selectedUser ? `${selectedUser.firstName} ${selectedUser.name}`.trim() : '';
        
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="font-medium">Intervention mise à jour !</p>
              {userName && <p className="text-sm text-muted-foreground">Assigné à : {userName}</p>}
            </div>
          </div>,
          { duration: 4000 }
        );
        
        onUpdate();
      }
    } catch (error: any) {
      console.error('[AdminEditSection] Update error:', error);
      toast.error(`Erreur: ${error.message || 'Mise à jour échouée'}`);
    } finally {
      setIsLoading(false);
      handleClose();
    }
  }, [selectedUserId, selectedDate, handleClose, intervention.id, onUpdate, users]);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Button with success indicator */}
      <div className="relative inline-flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "gap-2 transition-all duration-300",
            showSuccess && "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          )} 
          onClick={handleOpen}
        >
          {showSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 animate-bounce" />
              <span>Modifié !</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4" />
              <span>Modifier</span>
            </>
          )}
        </Button>
        
        {/* Success badge with sparkle animation */}
        {showSuccess && (
          <div className="absolute -top-1 -right-1 flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
        )}
        
        {/* Last updated indicator */}
        {lastUpdated && !showSuccess && (
          <span className="text-xs text-muted-foreground">
            Modifié à {lastUpdated.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      
      {/* Modal rendered inline - no portal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          
          {/* Panel */}
          <div className="absolute left-0 right-0 bottom-0 bg-background rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">Modifier l'intervention</span>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-muted rounded-full transition-colors">
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
                      className="w-full h-12 px-3 pr-10 text-base border border-input rounded-lg bg-background appearance-none cursor-pointer focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                  className="w-full h-12 px-3 text-base border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                {intervention.dateStart && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actuellement : {new Date(intervention.dateStart).toLocaleString('fr-CH')}
                  </p>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-border flex gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1 h-12">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isLoading} 
                className="flex-1 h-12 relative overflow-hidden"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}