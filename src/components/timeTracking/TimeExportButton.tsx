import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { WorkTimeEntry, WORK_TYPES } from '@/types/timeTracking';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface TimeExportButtonProps {
  entries: WorkTimeEntry[];
  dateRange?: { start: Date; end: Date };
}

export function TimeExportButton({ entries, dateRange }: TimeExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['Date', 'Utilisateur', 'Type', 'Entrée', 'Sortie', 'Durée', 'Statut', 'Intervention', 'Commentaire'];
      
      const rows = entries.map(entry => [
        format(new Date(entry.clock_in), 'dd/MM/yyyy'),
        entry.user_name || '',
        WORK_TYPES.find(t => t.value === entry.work_type)?.label || entry.work_type,
        format(new Date(entry.clock_in), 'HH:mm'),
        entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '',
        formatDuration(entry.duration_minutes),
        entry.status === 'approved' ? 'Approuvé' : entry.status === 'rejected' ? 'Rejeté' : 'En attente',
        entry.intervention_ref || '',
        entry.comment || '',
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `heures_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Title
      doc.setFontSize(18);
      doc.text('Rapport des heures travaillées', pageWidth / 2, 20, { align: 'center' });

      // Date range
      doc.setFontSize(10);
      const rangeText = dateRange
        ? `Du ${format(dateRange.start, 'd MMMM yyyy', { locale: fr })} au ${format(dateRange.end, 'd MMMM yyyy', { locale: fr })}`
        : `Généré le ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`;
      doc.text(rangeText, pageWidth / 2, 28, { align: 'center' });

      // Summary
      const totalMinutes = entries.reduce((acc, e) => acc + (e.duration_minutes || 0), 0);
      const approvedMinutes = entries.filter(e => e.status === 'approved').reduce((acc, e) => acc + (e.duration_minutes || 0), 0);

      doc.setFontSize(12);
      doc.text(`Total: ${formatDuration(totalMinutes)} | Approuvé: ${formatDuration(approvedMinutes)} | Entrées: ${entries.length}`, pageWidth / 2, 38, { align: 'center' });

      // Table header
      let y = 50;
      doc.setFillColor(240, 240, 240);
      doc.rect(10, y, pageWidth - 20, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 12, y + 5.5);
      doc.text('Utilisateur', 35, y + 5.5);
      doc.text('Type', 75, y + 5.5);
      doc.text('Entrée', 105, y + 5.5);
      doc.text('Sortie', 125, y + 5.5);
      doc.text('Durée', 145, y + 5.5);
      doc.text('Statut', 165, y + 5.5);
      doc.text('Int.', 190, y + 5.5);

      // Table rows
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      entries.forEach((entry, index) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(10, y - 4, pageWidth - 20, 7, 'F');
        }

        doc.text(format(new Date(entry.clock_in), 'dd/MM/yy'), 12, y);
        doc.text((entry.user_name || '').substring(0, 18), 35, y);
        doc.text((WORK_TYPES.find(t => t.value === entry.work_type)?.label || '').substring(0, 12), 75, y);
        doc.text(format(new Date(entry.clock_in), 'HH:mm'), 105, y);
        doc.text(entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '--:--', 125, y);
        doc.text(formatDuration(entry.duration_minutes), 145, y);
        
        const statusText = entry.status === 'approved' ? 'OK' : entry.status === 'rejected' ? 'NOK' : '...';
        doc.text(statusText, 165, y);
        
        doc.text((entry.intervention_ref || '').substring(0, 8), 190, y);

        y += 7;
      });

      doc.save(`heures_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting || entries.length === 0}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export Excel/CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
