import * as React from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, addMonths, subWeeks, addWeeks, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock, ChevronLeft, ChevronRight, Filter, Download, Users,
  Calendar as CalendarIcon, Printer, Search, ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type ViewMode = 'day' | 'week' | 'month';
type SortField = 'date' | 'worker' | 'hours';
type SortDir = 'asc' | 'desc';

interface HourEntry {
  id: string;
  user_id: string;
  user_name: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  intervention_ref: string | null;
  intervention_id: number | null;
  work_type: string | null;
  comment: string | null;
  status: string;
  is_overtime: boolean | null;
}

interface WorkerSummary {
  user_id: string;
  user_name: string;
  totalMinutes: number;
  overtimeMinutes: number;
  entryCount: number;
  days: number;
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function AdminHoursPage() {
  const { worker } = useAuth();
  const [entries, setEntries] = React.useState<HourEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [workerFilter, setWorkerFilter] = React.useState<string>('all');
  const [sortField, setSortField] = React.useState<SortField>('date');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  // Compute date range
  const dateRange = React.useMemo(() => {
    switch (viewMode) {
      case 'day':
        return {
          start: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
          end: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        };
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
    }
  }, [viewMode, currentDate]);

  const dateLabel = React.useMemo(() => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
      case 'week':
        return `${format(dateRange.start, 'd MMM', { locale: fr })} — ${format(dateRange.end, 'd MMM yyyy', { locale: fr })}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: fr });
    }
  }, [viewMode, currentDate, dateRange]);

  // Navigate
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    switch (viewMode) {
      case 'day': d.setDate(d.getDate() + dir); break;
      case 'week': dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1); d.setDate(d.getDate() + dir * 7); break;
      case 'month': dir > 0 ? setCurrentDate(addMonths(d, 1)) : setCurrentDate(subMonths(d, 1)); return;
    }
    setCurrentDate(d);
  };

  // Fetch entries
  React.useEffect(() => {
    async function fetchEntries() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('work_time_entries')
          .select('id, user_id, user_name, clock_in, clock_out, duration_minutes, intervention_ref, intervention_id, work_type, comment, status, is_overtime')
          .eq('tenant_id', TENANT_ID)
          .gte('clock_in', dateRange.start.toISOString())
          .lte('clock_in', dateRange.end.toISOString())
          .order('clock_in', { ascending: false });

        if (error) throw error;
        setEntries((data || []) as HourEntry[]);
      } catch (err) {
        console.error('Error fetching hours:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEntries();
  }, [dateRange]);

  // Unique workers
  const workers = React.useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => {
      if (e.user_name && !map.has(e.user_id)) {
        map.set(e.user_id, e.user_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  // Filtered & sorted entries
  const filteredEntries = React.useMemo(() => {
    let result = entries.filter(e => {
      if (workerFilter !== 'all' && e.user_id !== workerFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = (e.user_name || '').toLowerCase().includes(q) ||
          (e.intervention_ref || '').toLowerCase().includes(q) ||
          (e.comment || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(); break;
        case 'worker': cmp = (a.user_name || '').localeCompare(b.user_name || ''); break;
        case 'hours': cmp = (a.duration_minutes || 0) - (b.duration_minutes || 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [entries, workerFilter, searchQuery, sortField, sortDir]);

  // Worker summaries
  const workerSummaries = React.useMemo((): WorkerSummary[] => {
    const map = new Map<string, WorkerSummary>();
    filteredEntries.forEach(e => {
      const existing = map.get(e.user_id) || {
        user_id: e.user_id,
        user_name: e.user_name || 'Inconnu',
        totalMinutes: 0,
        overtimeMinutes: 0,
        entryCount: 0,
        days: 0,
      };
      existing.totalMinutes += e.duration_minutes || 0;
      if (e.is_overtime) existing.overtimeMinutes += e.duration_minutes || 0;
      existing.entryCount += 1;
      map.set(e.user_id, existing);
    });

    // Count unique days per worker
    map.forEach((summary, userId) => {
      const uniqueDays = new Set(
        filteredEntries.filter(e => e.user_id === userId).map(e => format(new Date(e.clock_in), 'yyyy-MM-dd'))
      );
      summary.days = uniqueDays.size;
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries]);

  const totalMinutes = workerSummaries.reduce((s, w) => s + w.totalMinutes, 0);
  const totalOvertime = workerSummaries.reduce((s, w) => s + w.overtimeMinutes, 0);

  const fmtH = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    // Header
    doc.setFillColor(107, 142, 35);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport des heures', margin, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1), margin, 24);
    doc.text(`Genere le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 24, { align: 'right' });
    y = 40;

    // Summary
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resume', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total heures: ${fmtH(totalMinutes)}`, margin, y);
    doc.text(`Heures supp.: ${fmtH(totalOvertime)}`, margin + 60, y);
    doc.text(`Ouvriers: ${workerSummaries.length}`, margin + 120, y);
    y += 10;

    // Worker summary table
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Ouvrier', margin + 2, y + 5.5);
    doc.text('Jours', margin + 72, y + 5.5);
    doc.text('Entrees', margin + 92, y + 5.5);
    doc.text('Heures', margin + 116, y + 5.5);
    doc.text('Supp.', margin + 140, y + 5.5);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    workerSummaries.forEach((ws) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.text(ws.user_name.substring(0, 35), margin + 2, y + 4);
      doc.text(String(ws.days), margin + 72, y + 4);
      doc.text(String(ws.entryCount), margin + 92, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(fmtH(ws.totalMinutes), margin + 116, y + 4);
      doc.setFont('helvetica', 'normal');
      if (ws.overtimeMinutes > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(fmtH(ws.overtimeMinutes), margin + 140, y + 4);
        doc.setTextColor(31, 41, 55);
      } else {
        doc.text('—', margin + 140, y + 4);
      }
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      y += 9;
    });

    y += 6;

    // Detail table
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Detail des heures', margin, y);
    y += 8;

    // Table header
    doc.setFillColor(107, 142, 35);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Date', margin + 2, y + 5.5);
    doc.text('Ouvrier', margin + 28, y + 5.5);
    doc.text('Debut', margin + 72, y + 5.5);
    doc.text('Fin', margin + 92, y + 5.5);
    doc.text('Duree', margin + 112, y + 5.5);
    doc.text('Ref.', margin + 134, y + 5.5);
    doc.text('Statut', margin + 158, y + 5.5);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(7);

    filteredEntries.forEach((entry, i) => {
      if (y > 280) { doc.addPage(); y = 14; }
      
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 2, pageWidth - margin * 2, 8, 'F');
      }

      const clockIn = new Date(entry.clock_in);
      const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;

      doc.text(format(clockIn, 'dd/MM/yy'), margin + 2, y + 4);
      doc.text((entry.user_name || '').substring(0, 20), margin + 28, y + 4);
      doc.text(format(clockIn, 'HH:mm'), margin + 72, y + 4);
      doc.text(clockOut ? format(clockOut, 'HH:mm') : '—', margin + 92, y + 4);
      
      doc.setFont('helvetica', 'bold');
      doc.text(entry.duration_minutes ? fmtH(entry.duration_minutes) : '—', margin + 112, y + 4);
      doc.setFont('helvetica', 'normal');
      
      doc.text((entry.intervention_ref || '').substring(0, 12), margin + 134, y + 4);
      
      const statusLabel = entry.status === 'approved' ? 'OK' : entry.status === 'rejected' ? 'Refuse' : 'En att.';
      if (entry.status === 'approved') doc.setTextColor(34, 197, 94);
      else if (entry.status === 'rejected') doc.setTextColor(220, 38, 38);
      else doc.setTextColor(107, 114, 128);
      doc.text(statusLabel, margin + 158, y + 4);
      doc.setTextColor(31, 41, 55);

      y += 8;
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      doc.text('ENES Electricite SA - Rapport genere automatiquement', margin, doc.internal.pageSize.getHeight() - 8);
    }

