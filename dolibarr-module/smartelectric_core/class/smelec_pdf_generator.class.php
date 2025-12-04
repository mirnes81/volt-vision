<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Générateur PDF pour interventions et rapports OIBT
 */

require_once DOL_DOCUMENT_ROOT.'/core/lib/pdf.lib.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/company.lib.php';

/**
 * Class SmelecPdfGenerator
 * Génère les rapports PDF pour SmartElectric
 */
class SmelecPdfGenerator
{
    public $db;
    public $emetteur;

    /**
     * Constructor
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        global $conf, $mysoc;
        
        $this->db = $db;
        $this->emetteur = $mysoc;
    }

    /**
     * Generate intervention PDF report
     * @param int $intervention_id Intervention ID
     * @return int 1 if OK, -1 if error
     */
    public function generateInterventionPdf($intervention_id)
    {
        global $conf, $langs;
        
        require_once './class/smelec_intervention.class.php';
        
        $intervention = new SmelecIntervention($this->db);
        $intervention->fetch($intervention_id);
        $intervention->fetchLines();
        
        // Load client
        require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
        $client = new Societe($this->db);
        $client->fetch($intervention->fk_soc);
        
        // Create PDF
        $pdf = pdf_getInstance();
        $pdf->SetCreator('SmartElectric Suite');
        $pdf->SetAuthor($this->emetteur->name);
        $pdf->SetTitle('Rapport Intervention '.$intervention->ref);
        
        $pdf->AddPage();
        
        // Header with logo
        $this->_pageHeader($pdf, 'RAPPORT D\'INTERVENTION');
        
        $y = 45;
        
        // Intervention info box
        $pdf->SetFillColor(245, 247, 250);
        $pdf->RoundedRect(10, $y, 190, 35, 3, '1111', 'F');
        
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(15, $y + 3);
        $pdf->Cell(90, 6, 'Référence: '.$intervention->ref, 0, 0);
        
        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetXY(105, $y + 3);
        $pdf->Cell(90, 6, 'Date: '.dol_print_date($intervention->date_creation, 'day'), 0, 1);
        
        $pdf->SetXY(15, $y + 10);
        $pdf->Cell(90, 6, 'Type: '.ucfirst($intervention->type), 0, 0);
        
        $statusLabels = array(0 => 'À planifier', 1 => 'En cours', 2 => 'Terminé', 3 => 'Facturé');
        $pdf->SetXY(105, $y + 10);
        $pdf->Cell(90, 6, 'Statut: '.$statusLabels[$intervention->status], 0, 1);
        
        $pdf->SetXY(15, $y + 17);
        $pdf->Cell(180, 6, 'Client: '.$client->name, 0, 1);
        
        $pdf->SetXY(15, $y + 24);
        $pdf->Cell(180, 6, 'Adresse: '.$intervention->location, 0, 1);
        
        $y += 42;
        
        // Description
        if ($intervention->description) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Description', 0, 1);
            
            $pdf->SetFont('helvetica', '', 10);
            $pdf->SetXY(10, $y + 8);
            $pdf->MultiCell(190, 5, strip_tags($intervention->description), 0, 'L');
            $y = $pdf->GetY() + 5;
        }
        
        // Tasks checklist
        if (!empty($intervention->tasks)) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Checklist', 0, 1);
            $y += 8;
            
