import jsPDF from 'jspdf';
import { Intervention } from '@/types/intervention';

interface OIBTData {
  isolation: string;
  continuity: string;
  differential: string;
  voltage: string;
  result: 'ok' | 'nok' | 'reserve';
  comments: string;
}

export function generateInterventionPDF(intervention: Intervention): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MV3 PRO Électricien', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(16);
  doc.text('Rapport d\'intervention', pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  // Reference
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Référence: ${intervention.ref}`, 20, y);
  y += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('fr-CH')}`, 20, y);
  y += 15;
  
  // Client info
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(intervention.clientName, 50, y);
  y += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Lieu:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(intervention.location, 50, y);
  y += 15;
  
  // Description
  doc.setFont('helvetica', 'bold');
  doc.text('Description des travaux:', 20, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(intervention.description || 'N/A', pageWidth - 40);
  doc.text(descLines, 20, y);
  y += descLines.length * 6 + 10;
  
  // Tasks
  doc.setFont('helvetica', 'bold');
  doc.text('Tâches effectuées:', 20, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  
  intervention.tasks.forEach(task => {
    const status = task.status === 'fait' ? '✓' : '○';
    doc.text(`${status} ${task.label}`, 25, y);
    y += 6;
  });
  y += 5;
  
  // Materials
  if (intervention.materials.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Matériel utilisé:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    intervention.materials.forEach(material => {
      doc.text(`- ${material.qtyUsed} ${material.unit} ${material.productName}`, 25, y);
      y += 6;
    });
    y += 5;
  }
  
  // Hours
  const totalHours = intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Heures travaillées: ${totalHours.toFixed(1)}h`, 20, y);
  y += 15;
  
  // AI Summary if available
  if (intervention.aiSummary) {
    doc.setFont('helvetica', 'bold');
    doc.text('Résumé:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(intervention.aiSummary, pageWidth - 40);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 6 + 10;
  }
  
  // Signature space
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  
  y = Math.max(y, 250);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature client:', 20, y);
  doc.line(20, y + 20, 90, y + 20);
  
  doc.text('Signature technicien:', 110, y);
  doc.line(110, y + 20, 180, y + 20);
  
  // Footer
  doc.setFontSize(8);
  doc.text('MV3 PRO Électricien - Suisse', pageWidth / 2, 290, { align: 'center' });
  
  // Save
  doc.save(`intervention_${intervention.ref}.pdf`);
}

export function generateOIBTPDF(intervention: Intervention, oibtData: OIBTData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MV3 PRO Électricien', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(16);
  doc.text('Procès-verbal de contrôle OIBT', pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('(Ordonnance sur les installations à basse tension)', pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  // Reference and date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`N° PV: OIBT-${intervention.ref}`, 20, y);
  doc.text(`Date: ${new Date().toLocaleDateString('fr-CH')}`, 130, y);
  y += 15;
  
  // Installation info
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 5, pageWidth - 30, 35, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('Données de l\'installation', 20, y);
  y += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Client: ${intervention.clientName}`, 20, y);
  y += 6;
  doc.text(`Adresse: ${intervention.location}`, 20, y);
  y += 6;
  doc.text(`Type de travaux: ${intervention.label}`, 20, y);
  y += 15;
  
  // Measurements
  doc.setFont('helvetica', 'bold');
  doc.text('Mesures effectuées', 20, y);
  y += 10;
  
  // Table header
  doc.setFillColor(37, 99, 235);
  doc.setTextColor(255, 255, 255);
  doc.rect(20, y - 5, 80, 8, 'F');
  doc.rect(100, y - 5, 40, 8, 'F');
  doc.rect(140, y - 5, 40, 8, 'F');
  
  doc.setFontSize(10);
  doc.text('Mesure', 25, y);
  doc.text('Valeur', 105, y);
  doc.text('Résultat', 145, y);
  y += 8;
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  // Measurements rows
  const measurements = [
    { label: 'Résistance d\'isolation (RISO)', value: `${oibtData.isolation} MΩ`, ok: parseFloat(oibtData.isolation) >= 0.5 },
    { label: 'Continuité PE', value: `${oibtData.continuity} Ω`, ok: parseFloat(oibtData.continuity) <= 1 },
    { label: 'Temps déclenchement diff. 30mA', value: `${oibtData.differential} ms`, ok: parseFloat(oibtData.differential) <= 300 },
    { label: 'Tension réseau', value: `${oibtData.voltage} V`, ok: parseFloat(oibtData.voltage) >= 220 && parseFloat(oibtData.voltage) <= 240 },
  ];
  
  measurements.forEach((m, i) => {
    const bgColor = i % 2 === 0 ? 250 : 255;
    doc.setFillColor(bgColor, bgColor, bgColor);
    doc.rect(20, y - 4, 160, 8, 'F');
    
    doc.text(m.label, 25, y);
    doc.text(m.value, 105, y);
    
    if (m.ok) {
      doc.setTextColor(34, 197, 94);
      doc.text('OK', 150, y);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text('NOK', 150, y);
    }
    doc.setTextColor(0, 0, 0);
    y += 8;
  });
  
  y += 10;
  
  // Global result
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 5, pageWidth - 30, 20, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Résultat global:', 20, y + 5);
  
  if (oibtData.result === 'ok') {
    doc.setTextColor(34, 197, 94);
    doc.text('CONFORME', 80, y + 5);
  } else if (oibtData.result === 'nok') {
    doc.setTextColor(239, 68, 68);
    doc.text('NON CONFORME', 80, y + 5);
  } else {
    doc.setTextColor(245, 158, 11);
    doc.text('AVEC RÉSERVES', 80, y + 5);
  }
  doc.setTextColor(0, 0, 0);
  y += 25;
  
  // Comments
  if (oibtData.comments) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Observations:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    const commentLines = doc.splitTextToSize(oibtData.comments, pageWidth - 40);
    doc.text(commentLines, 20, y);
    y += commentLines.length * 6 + 10;
  }
  
  // Signatures
  y = Math.max(y + 10, 220);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', 20, y);
  y += 15;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Installateur-électricien:', 20, y);
  doc.line(20, y + 20, 90, y + 20);
  doc.text('(nom, date, signature)', 20, y + 25);
  
  doc.text('Propriétaire/Exploitant:', 110, y);
  doc.line(110, y + 20, 180, y + 20);
  doc.text('(nom, date, signature)', 110, y + 25);
  
  // Footer
  doc.setFontSize(8);
  doc.text('Document généré selon OIBT/NIBT - MV3 PRO Électricien - Suisse', pageWidth / 2, 290, { align: 'center' });
  
  // Save
  doc.save(`OIBT_${intervention.ref}.pdf`);
}
