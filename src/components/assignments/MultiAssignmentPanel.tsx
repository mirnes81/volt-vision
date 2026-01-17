import { useState, useEffect } from 'react';
import { Users, Plus, X, Search, Loader2, AlertTriangle, User, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InterventionAssignment } from '@/types/assignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MultiAssignmentPanelProps {
  interventionId: number;
  interventionRef: string;
  interventionLabel: string;
  clientName?: string;
  location?: string;
  datePlanned?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  onAssignmentsChange?: () => void;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

export function MultiAssignmentPanel({
  interventionId,
  interventionRef,
  interventionLabel,
  clientName,
  location,
  datePlanned,
  priority = 'normal',
  onAssignmentsChange,
}: MultiAssignmentPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [assignments, setAssignments] = useState<InterventionAssignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [primaryMember, setPrimaryMember] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Fetch tenant ID and team members
  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tenant ID
      const { data: profile } = await supabase
        .from('saas_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.tenant_id) return;
      setTenantId(profile.tenant_id);

      // Get team members
      const { data: members } = await supabase
        .from('saas_profiles')
        .select('id, full_name, email')
        .eq('tenant_id', profile.tenant_id);

      setTeamMembers(members || []);

      // Get existing assignments
      const { data: existingAssignments } = await supabase
        .from('intervention_assignments')
        .select('*')
        .eq('intervention_id', interventionId);

      if (existingAssignments) {
        const typedAssignments = existingAssignments.map(a => ({
          ...a,
          priority: a.priority as 'normal' | 'urgent' | 'critical'
        })) as InterventionAssignment[];
        setAssignments(typedAssignments);
        setSelectedMembers(new Set(typedAssignments.map(a => a.user_id)));
        const primary = typedAssignments.find(a => a.is_primary);
        if (primary) setPrimaryMember(primary.user_id);
      }
    }

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, interventionId]);

  const toggleMember = (memberId: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(memberId)) {
      newSet.delete(memberId);
      if (primaryMember === memberId) {
        setPrimaryMember(null);
      }
    } else {
      newSet.add(memberId);
      if (newSet.size === 1) {
        setPrimaryMember(memberId);
      }
    }
    setSelectedMembers(newSet);
  };

  const handleSave = async () => {
    if (!tenantId || selectedMembers.size === 0) return;

    setIsLoading(true);
    try {
      // Delete existing assignments
      await supabase
        .from('intervention_assignments')
        .delete()
        .eq('intervention_id', interventionId);

      // Create new assignments
      const { data: { user } } = await supabase.auth.getUser();
      
      const newAssignments = [...selectedMembers].map(memberId => {
        const member = teamMembers.find(m => m.id === memberId);
        return {
          tenant_id: tenantId,
          intervention_id: interventionId,
          intervention_ref: interventionRef,
          intervention_label: interventionLabel,
          user_id: memberId,
          user_name: member?.full_name || 'Inconnu',
          is_primary: memberId === primaryMember,
          priority: selectedPriority,
          date_planned: datePlanned || null,
          location: location || null,
          client_name: clientName || null,
          assigned_by: user?.id,
          notification_sent: false,
          notification_acknowledged: false,
        };
      });

      const { error } = await supabase
        .from('intervention_assignments')
        .insert(newAssignments);

      if (error) throw error;

      toast({
        title: 'Assignation mise à jour',
        description: `${selectedMembers.size} technicien(s) assigné(s)`,
      });

      setIsOpen(false);
      onAssignmentsChange?.();

    } catch (error) {
      console.error('Error saving assignments:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les assignations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(m => 
    m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const priorityColors = {
    normal: 'bg-blue-500',
    urgent: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Users className="w-4 h-4" />
        Assigner ({assignments.length})
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assigner des techniciens
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Intervention info */}
            <div className="bg-secondary/50 rounded-lg p-3 text-sm">
              <p className="font-semibold">{interventionRef}</p>
              <p className="text-muted-foreground line-clamp-1">{interventionLabel}</p>
              {clientName && <p className="text-xs text-muted-foreground">Client: {clientName}</p>}
            </div>

            {/* Priority selector */}
            <div>
              <label className="text-sm font-medium">Priorité</label>
              <Select value={selectedPriority} onValueChange={(v) => setSelectedPriority(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Normal
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Critique
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {['urgent', 'critical'].includes(selectedPriority) && (
                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Les techniciens recevront une notification sonore
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

            {/* Team members list */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredMembers.map((member) => {
                const isSelected = selectedMembers.has(member.id);
                const isPrimary = primaryMember === member.id;

                return (
                  <div
                    key={member.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-secondary/50'
                    )}
                    onClick={() => toggleMember(member.id)}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.full_name || 'Sans nom'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimaryMember(member.id);
                        }}
                        className={cn(
                          'p-1.5 rounded-full transition-colors',
                          isPrimary 
                            ? 'bg-yellow-500 text-white' 
                            : 'bg-secondary hover:bg-yellow-500/20'
                        )}
                        title={isPrimary ? 'Technicien principal' : 'Définir comme principal'}
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredMembers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Aucun technicien trouvé
                </p>
              )}
            </div>

            {/* Selected summary */}
            {selectedMembers.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Sélectionnés:</span>
                {[...selectedMembers].map(id => {
                  const member = teamMembers.find(m => m.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {primaryMember === id && <Crown className="w-3 h-3 text-yellow-500" />}
                      {member?.full_name?.split(' ')[0] || 'Inconnu'}
                      <button
                        onClick={() => toggleMember(id)}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={selectedMembers.size === 0 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Assigner ${selectedMembers.size} technicien(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
