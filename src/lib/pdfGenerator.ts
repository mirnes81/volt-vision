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

interface VoiceNoteTranscription {
  id: number;
  transcription: string;
  createdAt: string;
}

// Colors
const COLORS = {
  primary: [107, 142, 35] as [number, number, number],      // #6B8E23 - ENES green
  primaryDark: [85, 113, 28] as [number, number, number],
  secondary: [55, 65, 81] as [number, number, number],       // Gray-700
  text: [31, 41, 55] as [number, number, number],            // Gray-800
  textLight: [107, 114, 128] as [number, number, number],    // Gray-500
  border: [209, 213, 219] as [number, number, number],       // Gray-300
  bgLight: [249, 250, 251] as [number, number, number],      // Gray-50
  bgSection: [243, 244, 246] as [number, number, number],    // Gray-100
  success: [34, 197, 94] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// Sanitize text for PDF (handle special characters)
function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  
  // Replace problematic characters with safe equivalents
  return text
    .replace(/[\u2018\u2019]/g, "'")  // Smart quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/\u2026/g, '...')        // Ellipsis
    .replace(/\u2013/g, '-')          // En dash
    .replace(/\u2014/g, '--')         // Em dash
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')  // Bullet points
    .replace(/\u00B0/g, 'deg')        // Degree symbol
    .replace(/\u20AC/g, 'EUR')        // Euro
    .replace(/\u00A3/g, 'GBP')        // Pound
    .replace(/\u00A5/g, 'JPY')        // Yen
    .replace(/\u2122/g, 'TM')         // Trademark
    .replace(/\u00AE/g, '(R)')        // Registered
    .replace(/\u00A9/g, '(C)')        // Copyright
    .replace(/[\u2713\u2714\u2705]/g, '[X]')  // Checkmarks
    .replace(/[\u2717\u2718\u274C]/g, '[ ]')  // X marks
    .replace(/\u00B2/g, '2')          // Superscript 2
    .replace(/\u00B3/g, '3')          // Superscript 3
    .replace(/\u00BD/g, '1/2')        // Half
    .replace(/\u00BC/g, '1/4')        // Quarter
    .replace(/\u00BE/g, '3/4');       // Three quarters
}