    const fileName = `heures_${viewMode}_${format(dateRange.start, 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  const isAdmin = React.useMemo(() => {
    try {
      const workerData = localStorage.getItem('mv3_worker');
      if (!workerData) return false;
      const w = JSON.parse(workerData);
      return w?.admin === '1' || w?.admin === 1 || w?.isAdmin === true;
    } catch { return false; }
  }, []);

  if (!isAdmin) {
    return (
      <div className="pb-24">
        <Header title="Heures - Admin" showBack />
        <div className="px-4 pt-8 text-center">
          <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <Header title="Tableau des heures" showBack />

      <div className="px-3 pt-3 space-y-3">
        {/* View mode selector */}
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(mode)}
              className="text-xs"
            >
              {mode === 'day' ? 'Jour' : mode === 'week' ? 'Semaine' : 'Mois'}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between bg-card border border-border/50 rounded-xl p-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm capitalize">{dateLabel}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
          <Select value={workerFilter} onValueChange={setWorkerFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Tous les ouvriers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les ouvriers</SelectItem>
              {workers.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <p className="text-lg font-bold text-primary">{fmtH(totalMinutes)}</p>
            <p className="text-[10px] text-muted-foreground">Total heures</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <p className="text-lg font-bold text-destructive">{fmtH(totalOvertime)}</p>
            <p className="text-[10px] text-muted-foreground">Heures supp.</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <p className="text-lg font-bold">{workerSummaries.length}</p>
            <p className="text-[10px] text-muted-foreground">Ouvriers</p>
          </div>
        </div>

        {/* Worker summary */}
        {workerSummaries.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Résumé par ouvrier
              </h3>
            </div>
            <div className="divide-y divide-border/30">
              {workerSummaries.map(ws => (
                <div key={ws.user_id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ws.user_name}</p>
                    <p className="text-[10px] text-muted-foreground">{ws.days} jour(s) • {ws.entryCount} entrée(s)</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ws.overtimeMinutes > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        +{fmtH(ws.overtimeMinutes)}
                      </Badge>
                    )}
                    <span className="text-sm font-bold text-primary">{fmtH(ws.totalMinutes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail table */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 bg-muted/30 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Détail ({filteredEntries.length} entrées)
            </h3>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-3 py-2 border-b border-border/30 bg-muted/20 text-[10px] font-semibold text-muted-foreground uppercase">
            <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-left">
              Date {sortField === 'date' && <ArrowUpDown className="w-2.5 h-2.5" />}
            </button>
            <button onClick={() => toggleSort('worker')} className="flex items-center gap-1 w-24">
              Ouvrier {sortField === 'worker' && <ArrowUpDown className="w-2.5 h-2.5" />}
            </button>
            <button onClick={() => toggleSort('hours')} className="flex items-center gap-1 w-14 justify-end">
              Durée {sortField === 'hours' && <ArrowUpDown className="w-2.5 h-2.5" />}
            </button>
            <div className="w-12 text-right">Statut</div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune entrée pour cette période
            </div>
          ) : (
            <div className="divide-y divide-border/20 max-h-[50vh] overflow-y-auto">
              {filteredEntries.map((entry, i) => {
                const clockIn = new Date(entry.clock_in);
                const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] gap-1 px-3 py-2.5 items-center",
                      i % 2 === 0 && "bg-muted/10",
                      entry.is_overtime && "border-l-2 border-l-destructive"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {format(clockIn, 'EEE dd/MM', { locale: fr })}
                        <span className="text-muted-foreground ml-1.5">
                          {format(clockIn, 'HH:mm')} — {clockOut ? format(clockOut, 'HH:mm') : '...'}
                        </span>
                      </p>
                      {(entry.intervention_ref || entry.comment) && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {entry.intervention_ref && <span className="font-medium text-primary">{entry.intervention_ref}</span>}
                          {entry.intervention_ref && entry.comment && ' • '}
                          {entry.comment}
                        </p>
                      )}
                    </div>
                    <div className="w-24 truncate text-xs text-right">{entry.user_name}</div>
                    <div className="w-14 text-right">
                      <span className="text-xs font-bold">
                        {entry.duration_minutes ? fmtH(entry.duration_minutes) : '—'}
                      </span>
                    </div>
                    <div className="w-12 text-right">
                      <Badge
                        variant={entry.status === 'approved' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-[9px] px-1 py-0"
                      >
                        {entry.status === 'approved' ? 'OK' : entry.status === 'rejected' ? 'Refusé' : 'Att.'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
