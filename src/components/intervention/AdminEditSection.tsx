import { useState, useEffect } from 'react';
import { Calendar, User, Save, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Intervention, Worker } from '@/types/intervention';
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

export function AdminEditSection({ intervention, onUpdate }: AdminEditSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<DolibarrUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>(
    intervention.assignedTo?.id?.toString() || ''
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    intervention.dateStart 
      ? new Date(intervention.dateStart).toISOString().slice(0, 16)
      : ''
  );

  // Check if current user is admin - check both localStorage keys
  const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
  const worker = workerData ? JSON.parse(workerData) : null;
  const isAdmin = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
  
  console.log('[AdminEditSection] Admin check:', { 
    hasWorkerData: !!workerData, 
    admin: worker?.admin, 
    isAdmin: worker?.isAdmin, 
    result: isAdmin 
  });

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
          id: parseInt(u.id),
          name: u.lastname || u.login || '',
          firstName: u.firstname || '',
          login: u.login || '',
        })));
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData: Record<string, any> = {};
      
      // Update assigned user if changed
      if (selectedUserId && selectedUserId !== intervention.assignedTo?.id?.toString()) {
        updateData.fk_user_author = parseInt(selectedUserId);
      }
      
      // Update date if changed
      if (selectedDate) {
        const dateObj = new Date(selectedDate);
        updateData.dateo = Math.floor(dateObj.getTime() / 1000); // Unix timestamp
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info('Aucune modification à enregistrer');
        setIsOpen(false);
        return;
      }
      
      const { error } = await supabase.functions.invoke('dolibarr-api', {
        body: { 
          action: 'update-intervention',
          params: {
            id: intervention.id,
            data: updateData,
          },
        },
      });
      
      if (error) throw error;
      
      toast.success('Intervention mise à jour');
      setIsOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating intervention:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier l'intervention
          </DialogTitle>
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
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un technicien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non assigné</SelectItem>
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
