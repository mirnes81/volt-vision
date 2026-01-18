import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ClockInOutButton } from '@/components/timeTracking/ClockInOutButton';
import { TimeEntryList } from '@/components/timeTracking/TimeEntryList';
import { AdminValidationPanel } from '@/components/timeTracking/AdminValidationPanel';
import { HoursAlertsPanel } from '@/components/timeTracking/HoursAlertsPanel';
import { TimeExportButton } from '@/components/timeTracking/TimeExportButton';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { useTimeTrackingAdmin } from '@/hooks/useTimeTrackingAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function TimeTrackingPage() {
  const { worker } = useAuth();
  const isAdmin = worker?.isAdmin;
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  
  const { entries, deleteEntry, isLoading } = useTimeTracking({ date: selectedDate });
  const adminHook = useTimeTrackingAdmin();

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="pb-24">
      <Header title="Suivi des heures" />

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
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

        {isAdmin ? (
          <Tabs defaultValue="my-time" className="space-y-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="my-time" className="gap-2">
                <Clock className="w-4 h-4" />
                Mon pointage
              </TabsTrigger>
              <TabsTrigger value="validation" className="gap-2">
                Validation
                {adminHook.entries.filter(e => e.status === 'pending' && e.clock_out).length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {adminHook.entries.filter(e => e.status === 'pending' && e.clock_out).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alertes
                {adminHook.alerts.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{adminHook.alerts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-time" className="space-y-6">
              {isToday && <ClockInOutButton />}
              <div>
                <h3 className="font-semibold mb-3">Mes entrées du jour</h3>
                <TimeEntryList entries={entries} onDelete={deleteEntry} />
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <div className="flex justify-end">
                <TimeExportButton entries={adminHook.entries} />
              </div>
              <AdminValidationPanel
                entries={adminHook.entries}
                onApprove={adminHook.approveEntry}
                onReject={adminHook.rejectEntry}
                onBulkApprove={adminHook.bulkApprove}
                isLoading={adminHook.isLoading}
              />
            </TabsContent>

            <TabsContent value="alerts">
              <HoursAlertsPanel
                alerts={adminHook.alerts}
                onAcknowledge={adminHook.acknowledgeAlert}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {isToday && <ClockInOutButton />}
            <div>
              <h3 className="font-semibold mb-3">Mes entrées du jour</h3>
              <TimeEntryList entries={entries} onDelete={deleteEntry} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
