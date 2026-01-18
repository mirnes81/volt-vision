import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, Search, Loader2, AlertTriangle, User, Crown, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { invalidateAssignmentsCache } from '@/hooks/useInterventionAssignments';

// Default tenant UUID for Dolibarr integration mode
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface DolibarrAssignmentPanelProps {
  interventionId: number;
  interventionRef: string;
  interventionLabel: string;
  clientName?: string;
  location?: string;
  datePlanned?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  onAssignmentsChange?: () => void;
  initialAssignmentsCount?: number; // Count from parent to show immediately
}

interface DolibarrUser {
  id: number;
  name: string;
  firstName: string;
  login: string;
  email?: string;
}

interface Assignment {
  id: string;
  user_id: string;
  user_name: string;
  is_primary: boolean;
  priority: 'normal' | 'urgent' | 'critical';
}

// Get worker from localStorage
function getWorkerFromStorage(): any | null {
  try {
    const workerData = localStorage.getItem('mv3_worker') || localStorage.getItem('worker');
    if (!workerData) return null;
    return JSON.parse(workerData);
  } catch (e) {
    return null;
  }
}

export function DolibarrAssignmentPanel({
  interventionId,
  interventionRef,
  interventionLabel,
  clientName,
  location,
  datePlanned,
  priority = 'normal',
  onAssignmentsChange,
  initialAssignmentsCount = 0,
}: DolibarrAssignmentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [users, setUsers] = useState<DolibarrUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [primaryUser, setPrimaryUser] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const worker = getWorkerFromStorage();
    console.log('[DolibarrAssignmentPanel] Worker data:', JSON.stringify(worker));
    console.log('[DolibarrAssignmentPanel] Admin field:', worker?.admin, 'Type:', typeof worker?.admin);
    console.log('[DolibarrAssignmentPanel] isAdmin check:', worker?.isAdmin);
    const adminCheck = worker?.admin === '1' || worker?.admin === 1 || worker?.isAdmin === true;
    console.log('[DolibarrAssignmentPanel] Final admin result:', adminCheck);
    setIsAdmin(adminCheck);
  }, []);

  // Log when isAdmin changes
  useEffect(() => {
    console.log('[DolibarrAssignmentPanel] isAdmin state:', isAdmin);
  }, [isAdmin]);

  // Fetch Dolibarr users and existing assignments
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Dolibarr users
      const { data: usersData, error: usersError } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' },
      });

      if (!usersError && Array.isArray(usersData)) {
        const mappedUsers = usersData.map((u: any) => ({
          id: parseInt(u.id) || 0,
          name: u.name || u.lastname || u.login || 'Inconnu',
          firstName: u.firstName || u.firstname || '',
          login: u.login || '',
          email: u.email || '',
        })).filter((u: DolibarrUser) => u.id > 0);
        setUsers(mappedUsers);
      }

      // Fetch existing assignments from Supabase
      const { data: existingAssignments, error: assignError } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('intervention_id', interventionId)
        .eq('tenant_id', DEFAULT_TENANT_ID);

      if (!assignError && existingAssignments) {
        const typedAssignments = existingAssignments.map(a => ({
          id: a.id,
          user_id: a.user_id,
          user_name: a.user_name,
          is_primary: a.is_primary || false,
          priority: (a.priority as 'normal' | 'urgent' | 'critical') || 'normal',
        }));
        setAssignments(typedAssignments);
        setSelectedUsers(new Set(typedAssignments.map(a => a.user_id)));
        const primary = typedAssignments.find(a => a.is_primary);
        if (primary) setPrimaryUser(primary.user_id);
      }
    } catch (error) {
      console.error('[DolibarrAssignmentPanel] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [interventionId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Auto-hide success after 3 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
      if (primaryUser === userId) {
        setPrimaryUser(null);
      }
    } else {
      newSet.add(userId);
      if (newSet.size === 1) {
        setPrimaryUser(userId);
      }
    }
    setSelectedUsers(newSet);
  };

  const handleSave = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('Sélectionnez au moins un technicien');
      return;
    }

    setIsSaving(true);
    try {
      const currentWorker = getWorkerFromStorage();
      
      // Delete existing assignments for this intervention
      await supabase
        .from('intervention_assignments')
        .delete()
        .eq('intervention_id', interventionId)
        .eq('tenant_id', DEFAULT_TENANT_ID);

      // Create new assignments
      const newAssignments = [...selectedUsers].map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        const fullName = user ? `${user.firstName} ${user.name}`.trim() : 'Inconnu';
        
        return {
          tenant_id: DEFAULT_TENANT_ID,
          intervention_id: interventionId,
          intervention_ref: interventionRef,
          intervention_label: interventionLabel,
          user_id: userId,
          user_name: fullName,
          is_primary: userId === primaryUser,
          priority: selectedPriority,
          date_planned: datePlanned || null,
          location: location || null,
          client_name: clientName || null,
          assigned_by: currentWorker?.id?.toString() || null,
          notification_sent: false,
          notification_acknowledged: false,
        };
      });

      const { error } = await supabase
        .from('intervention_assignments')
        .insert(newAssignments);

      if (error) throw error;

      // Show success
      setShowSuccess(true);
      
      // Get names for toast
      const assignedNames = [...selectedUsers].map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        return user ? `${user.firstName} ${user.name}`.trim() : 'Inconnu';
      });

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <p className="font-medium">Assignation enregistrée !</p>
            <p className="text-sm text-muted-foreground">
              {assignedNames.join(', ')}
            </p>
          </div>
        </div>,
        { duration: 4000 }
      );

      // Invalidate cache to refresh all views
      invalidateAssignmentsCache();
      
      setIsOpen(false);
      onAssignmentsChange?.();

    } catch (error: any) {
      console.error('[DolibarrAssignmentPanel] Save error:', error);
      toast.error(`Erreur: ${error.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.login?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const priorityConfig = {
    normal: { label: 'Normal', color: 'bg-blue-500' },
    urgent: { label: 'Urgent', color: 'bg-orange-500' },
    critical: { label: 'Critique', color: 'bg-red-500' },
  };

  // Don't render for non-admins
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Trigger button */}
      <div className="relative inline-flex items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={cn(
            "gap-2 transition-all duration-300",
            showSuccess && "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          )}
        >
          {showSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 animate-bounce" />
              <span>Assigné !</span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              <span>Assigner ({assignments.length || initialAssignmentsCount})</span>
            </>
          )}
        </Button>
        
        {/* Success pulse */}
        {showSuccess && (
          <div className="absolute -top-1 -right-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
        )}
      </div>

      {/* Modal - inline to avoid portal issues on mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute left-0 right-0 bottom-0 bg-background rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">Assigner des techniciens</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {interventionRef} - {clientName || interventionLabel}
              </p>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-200px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Chargement...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Priority selector */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Priorité</label>
                    <div className="flex gap-2">
                      {(['normal', 'urgent', 'critical'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPriority(p)}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg border-2 transition-all text-sm font-medium",
                            selectedPriority === p 
                              ? `${priorityConfig[p].color} text-white border-transparent`
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {priorityConfig[p].label}
                        </button>
                      ))}
                    </div>
                    {selectedPriority !== 'normal' && (
                      <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Notification prioritaire envoyée
                      </p>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un technicien..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Users list */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredUsers.map((user) => {
                      const userId = user.id.toString();
                      const isSelected = selectedUsers.has(userId);
                      const isPrimary = primaryUser === userId;
                      const fullName = `${user.firstName} ${user.name}`.trim();

                      return (
                        <div
                          key={user.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                            isSelected 
                              ? "bg-primary/5 border-primary" 
                              : "border-border hover:border-primary/30 hover:bg-secondary/50"
                          )}
                          onClick={() => toggleUser(userId)}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{fullName || user.login}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.login} {user.email && `• ${user.email}`}
                            </p>
                          </div>
                          {isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimaryUser(userId);
                              }}
                              className={cn(
                                "p-2 rounded-full transition-colors",
                                isPrimary 
                                  ? "bg-yellow-500 text-white" 
                                  : "bg-secondary hover:bg-yellow-500/20"
                              )}
                              title={isPrimary ? 'Technicien principal' : 'Définir comme principal'}
                            >
                              <Crown className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucun technicien trouvé
                      </p>
                    )}
                  </div>

                  {/* Selected summary */}
                  {selectedUsers.size > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">Sélectionnés:</span>
                      {[...selectedUsers].map(userId => {
                        const user = users.find(u => u.id.toString() === userId);
                        const firstName = user?.firstName || user?.name?.split(' ')[0] || 'Inconnu';
                        return (
                          <Badge key={userId} variant="secondary" className="gap-1">
                            {primaryUser === userId && <Crown className="w-3 h-3 text-yellow-500" />}
                            {firstName}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUser(userId);
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)} 
                disabled={isSaving}
                className="flex-1 h-12"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={selectedUsers.size === 0 || isSaving}
                className="flex-1 h-12"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Assigner ({selectedUsers.size})
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