// Get voice notes transcriptions from localStorage
function getVoiceNotesTranscriptions(interventionId: number): VoiceNoteTranscription[] {
  const transcriptions: VoiceNoteTranscription[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('transcription_')) {
      const noteId = parseInt(key.replace('transcription_', ''));
      const text = localStorage.getItem(key);
      if (text) {
        transcriptions.push({
          id: noteId,
          transcription: text,
          createdAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transcriptions;
}

// Get signature from localStorage or intervention
function getSignatureData(intervention: Intervention): string | null {
  const localSignature = localStorage.getItem(`signature_${intervention.id}`);
  if (localSignature) return localSignature;
  
  if (intervention.signaturePath) {
    if (intervention.signaturePath.startsWith('data:')) {
      return intervention.signaturePath;
    }
    return null;
  }
  
  return null;
}

// Draw rounded rectangle
function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: boolean = true, stroke: boolean = false) {
  doc.roundedRect(x, y, w, h, r, r, fill ? 'F' : stroke ? 'S' : 'FD');
}

// Draw section header
function drawSectionHeader(doc: jsPDF, text: string, y: number, pageWidth: number): number {
  doc.setFillColor(...COLORS.primary);
  drawRoundedRect(doc, 15, y - 5, pageWidth - 30, 10, 2);
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(sanitizeText(text), 20, y + 2);
  
  doc.setTextColor(...COLORS.text);
  return y + 12;
}

// Draw info row
function drawInfoRow(doc: jsPDF, label: string, value: string, y: number, labelWidth: number = 45): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(sanitizeText(label), 20, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(sanitizeText(value || '-'), 20 + labelWidth, y);
  
  return y + 7;
}

export function generateInterventionPDF(intervention: Intervention): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;
  
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  const checkNewPage = (neededSpace: number = 30) => {
    if (y + neededSpace > pageHeight - 25) {
      // Add footer to current page
      addFooter(doc, pageWidth);
      doc.addPage();
      y = 20;
    }
  };
  
  const addFooter = (d: jsPDF, pw: number) => {
    d.setFontSize(8);
    d.setTextColor(...COLORS.textLight);
    d.text('ENES Electricite - www.enes-electricite.ch - Suisse', pw / 2, 287, { align: 'center' });
    d.setDrawColor(...COLORS.border);
    d.line(margin, 283, pw - margin, 283);
  };
  
  // ===== HEADER =====
  // Logo area with green accent
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Company name
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ENES Electricite', pageWidth / 2, 18, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text("Rapport d'intervention", pageWidth / 2, 28, { align: 'center' });
  
  y = 45;
  
  // ===== REFERENCE BOX =====
  doc.setFillColor(...COLORS.bgLight);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, margin, y - 5, contentWidth, 25, 3);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(margin, y - 5, contentWidth, 25, 3, 3, 'S');
  
  // Reference
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(`Ref: ${sanitizeText(intervention.ref)}`, 22, y + 5);
  
  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textLight);
  const dateStr = new Date().toLocaleDateString('fr-CH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  doc.text(sanitizeText(dateStr), pageWidth - margin - 5, y + 5, { align: 'right' });
  
  // Status
  const statusLabels: Record<string, string> = {
    'a_planifier': 'A planifier',
    'en_cours': 'En cours',
    'termine': 'Termine',
    'facture': 'Facture'
  };
  doc.setFontSize(9);
  doc.text(`Statut: ${sanitizeText(statusLabels[intervention.status] || intervention.status)}`, 22, y + 14);
  
  // Type
  const typeLabels: Record<string, string> = {
    'installation': 'Installation',
    'depannage': 'Depannage',
    'renovation': 'Renovation',
    'tableau': 'Tableau electrique',
    'cuisine': 'Cuisine',
    'oibt': 'Controle OIBT'
  };
  doc.text(`Type: ${sanitizeText(typeLabels[intervention.type] || intervention.type)}`, pageWidth / 2, y + 14);
  
  y += 30;
  
  // ===== CLIENT SECTION =====
  y = drawSectionHeader(doc, 'INFORMATIONS CLIENT', y, pageWidth);
  
  doc.setFillColor(...COLORS.bgSection);
  drawRoundedRect(doc, margin, y - 2, contentWidth, 30, 2);
  
  y += 5;
  y = drawInfoRow(doc, 'Client:', intervention.clientName, y);
  y = drawInfoRow(doc, 'Adresse:', intervention.location, y);
  if (intervention.clientPhone) {
    y = drawInfoRow(doc, 'Telephone:', intervention.clientPhone, y);
  }
  if (intervention.clientEmail) {
    y = drawInfoRow(doc, 'Email:', intervention.clientEmail, y);
  }
  
  y += 8;
  
  // ===== DESCRIPTION =====
  checkNewPage(50);
  y = drawSectionHeader(doc, 'DESCRIPTION DES TRAVAUX', y, pageWidth);
  
  doc.setFillColor(...COLORS.bgSection);
  const descText = sanitizeText(intervention.description) || 'Aucune description';
  const descLines = doc.splitTextToSize(descText, contentWidth - 10);
  const descHeight = Math.max(descLines.length * 5 + 10, 20);
  drawRoundedRect(doc, margin, y - 2, contentWidth, descHeight, 2);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(descLines, 20, y + 5);
  
  y += descHeight + 5;
  
  // ===== TASKS =====
  if (intervention.tasks.length > 0) {
    checkNewPage(50);
    y = drawSectionHeader(doc, 'TACHES EFFECTUEES', y, pageWidth);
    
    intervention.tasks.forEach((task, index) => {
      checkNewPage(12);
      
      const bgColor = index % 2 === 0 ? COLORS.bgSection : COLORS.white;
      doc.setFillColor(...bgColor);
      doc.rect(margin, y - 4, contentWidth, 8, 'F');
      
      // Checkbox
      doc.setDrawColor(...COLORS.border);
      doc.rect(20, y - 3, 5, 5, 'S');
      
      if (task.status === 'fait') {
        doc.setFillColor(...COLORS.success);
        doc.rect(21, y - 2, 3, 3, 'F');
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.text);
      doc.text(sanitizeText(task.label), 28, y);
      
      // Status text
      doc.setFontSize(8);
      doc.setTextColor(task.status === 'fait' ? COLORS.success[0] : COLORS.textLight[0], 
                       task.status === 'fait' ? COLORS.success[1] : COLORS.textLight[1],
                       task.status === 'fait' ? COLORS.success[2] : COLORS.textLight[2]);
      doc.text(task.status === 'fait' ? 'Fait' : 'A faire', pageWidth - margin - 5, y, { align: 'right' });
      
      y += 8;
    });
    
    y += 5;
  }
  
  // ===== MATERIALS =====
  if (intervention.materials.length > 0) {
    checkNewPage(50);
    y = drawSectionHeader(doc, 'MATERIEL UTILISE', y, pageWidth);
    
    // Table header
    doc.setFillColor(...COLORS.secondary);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Produit', 20, y);
    doc.text('Qte', pageWidth - margin - 40, y);
    doc.text('Unite', pageWidth - margin - 15, y);
    y += 8;
    
    intervention.materials.forEach((material, index) => {
      checkNewPage(10);
      
      const bgColor = index % 2 === 0 ? COLORS.bgSection : COLORS.white;
      doc.setFillColor(...bgColor);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      
      const productName = sanitizeText(material.productName).substring(0, 50);
      doc.text(productName, 20, y);
      doc.text(String(material.qtyUsed), pageWidth - margin - 40, y);
      doc.text(sanitizeText(material.unit), pageWidth - margin - 15, y);
      
      y += 7;
    });
    
    y += 5;
  }
  
  // ===== HOURS =====
  checkNewPage(40);
  y = drawSectionHeader(doc, 'HEURES TRAVAILLEES', y, pageWidth);
  
  const totalHours = intervention.hours.reduce((acc, h) => acc + (h.durationHours || 0), 0);
  
  doc.setFillColor(...COLORS.bgSection);
  drawRoundedRect(doc, margin, y - 2, contentWidth, 20, 2);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text(`${totalHours.toFixed(1)} heures`, 22, y + 8);
  
  if (intervention.hours.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textLight);
    const workers = [...new Set(intervention.hours.map(h => sanitizeText(h.userName)))].join(', ');
    doc.text(`Technicien(s): ${workers}`, 22, y + 15);
  }
  
  y += 25;
  
  // ===== AI SUMMARY =====
  if (intervention.aiSummary) {
    checkNewPage(50);
    y = drawSectionHeader(doc, 'RESUME AUTOMATIQUE', y, pageWidth);
    
    doc.setFillColor(255, 251, 235); // Warm yellow bg
    const summaryText = sanitizeText(intervention.aiSummary);
    const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 10);
    const summaryHeight = summaryLines.length * 5 + 10;
    drawRoundedRect(doc, margin, y - 2, contentWidth, summaryHeight, 2);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text(summaryLines, 20, y + 5);
    
    y += summaryHeight + 5;
  }
  
  // ===== VOICE NOTES =====
  const transcriptions = getVoiceNotesTranscriptions(intervention.id);
  if (transcriptions.length > 0) {
    checkNewPage(50);
    y = drawSectionHeader(doc, 'NOTES VOCALES TRANSCRITES', y, pageWidth);
    
    transcriptions.forEach((note, index) => {
      checkNewPage(30);
      
      doc.setFillColor(...COLORS.bgSection);
      const noteText = sanitizeText(note.transcription);
      const noteLines = doc.splitTextToSize(noteText, contentWidth - 20);
      const noteHeight = noteLines.length * 5 + 12;
      drawRoundedRect(doc, margin, y - 2, contentWidth, noteHeight, 2);
      
      // Note number badge
      doc.setFillColor(...COLORS.primary);
      doc.circle(22, y + 4, 4, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(String(index + 1), 22, y + 5.5, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.text);
      doc.text(noteLines, 30, y + 5);
      
      y += noteHeight + 3;
    });
    
    y += 5;
  }
  
  // ===== TECHNICIAN NOTES =====
  const interventionNotes = localStorage.getItem(`intervention_notes_${intervention.id}`);
  if (interventionNotes) {
    checkNewPage(50);
    y = drawSectionHeader(doc, 'NOTES DU TECHNICIEN', y, pageWidth);
    
    doc.setFillColor(...COLORS.bgSection);
    const notesText = sanitizeText(interventionNotes);
    const notesLines = doc.splitTextToSize(notesText, contentWidth - 10);
    const notesHeight = notesLines.length * 5 + 10;
    drawRoundedRect(doc, margin, y - 2, contentWidth, notesHeight, 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text(notesLines, 20, y + 5);
    
    y += notesHeight + 5;
  }
  
  // ===== SIGNATURES =====
  checkNewPage(80);
  y = drawSectionHeader(doc, 'SIGNATURES', y, pageWidth);
  
  const signatureData = getSignatureData(intervention);
  
  // Two column layout for signatures
  const colWidth = (contentWidth - 10) / 2;
  
  // Client signature box
  doc.setFillColor(...COLORS.bgSection);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, margin, y, colWidth, 55, 3);
  doc.roundedRect(margin, y, colWidth, 55, 3, 3, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Signature client', margin + 5, y + 8);
  
  if (signatureData) {
    try {
      doc.addImage(signatureData, 'PNG', margin + 5, y + 12, colWidth - 10, 35);
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.textLight);
      doc.text('[Signature enregistree]', margin + 10, y + 30);
    }
  } else {
    doc.setDrawColor(...COLORS.border);
    doc.line(margin + 10, y + 45, margin + colWidth - 10, y + 45);
  }
  
  // Technician signature box
  const techX = margin + colWidth + 10;
  doc.setFillColor(...COLORS.bgSection);
  drawRoundedRect(doc, techX, y, colWidth, 55, 3);
  doc.roundedRect(techX, y, colWidth, 55, 3, 3, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Signature technicien', techX + 5, y + 8);
  
  doc.setDrawColor(...COLORS.border);
  doc.line(techX + 10, y + 45, techX + colWidth - 10, y + 45);
  
  // Add footer
  addFooter(doc, pageWidth);
  
  // Save
  doc.save(`intervention_${intervention.ref}.pdf`);
}

export function generateOIBTPDF(intervention: Intervention, oibtData: OIBTData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = 15;
  
  // ===== HEADER =====
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ENES Electricite', pageWidth / 2, 16, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Proces-verbal de controle OIBT', pageWidth / 2, 26, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(Ordonnance sur les installations a basse tension)', pageWidth / 2, 32, { align: 'center' });
  
  y = 45;
  
  // Reference box
  doc.setFillColor(...COLORS.bgLight);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, margin, y - 5, contentWidth, 15, 3);
  doc.roundedRect(margin, y - 5, contentWidth, 15, 3, 3, 'S');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(`N deg PV: OIBT-${sanitizeText(intervention.ref)}`, 22, y + 3);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textLight);
  doc.text(`Date: ${new Date().toLocaleDateString('fr-CH')}`, pageWidth - margin - 5, y + 3, { align: 'right' });
  
  y += 20;
  
  // Installation info
  y = drawSectionHeader(doc, "DONNEES DE L'INSTALLATION", y, pageWidth);
  
  doc.setFillColor(...COLORS.bgSection);
  drawRoundedRect(doc, margin, y - 2, contentWidth, 28, 2);
  
  y += 5;
  y = drawInfoRow(doc, 'Client:', intervention.clientName, y);
  y = drawInfoRow(doc, 'Adresse:', intervention.location, y);
  y = drawInfoRow(doc, 'Travaux:', intervention.label, y);
  
  y += 8;
  
  // Measurements
  y = drawSectionHeader(doc, 'MESURES EFFECTUEES', y, pageWidth);
  
  // Table header
  doc.setFillColor(...COLORS.secondary);
  doc.rect(margin, y - 4, contentWidth * 0.5, 8, 'F');
  doc.rect(margin + contentWidth * 0.5, y - 4, contentWidth * 0.25, 8, 'F');
  doc.rect(margin + contentWidth * 0.75, y - 4, contentWidth * 0.25, 8, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Mesure', margin + 5, y);
  doc.text('Valeur', margin + contentWidth * 0.5 + 5, y);
  doc.text('Resultat', margin + contentWidth * 0.75 + 5, y);
  y += 8;
  
  const measurements = [
    { label: "Resistance d'isolation (RISO)", value: `${oibtData.isolation} MOhm`, ok: parseFloat(oibtData.isolation) >= 0.5 },
    { label: 'Continuite PE', value: `${oibtData.continuity} Ohm`, ok: parseFloat(oibtData.continuity) <= 1 },
    { label: 'Temps declenchement diff. 30mA', value: `${oibtData.differential} ms`, ok: parseFloat(oibtData.differential) <= 300 },
    { label: 'Tension reseau', value: `${oibtData.voltage} V`, ok: parseFloat(oibtData.voltage) >= 220 && parseFloat(oibtData.voltage) <= 240 },
  ];
  
  measurements.forEach((m, i) => {
    const bgColor = i % 2 === 0 ? COLORS.bgSection : COLORS.white;
    doc.setFillColor(...bgColor);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(m.label, margin + 5, y);
    doc.text(m.value, margin + contentWidth * 0.5 + 5, y);
    
    if (m.ok) {
      doc.setTextColor(...COLORS.success);
      doc.text('OK', margin + contentWidth * 0.75 + 5, y);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text('NOK', margin + contentWidth * 0.75 + 5, y);
    }
    
    y += 8;
  });
  
  y += 10;
  
  // Global result
  doc.setFillColor(...COLORS.bgLight);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, margin, y - 5, contentWidth, 20, 3);
  doc.roundedRect(margin, y - 5, contentWidth, 20, 3, 3, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Resultat global:', margin + 10, y + 5);
  
  if (oibtData.result === 'ok') {
    doc.setTextColor(...COLORS.success);
    doc.text('CONFORME', margin + 60, y + 5);
  } else if (oibtData.result === 'nok') {
    doc.setTextColor(239, 68, 68);
    doc.text('NON CONFORME', margin + 60, y + 5);
  } else {
    doc.setTextColor(245, 158, 11);
    doc.text('AVEC RESERVES', margin + 60, y + 5);
  }
  
  y += 25;
  
  // Comments
  if (oibtData.comments) {
    y = drawSectionHeader(doc, 'OBSERVATIONS', y, pageWidth);
    
    doc.setFillColor(...COLORS.bgSection);
    const commentText = sanitizeText(oibtData.comments);
    const commentLines = doc.splitTextToSize(commentText, contentWidth - 10);
    const commentHeight = commentLines.length * 5 + 10;
    drawRoundedRect(doc, margin, y - 2, contentWidth, commentHeight, 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text(commentLines, margin + 5, y + 5);
    
    y += commentHeight + 5;
  }
  
  // Signatures
  y = Math.max(y + 10, 200);
  y = drawSectionHeader(doc, 'SIGNATURES', y, pageWidth);
  
  const colWidth = (contentWidth - 10) / 2;
  
  // Installer signature
  doc.setFillColor(...COLORS.bgSection);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, margin, y, colWidth, 45, 3);
  doc.roundedRect(margin, y, colWidth, 45, 3, 3, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Installateur-electricien', margin + 5, y + 8);
  doc.line(margin + 10, y + 35, margin + colWidth - 10, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text('(nom, date, signature)', margin + 5, y + 41);
  
  // Owner signature
  const techX = margin + colWidth + 10;
  doc.setFillColor(...COLORS.bgSection);
  drawRoundedRect(doc, techX, y, colWidth, 45, 3);
  doc.roundedRect(techX, y, colWidth, 45, 3, 3, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Proprietaire/Exploitant', techX + 5, y + 8);
  doc.line(techX + 10, y + 35, techX + colWidth - 10, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text('(nom, date, signature)', techX + 5, y + 41);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text('Document genere selon OIBT/NIBT - ENES Electricite - Suisse', pageWidth / 2, 287, { align: 'center' });
  doc.setDrawColor(...COLORS.border);
  doc.line(margin, 283, pageWidth - margin, 283);
  
  doc.save(`OIBT_${intervention.ref}.pdf`);
}