            $pdf->SetFont('helvetica', '', 10);
            foreach ($intervention->tasks as $task) {
                $checkbox = $task['status'] === 'fait' ? '☑' : '☐';
                $pdf->SetXY(15, $y);
                $pdf->Cell(180, 5, $checkbox.' '.$task['label'], 0, 1);
                $y += 5;
            }
            $y += 5;
        }
        
        // Materials
        if (!empty($intervention->materials)) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Matériaux utilisés', 0, 1);
            $y += 8;
            
            // Table header
            $pdf->SetFillColor(52, 73, 94);
            $pdf->SetTextColor(255, 255, 255);
            $pdf->SetFont('helvetica', 'B', 9);
            $pdf->SetXY(10, $y);
            $pdf->Cell(100, 7, 'Article', 1, 0, 'L', true);
            $pdf->Cell(30, 7, 'Quantité', 1, 0, 'C', true);
            $pdf->Cell(30, 7, 'Unité', 1, 0, 'C', true);
            $pdf->Cell(30, 7, '', 1, 1, 'C', true);
            $y += 7;
            
            $pdf->SetTextColor(0, 0, 0);
            $pdf->SetFont('helvetica', '', 9);
            foreach ($intervention->materials as $mat) {
                $pdf->SetXY(10, $y);
                $pdf->Cell(100, 6, $mat['productName'], 1, 0);
                $pdf->Cell(30, 6, $mat['qtyUsed'], 1, 0, 'C');
                $pdf->Cell(30, 6, $mat['unit'], 1, 0, 'C');
                $pdf->Cell(30, 6, '', 1, 1, 'C');
                $y += 6;
            }
            $y += 5;
        }
        
        // Hours
        if (!empty($intervention->hours)) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Heures de travail', 0, 1);
            $y += 8;
            
            $totalHours = 0;
            $pdf->SetFont('helvetica', '', 10);
            foreach ($intervention->hours as $hour) {
                $pdf->SetXY(15, $y);
                $duration = floatval($hour['durationHours']);
                $totalHours += $duration;
                $pdf->Cell(180, 5, '• '.$hour['userName'].': '.number_format($duration, 2).'h ('.$hour['workType'].')', 0, 1);
                $y += 5;
            }
            
            $pdf->SetFont('helvetica', 'B', 10);
            $pdf->SetXY(15, $y);
            $pdf->Cell(180, 6, 'Total: '.number_format($totalHours, 2).' heures', 0, 1);
            $y += 10;
        }
        
        // AI Summary
        if ($intervention->ai_summary) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Résumé (généré par IA)', 0, 1);
            
            $pdf->SetFont('helvetica', 'I', 10);
            $pdf->SetXY(10, $y + 8);
            $pdf->MultiCell(190, 5, $intervention->ai_summary, 0, 'L');
            $y = $pdf->GetY() + 5;
        }
        
        // Signature section
        if ($intervention->signature_path) {
            $pdf->AddPage();
            $y = 45;
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Signature client', 0, 1);
            
            $pdf->SetFont('helvetica', '', 10);
            $pdf->SetXY(10, $y + 10);
            $pdf->Cell(100, 6, 'Nom: '.$intervention->signature_name, 0, 1);
            $pdf->SetXY(10, $y + 16);
            $pdf->Cell(100, 6, 'Date: '.dol_print_date($intervention->signature_date, 'dayhour'), 0, 1);
            
            // Include signature image
            $sig_path = DOL_DATA_ROOT.'/smartelectric/signatures/'.$intervention->signature_path;
            if (file_exists($sig_path)) {
                $pdf->Image($sig_path, 10, $y + 25, 80, 40, '', '', '', false, 150);
            }
        }
        
        // Footer
        $this->_pageFooter($pdf);
        
        // Save PDF
        $dir = DOL_DATA_ROOT.'/smartelectric/interventions';
        if (!is_dir($dir)) {
            dol_mkdir($dir);
        }
        
        $filename = 'intervention_'.$intervention->ref.'_'.date('Ymd').'.pdf';
        $filepath = $dir.'/'.$filename;
        
        $pdf->Output($filepath, 'F');
        
        return $filepath;
    }

    /**
     * Generate OIBT PDF report
     * @param int $oibt_id OIBT control ID
     * @return string|int Filepath or -1 if error
     */
    public function generateOibtPdf($oibt_id)
    {
        global $conf, $langs;
        
        // Load OIBT data
        $sql = "SELECT o.*, i.ref as intervention_ref, i.label as intervention_label,";
        $sql .= " s.nom as client_name, s.address, s.zip, s.town,";
        $sql .= " u.firstname, u.lastname";
        $sql .= " FROM ".MAIN_DB_PREFIX."smelec_oibt o";
        $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."smelec_intervention i ON i.rowid = o.fk_intervention";
        $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = o.fk_soc";
        $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = o.fk_user_control";
        $sql .= " WHERE o.rowid = ".(int) $oibt_id;
        
        $resql = $this->db->query($sql);
        $oibt = $this->db->fetch_object($resql);
        
        if (!$oibt) {
            return -1;
        }
        
        // Create PDF
        $pdf = pdf_getInstance();
        $pdf->SetCreator('SmartElectric Suite');
        $pdf->SetAuthor($this->emetteur->name);
        $pdf->SetTitle('Rapport OIBT '.$oibt->ref);
        
        $pdf->AddPage();
        
        // Header
        $this->_pageHeader($pdf, 'RAPPORT DE CONTRÔLE OIBT');
        
        $y = 45;
        
        // Result banner
        $resultColors = array(
            'conforme' => array(46, 204, 113),      // Green
            'non_conforme' => array(231, 76, 60),   // Red
            'reserve' => array(241, 196, 15)        // Yellow
        );
        $resultLabels = array(
            'conforme' => 'CONFORME',
            'non_conforme' => 'NON CONFORME',
            'reserve' => 'CONFORME AVEC RÉSERVES'
        );
        
        $color = $resultColors[$oibt->global_result] ?? array(149, 165, 166);
        $pdf->SetFillColor($color[0], $color[1], $color[2]);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('helvetica', 'B', 14);
        $pdf->RoundedRect(10, $y, 190, 12, 3, '1111', 'F');
        $pdf->SetXY(10, $y + 2);
        $pdf->Cell(190, 8, $resultLabels[$oibt->global_result] ?? 'N/A', 0, 1, 'C');
        
        $y += 18;
        $pdf->SetTextColor(0, 0, 0);
        
        // Info boxes
        $pdf->SetFillColor(245, 247, 250);
        
        // Left box - Control info
        $pdf->RoundedRect(10, $y, 92, 40, 3, '1111', 'F');
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->SetXY(15, $y + 3);
        $pdf->Cell(82, 6, 'Informations contrôle', 0, 1);
        
        $pdf->SetFont('helvetica', '', 9);
        $pdf->SetXY(15, $y + 10);
        $pdf->Cell(82, 5, 'Référence: '.$oibt->ref, 0, 1);
        $pdf->SetXY(15, $y + 16);
        $pdf->Cell(82, 5, 'Date: '.dol_print_date($this->db->jdate($oibt->date_control), 'day'), 0, 1);
        $pdf->SetXY(15, $y + 22);
        $pdf->Cell(82, 5, 'Contrôleur: '.$oibt->firstname.' '.$oibt->lastname, 0, 1);
        $pdf->SetXY(15, $y + 28);
        $pdf->Cell(82, 5, 'Intervention: '.$oibt->intervention_ref, 0, 1);
        
        // Right box - Client info
        $pdf->RoundedRect(108, $y, 92, 40, 3, '1111', 'F');
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->SetXY(113, $y + 3);
        $pdf->Cell(82, 6, 'Client', 0, 1);
        
        $pdf->SetFont('helvetica', '', 9);
        $pdf->SetXY(113, $y + 10);
        $pdf->Cell(82, 5, $oibt->client_name, 0, 1);
        $pdf->SetXY(113, $y + 16);
        $pdf->Cell(82, 5, $oibt->address, 0, 1);
        $pdf->SetXY(113, $y + 22);
        $pdf->Cell(82, 5, $oibt->zip.' '.$oibt->town, 0, 1);
        
        $y += 48;
        
        // Installation info
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(10, $y);
        $pdf->Cell(190, 8, 'Installation électrique', 0, 1);
        $y += 8;
        
        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetXY(10, $y);
        $pdf->Cell(95, 6, 'Type: '.ucfirst($oibt->installation_type), 0, 0);
        $pdf->Cell(95, 6, 'Année: '.($oibt->installation_year ?: 'N/C'), 0, 1);
        $pdf->SetXY(10, $y + 6);
        $pdf->Cell(95, 6, 'Tension: '.($oibt->voltage ? $oibt->voltage.'V' : 'N/C'), 0, 0);
        $pdf->Cell(95, 6, 'Ampérage: '.($oibt->amperage ? $oibt->amperage.'A' : 'N/C'), 0, 1);
        
        $y += 18;
        
        // Measurements table
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(10, $y);
        $pdf->Cell(190, 8, 'Mesures électriques', 0, 1);
        $y += 8;
        
        $pdf->SetFillColor(52, 73, 94);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(10, $y);
        $pdf->Cell(95, 7, 'Paramètre', 1, 0, 'L', true);
        $pdf->Cell(95, 7, 'Valeur mesurée', 1, 1, 'C', true);
        $y += 7;
        
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFont('helvetica', '', 9);
        
        $measures = array(
            'Résistance d\'isolation' => ($oibt->isolation_resistance ? $oibt->isolation_resistance.' MΩ' : 'N/C'),
            'Résistance de terre' => ($oibt->earth_resistance ? $oibt->earth_resistance.' Ω' : 'N/C'),
            'Impédance de boucle' => ($oibt->loop_impedance ? $oibt->loop_impedance.' Ω' : 'N/C'),
            'Temps déclenchement DDR' => ($oibt->rcd_trip_time ? $oibt->rcd_trip_time.' ms' : 'N/C'),
            'Courant déclenchement DDR' => ($oibt->rcd_trip_current ? $oibt->rcd_trip_current.' mA' : 'N/C'),
        );
        
        foreach ($measures as $label => $value) {
            $pdf->SetXY(10, $y);
            $pdf->Cell(95, 6, $label, 1, 0);
            $pdf->Cell(95, 6, $value, 1, 1, 'C');
            $y += 6;
        }
        
        $y += 5;
        
        // Check results
        $sql_checks = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_oibt_result WHERE fk_oibt = ".(int) $oibt_id." ORDER BY check_code";
        $resql_checks = $this->db->query($sql_checks);
        
        if ($this->db->num_rows($resql_checks) > 0) {
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Points de contrôle', 0, 1);
            $y += 8;
            
            // Check if we need a new page
            if ($y > 220) {
                $pdf->AddPage();
                $y = 20;
            }
            
            $pdf->SetFillColor(52, 73, 94);
            $pdf->SetTextColor(255, 255, 255);
            $pdf->SetFont('helvetica', 'B', 8);
            $pdf->SetXY(10, $y);
            $pdf->Cell(20, 6, 'Code', 1, 0, 'C', true);
            $pdf->Cell(90, 6, 'Point de contrôle', 1, 0, 'L', true);
            $pdf->Cell(20, 6, 'Résultat', 1, 0, 'C', true);
            $pdf->Cell(30, 6, 'Valeur', 1, 0, 'C', true);
            $pdf->Cell(30, 6, 'Remarque', 1, 1, 'L', true);
            $y += 6;
            
            $pdf->SetTextColor(0, 0, 0);
            $pdf->SetFont('helvetica', '', 8);
            
            while ($check = $this->db->fetch_object($resql_checks)) {
                if ($y > 270) {
                    $pdf->AddPage();
                    $y = 20;
                }
                
                $pdf->SetXY(10, $y);
                $pdf->Cell(20, 5, $check->check_code, 1, 0, 'C');
                $pdf->Cell(90, 5, $check->check_label, 1, 0);
                
                // Result with color
                $resultText = $check->result == 'ok' ? 'OK' : ($check->result == 'nok' ? 'NOK' : 'N/A');
                if ($check->result == 'ok') {
                    $pdf->SetFillColor(46, 204, 113);
                } elseif ($check->result == 'nok') {
                    $pdf->SetFillColor(231, 76, 60);
                } else {
                    $pdf->SetFillColor(189, 195, 199);
                }
                $pdf->SetTextColor(255, 255, 255);
                $pdf->Cell(20, 5, $resultText, 1, 0, 'C', true);
                
                $pdf->SetTextColor(0, 0, 0);
                $pdf->SetFillColor(255, 255, 255);
                $pdf->Cell(30, 5, $check->measure_value, 1, 0, 'C');
                $pdf->Cell(30, 5, dol_trunc($check->comment, 20), 1, 1);
                $y += 5;
            }
        }
        
        $y += 8;
        
        // Comments section
        if ($oibt->comment_general || $oibt->defects_found || $oibt->recommendations) {
            if ($y > 220) {
                $pdf->AddPage();
                $y = 20;
            }
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Observations et recommandations', 0, 1);
            $y += 10;
            
            $pdf->SetFont('helvetica', '', 10);
            
            if ($oibt->comment_general) {
                $pdf->SetFont('helvetica', 'B', 9);
                $pdf->SetXY(10, $y);
                $pdf->Cell(40, 5, 'Commentaire général:', 0, 0);
                $pdf->SetFont('helvetica', '', 9);
                $pdf->SetXY(10, $y + 5);
                $pdf->MultiCell(190, 5, $oibt->comment_general, 0, 'L');
                $y = $pdf->GetY() + 3;
            }
            
            if ($oibt->defects_found) {
                $pdf->SetFont('helvetica', 'B', 9);
                $pdf->SetXY(10, $y);
                $pdf->Cell(40, 5, 'Défauts constatés:', 0, 1);
                $pdf->SetFont('helvetica', '', 9);
                $pdf->SetXY(10, $y + 5);
                $pdf->MultiCell(190, 5, $oibt->defects_found, 0, 'L');
                $y = $pdf->GetY() + 3;
            }
            
            if ($oibt->recommendations) {
                $pdf->SetFont('helvetica', 'B', 9);
                $pdf->SetXY(10, $y);
                $pdf->Cell(40, 5, 'Recommandations:', 0, 1);
                $pdf->SetFont('helvetica', '', 9);
                $pdf->SetXY(10, $y + 5);
                $pdf->MultiCell(190, 5, $oibt->recommendations, 0, 'L');
                $y = $pdf->GetY() + 3;
            }
        }
        
        // Next control date
        if ($oibt->next_control_date) {
            $y += 5;
            $pdf->SetFont('helvetica', 'B', 10);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 6, 'Prochain contrôle recommandé: '.dol_print_date($this->db->jdate($oibt->next_control_date), 'day'), 0, 1);
        }
        
        // Footer
        $this->_pageFooter($pdf);
        
        // Save PDF
        $dir = DOL_DATA_ROOT.'/smartelectric/oibt';
        if (!is_dir($dir)) {
            dol_mkdir($dir);
        }
        
        $filename = 'oibt_'.$oibt->ref.'_'.date('Ymd').'.pdf';
        $filepath = $dir.'/'.$filename;
        
        $pdf->Output($filepath, 'F');
        
        // Update database with PDF path
        $sql_update = "UPDATE ".MAIN_DB_PREFIX."smelec_oibt SET pdf_path = '".$this->db->escape($filename)."' WHERE rowid = ".(int) $oibt_id;
        $this->db->query($sql_update);
        
        return $filepath;
    }

    /**
     * Page header
     * @param TCPDF $pdf PDF object
     * @param string $title Page title
     */
    private function _pageHeader(&$pdf, $title)
    {
        // Logo
        $logo = DOL_DATA_ROOT.'/mycompany/logos/'.$this->emetteur->logo;
        if (is_readable($logo)) {
            $pdf->Image($logo, 10, 10, 30, 0, '', '', '', false, 150);
        }
        
        // Company name
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->SetXY(45, 10);
        $pdf->Cell(100, 6, $this->emetteur->name, 0, 1);
        
        $pdf->SetFont('helvetica', '', 9);
        $pdf->SetXY(45, 16);
        $pdf->Cell(100, 5, $this->emetteur->address, 0, 1);
        $pdf->SetXY(45, 21);
        $pdf->Cell(100, 5, $this->emetteur->zip.' '.$this->emetteur->town, 0, 1);
        
        // Title
        $pdf->SetFillColor(247, 151, 22); // Orange SmartElectric
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('helvetica', 'B', 14);
        $pdf->SetXY(10, 32);
        $pdf->Cell(190, 10, $title, 0, 1, 'C', true);
        
        $pdf->SetTextColor(0, 0, 0);
    }

    /**
     * Page footer
     * @param TCPDF $pdf PDF object
     */
    private function _pageFooter(&$pdf)
    {
        $pdf->SetY(-20);
        $pdf->SetFont('helvetica', 'I', 8);
        $pdf->SetTextColor(128, 128, 128);
        $pdf->Cell(0, 10, 'Document généré par SmartElectric Suite - '.dol_print_date(dol_now(), 'dayhour'), 0, 0, 'C');
        $pdf->SetY(-15);
        $pdf->Cell(0, 10, 'Page '.$pdf->getAliasNumPage().' / '.$pdf->getAliasNbPages(), 0, 0, 'C');
    }
}

/**
 * Alias class for OIBT PDF
 */
class SmelecOibtPdf extends SmelecPdfGenerator
{
    public function generate($oibt_id)
    {
        $result = $this->generateOibtPdf($oibt_id);
        return $result !== -1 ? 1 : -1;
    }
}
