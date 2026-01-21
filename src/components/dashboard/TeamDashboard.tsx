import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Clock, Briefcase, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TeamMember {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: Date | null;
  hoursThisWeek: number;
  assignedInterventions: number;
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function TeamDashboard() {
  const { t } = useLanguage();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      setLoading(true);

      // Fetch Dolibarr users
      const { data: usersData, error: usersError } = await supabase.functions.invoke('dolibarr-api', {
        body: { action: 'get-users' }
      });

      if (usersError) throw usersError;

      const users = usersData?.data || [];

      // Fetch worker locations for online status
      const { data: locations } = await supabase
        .from('worker_locations')
        .select('user_id, user_name, is_online, updated_at')
        .eq('tenant_id', DEFAULT_TENANT_ID);

      // Fetch weekly work summary
      const { data: weeklySummary } = await supabase
        .from('weekly_work_summary')
        .select('user_id, total_minutes')
        .eq('tenant_id', DEFAULT_TENANT_ID);

      // Fetch intervention assignments count
      const { data: assignments } = await supabase
        .from('intervention_assignments')
        .select('user_id')
        .eq('tenant_id', DEFAULT_TENANT_ID);

      // Build team members data
      const locationMap = new Map(locations?.map(l => [l.user_id, l]) || []);
      const hoursMap = new Map(weeklySummary?.map(w => [w.user_id, w.total_minutes || 0]) || []);
      
      // Count assignments per user
      const assignmentCounts = new Map<string, number>();
      assignments?.forEach(a => {
        const count = assignmentCounts.get(a.user_id) || 0;
        assignmentCounts.set(a.user_id, count + 1);
      });

      const members: TeamMember[] = users.map((user: any) => {
        const location = locationMap.get(String(user.id));
        const isOnline = location?.is_online && 
          location.updated_at && 
          new Date(location.updated_at) > new Date(Date.now() - 15 * 60 * 1000); // 15 min timeout

        return {
          id: String(user.id),
          name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login,
          isOnline: isOnline || false,
          lastSeen: location?.updated_at ? new Date(location.updated_at) : null,
          hoursThisWeek: (hoursMap.get(String(user.id)) || 0) / 60,
          assignedInterventions: assignmentCounts.get(String(user.id)) || 0
        };
      });

      // Sort: online first, then by name
      members.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return b.isOnline ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSeen = (date: Date | null) => {
    if (!date) return 'Jamais';
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const onlineCount = teamMembers.filter(m => m.isOnline).length;
  const totalHours = teamMembers.reduce((sum, m) => sum + m.hoursThisWeek, 0);
  const totalAssignments = teamMembers.reduce((sum, m) => sum + m.assignedInterventions, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Équipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
              <Wifi className="h-4 w-4" />
              <span className="text-2xl font-bold">{onlineCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">En ligne</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
              <span className="text-2xl font-bold">{totalHours.toFixed(1)}h</span>
            </div>
            <p className="text-xs text-muted-foreground">Cette semaine</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
              <Briefcase className="h-4 w-4" />
              <span className="text-2xl font-bold">{totalAssignments}</span>
            </div>
            <p className="text-xs text-muted-foreground">Affectations</p>
          </CardContent>
        </Card>
      </div>

      {/* Team List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Techniciens ({teamMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {teamMembers.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span 
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                      member.isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{member.name}</span>
                    {member.isOnline && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                        En ligne
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {member.isOnline ? (
                      <Wifi className="h-3 w-3 text-green-500" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {member.isOnline ? 'Actif maintenant' : `Vu ${formatLastSeen(member.lastSeen)}`}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-1 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{member.hoursThisWeek.toFixed(1)}h</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    <span>{member.assignedInterventions} interv.</span>
                  </div>
                </div>
              </div>
            ))}

            {teamMembers.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun technicien trouvé</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
