import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Save, Loader2, X, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Intervention } from '@/types/intervention';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { createPortal } from 'react-dom';

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
  const [mounted, setMounted] = useState(false);
  
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

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    
    try {
      console.log('[AdminEditSection] Loading users...');
      const { data, error } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });
      
      if (error) {
        console.error('[AdminEditSection] API error:', error);
        throw error;
      }
      
      let mappedUsers: DolibarrUser[] = [];
      
      if (Array.isArray(data) && data.length > 0) {
        mappedUsers = data.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.name || u.lastname || u.login || 'Inconnu',
          firstName: u.firstName || u.firstname || '',
          login: u.login || '',
        })).filter((u: DolibarrUser) => u.id > 0);
        
        console.log('[AdminEditSection] Loaded', mappedUsers.length, 'users');
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
    console.log('[AdminEditSection] Opening...');
    setIsOpen(true);
    if (users.length === 0) {
      loadUsers();
    }
  }, [users.length, loadUsers]);

  const handleClose = useCallback(() => {
    console.log('[AdminEditSection] Closing...');
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

  const modalContent = isOpen ? (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
        }}
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div 
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          zIndex: 9999,
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
          <div style={{ width: '40px', height: '4px', backgroundColor: '#ccc', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings style={{ width: '20px', height: '20px', color: '#6B8E23' }} />
              <span style={{ fontSize: '18px', fontWeight: 600 }}>Modifier l'intervention</span>
            </div>
            <button onClick={handleClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Assignation et date de {intervention.ref}
          </p>
        </div>
        
        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', maxHeight: 'calc(80vh - 180px)' }}>
          {/* User Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              <User style={{ width: '16px', height: '16px', color: '#6B8E23' }} />
              Technicien assigné
            </label>
            
            {loadingUsers ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', color: '#666' }}>Chargement...</span>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '48px',
                    padding: '0 40px 0 12px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Non assigné</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id.toString()}>
                      {user.firstName} {user.name} {user.login ? `(${user.login})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#666', pointerEvents: 'none' }} />
              </div>
            )}
            
            {intervention.assignedTo && (
              <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Actuellement : {intervention.assignedTo.firstName} {intervention.assignedTo.name}
              </p>
            )}
          </div>
          
          {/* Date Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              <Calendar style={{ width: '16px', height: '16px', color: '#6B8E23' }} />
              Date et heure
            </label>
            <input
              type="datetime-local"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
            {intervention.dateStart && (
              <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Actuellement : {new Date(intervention.dateStart).toLocaleString('fr-CH')}
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #eee', display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={handleClose} disabled={isLoading} style={{ flex: 1, height: '48px' }}>
            <X style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading} style={{ flex: 1, height: '48px' }}>
            <Save style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Enregistrer
          </Button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleOpen}>
        <User className="w-4 h-4" />
        Modifier
      </Button>
      
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}