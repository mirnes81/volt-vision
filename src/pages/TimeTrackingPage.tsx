import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Calendar, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ManualTimeEntry } from '@/components/timeTracking/ManualTimeEntry';
import { TimeEntryList } from '@/components/timeTracking/TimeEntryList';
import { WeeklySummaryCard } from '@/components/timeTracking/WeeklySummaryCard';
import { MonthlySummaryCard } from '@/components/timeTracking/MonthlySummaryCard';
import { UserWeeklyLimitSetting } from '@/components/timeTracking/UserWeeklyLimitSetting';
import { AdminValidationPanel } from '@/components/timeTracking/AdminValidationPanel';
import { HoursAlertsPanel } from '@/components/timeTracking/HoursAlertsPanel';
import { TimeExportButton } from '@/components/timeTracking/TimeExportButton';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { useTimeTrackingAdmin } from '@/hooks/useTimeTrackingAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getEmployeePermissionsAsync, Permission } from '@/lib/permissions';

export default function TimeTrackingPage() {
  const { worker } = useAuth();
  const isAdmin = worker?.isAdmin;
  
  // Permissions state (loaded from database)
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = React.useState(false);
  
  // Load permissions from database
  React.useEffect(() => {
    async function loadPermissions() {
      if (worker) {
        const perms = await getEmployeePermissionsAsync(worker.id);
        setPermissions(perms);
        setPermissionsLoaded(true);
      }
    }
    loadPermissions();
  }, [worker]);
  
  // Check permissions (admins have all permissions)
  const hasPermission = (perm: Permission) => isAdmin || permissions.includes(perm);
  
  const canViewOwn = hasPermission('hours.view_own');
  const canAddOwn = hasPermission('hours.add_own');
  const canModifyOwnLimit = hasPermission('hours.modify_own_limit');
  const canValidate = hasPermission('hours.validate');
  const canExport = hasPermission('hours.export');
  const canViewAlerts = hasPermission('hours.alerts');
  
  // Show admin tabs if user has any admin-level permission
  const showAdminTabs = canValidate || canViewAlerts;
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  
  const { 
    entries, 
    deleteEntry, 
    isLoading, 
    weeklySummary, 
    monthlySummary,
    addManualEntry,
    currentUser,
    refresh 
  } = useTimeTracking({ date: selectedDate });
  
  const adminHook = useTimeTrackingAdmin();

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // Show loading while permissions are being fetched
  if (!permissionsLoaded) {
    return (
      <div className="pb-24">
        <Header title="Suivi des heures" />
        <main className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <Header title="Suivi des heures" />

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {showAdminTabs ? (
          <Tabs defaultValue="my-time" className="space-y-4">
            <TabsList className={`w-full grid ${canValidate && canViewAlerts ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="my-time" className="gap-2">
                <Clock className="w-4 h-4" />
                Mes heures
              </TabsTrigger>
              {canValidate && (
                <TabsTrigger value="validation" className="gap-2">
                  Validation
                  {adminHook.entries.filter(e => e.status === 'pending' && e.clock_out).length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {adminHook.entries.filter(e => e.status === 'pending' && e.clock_out).length}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
              {canViewAlerts && (
                <TabsTrigger value="alerts" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alertes
                  {adminHook.alerts.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{adminHook.alerts.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="my-time" className="space-y-6">
              {/* Weekly and Monthly Summaries */}
              <div className="grid gap-4 md:grid-cols-2">
                <WeeklySummaryCard
                  totalMinutes={weeklySummary.totalMinutes}
                  limitMinutes={weeklySummary.limitMinutes}
                  overtimeMinutes={weeklySummary.overtimeMinutes}
                  approvedMinutes={weeklySummary.approvedMinutes}
                  pendingMinutes={weeklySummary.pendingMinutes}
                />
                <MonthlySummaryCard
                  totalMinutes={monthlySummary.totalMinutes}
                  regularMinutes={monthlySummary.regularMinutes}
                  overtimeMinutes={monthlySummary.overtimeMinutes}
                  approvedMinutes={monthlySummary.approvedMinutes}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {canAddOwn && (
                  <ManualTimeEntry
                    onSubmit={addManualEntry}
                    weeklyLimit={weeklySummary.limitMinutes}
                    currentWeekMinutes={weeklySummary.totalMinutes}
                  />
                )}
                {canModifyOwnLimit && currentUser && (
                  <UserWeeklyLimitSetting
                    userId={currentUser.id}
                    userName={worker?.name}
                    tenantId={currentUser.tenant_id}
                    currentLimit={weeklySummary.limitMinutes / 60}
                    onUpdate={refresh}
                  />
                )}
              </div>

              {/* Date navigation */}
              <div className="flex items-center justify-between bg-card border rounded-xl p-4">
                <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {isToday ? "Aujourd'hui" : format(selectedDate, 'EEEE', { locale: fr })}
                  </p>
                  <p className="font-semibold">{format(selectedDate, 'd MMMM yyyy', { locale: fr })}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} disabled={isToday}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Entries list */}
              <div>
                <h3 className="font-semibold mb-3">Entrées du {format(selectedDate, 'd MMMM', { locale: fr })}</h3>
                <TimeEntryList entries={entries} onDelete={deleteEntry} />
              </div>
            </TabsContent>

            {canValidate && (
              <TabsContent value="validation" className="space-y-4">
                <div className="flex justify-end">
                  {canExport && <TimeExportButton entries={adminHook.entries} />}
                </div>
                <AdminValidationPanel
                  entries={adminHook.entries}
                  onApprove={adminHook.approveEntry}
                  onReject={adminHook.rejectEntry}
                  onBulkApprove={adminHook.bulkApprove}
                  isLoading={adminHook.isLoading}
                />
              </TabsContent>
            )}

            {canViewAlerts && (
              <TabsContent value="alerts">
                <HoursAlertsPanel
                  alerts={adminHook.alerts}
                  onAcknowledge={adminHook.acknowledgeAlert}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="space-y-6">
            {/* Weekly and Monthly Summaries */}
            <div className="grid gap-4 md:grid-cols-2">
              <WeeklySummaryCard
                totalMinutes={weeklySummary.totalMinutes}
                limitMinutes={weeklySummary.limitMinutes}
                overtimeMinutes={weeklySummary.overtimeMinutes}
                approvedMinutes={weeklySummary.approvedMinutes}
                pendingMinutes={weeklySummary.pendingMinutes}
              />
              <MonthlySummaryCard
                totalMinutes={monthlySummary.totalMinutes}
                regularMinutes={monthlySummary.regularMinutes}
                overtimeMinutes={monthlySummary.overtimeMinutes}
                approvedMinutes={monthlySummary.approvedMinutes}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {canAddOwn && (
                <ManualTimeEntry
                  onSubmit={addManualEntry}
                  weeklyLimit={weeklySummary.limitMinutes}
                  currentWeekMinutes={weeklySummary.totalMinutes}
                />
              )}
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-between bg-card border rounded-xl p-4">
              <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {isToday ? "Aujourd'hui" : format(selectedDate, 'EEEE', { locale: fr })}
                </p>
                <p className="font-semibold">{format(selectedDate, 'd MMMM yyyy', { locale: fr })}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} disabled={isToday}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Entries list */}
            <div>
              <h3 className="font-semibold mb-3">Entrées du {format(selectedDate, 'd MMMM', { locale: fr })}</h3>
              <TimeEntryList entries={entries} onDelete={deleteEntry} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
