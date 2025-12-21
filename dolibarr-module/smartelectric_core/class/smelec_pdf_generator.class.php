<?php
/* Copyright (C) 2024-2025 SmartElectric Suite / MV-3 PRO
 * Générateur PDF pour interventions et rapports OIBT
 */

require_once DOL_DOCUMENT_ROOT.'/core/lib/pdf.lib.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/company.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/smartelectric_core/class/smelec_intervention.class.php';

/**
 * Class SmelecPdfGenerator
 * Génère les rapports PDF pour SmartElectric / MV-3 PRO
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
     * @return string|int Filepath or -1 if error
     */
    public function generateInterventionPdf($intervention_id)
    {
        global $conf, $langs, $mysoc;
        
        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($intervention_id);
        if ($result <= 0) {
            return -1;
        }
        $intervention->fetchLines();
        
        // Load client
        require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
        $client = new Societe($this->db);
        $client->fetch($intervention->fk_soc);
        
        // Create PDF
        $pdf = pdf_getInstance();
        $pdf->SetCreator('MV-3 PRO - SmartElectric Suite');
        $pdf->SetAuthor($this->emetteur->name);
        $pdf->SetTitle('Rapport Intervention '.$intervention->ref);
        $pdf->SetMargins(10, 10, 10);
        $pdf->SetAutoPageBreak(true, 25);
        
        $pdf->AddPage();
        
        // Header with logo
        $this->_pageHeader($pdf, 'RAPPORT D\'INTERVENTION', $intervention->ref);
        
        $y = 50;
        
        // Status banner
        $statusColors = array(
            0 => array(149, 165, 166), // Gris - À planifier
            1 => array(52, 152, 219),  // Bleu - En cours
            2 => array(46, 204, 113),  // Vert - Terminé
            3 => array(155, 89, 182),  // Violet - Facturé
        );
        $statusLabels = array(0 => 'À PLANIFIER', 1 => 'EN COURS', 2 => 'TERMINÉ', 3 => 'FACTURÉ');
        
        $color = $statusColors[$intervention->status] ?? array(149, 165, 166);
        $pdf->SetFillColor($color[0], $color[1], $color[2]);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->RoundedRect(140, 12, 60, 8, 2, '1111', 'F');
        $pdf->SetXY(140, 13);
        $pdf->Cell(60, 6, $statusLabels[$intervention->status] ?? 'N/A', 0, 1, 'C');
        $pdf->SetTextColor(0, 0, 0);
        
        // Intervention info box
        $pdf->SetFillColor(245, 247, 250);
        $pdf->RoundedRect(10, $y, 190, 38, 3, '1111', 'F');
        
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(15, $y + 4);
        $pdf->Cell(90, 6, 'Référence: '.$intervention->ref, 0, 0);
        
        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetXY(115, $y + 4);
        $pdf->Cell(80, 6, 'Date: '.dol_print_date($intervention->date_creation, 'day'), 0, 1);
        
        $pdf->SetXY(15, $y + 11);
        $typeLabels = array('installation' => 'Installation', 'depannage' => 'Dépannage', 'renovation' => 'Rénovation', 'tableau' => 'Tableau', 'cuisine' => 'Cuisine', 'oibt' => 'Contrôle OIBT', 'autre' => 'Autre');
        $pdf->Cell(90, 6, 'Type: '.($typeLabels[$intervention->type] ?? $intervention->type), 0, 0);
        
        $priorityLabels = array(0 => 'Normal', 1 => 'Urgent', 2 => 'Critique');
        $pdf->SetXY(115, $y + 11);
        $pdf->Cell(80, 6, 'Priorité: '.($priorityLabels[$intervention->priority] ?? 'Normal'), 0, 1);
        
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->SetXY(15, $y + 20);
        $pdf->Cell(180, 6, 'Client: '.$client->name, 0, 1);
        
        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetXY(15, $y + 27);
        $address = $intervention->location ?: ($client->address.', '.$client->zip.' '.$client->town);
        $pdf->Cell(180, 6, 'Adresse: '.dol_trunc($address, 80), 0, 1);
        
        $y += 45;
        
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
            $this->_checkPageBreak($pdf, $y, 50);
            $y = $pdf->GetY();
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Checklist des travaux', 0, 1);
            $y += 8;
            
            $pdf->SetFont('helvetica', '', 10);
            foreach ($intervention->tasks as $task) {
                if ($y > 260) {
                    $pdf->AddPage();
                    $y = 20;
                }
                $checkbox = $task['status'] === 'fait' ? '☑' : '☐';
                $pdf->SetXY(15, $y);
                $pdf->Cell(180, 5, $checkbox.' '.$task['label'], 0, 1);
                if ($task['comment']) {
                    $pdf->SetXY(25, $y + 5);
                    $pdf->SetFont('helvetica', 'I', 9);
                    $pdf->Cell(165, 4, '→ '.$task['comment'], 0, 1);
                    $pdf->SetFont('helvetica', '', 10);
                    $y += 4;
                }
                $y += 5;
            }
            $y += 5;
        }
        
        // Materials table
        if (!empty($intervention->materials)) {
            $this->_checkPageBreak($pdf, $y, 50);
            $y = $pdf->GetY();
            
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
                if ($y > 260) {
                    $pdf->AddPage();
                    $y = 20;
                }
                $pdf->SetXY(10, $y);
                $pdf->Cell(100, 6, dol_trunc($mat['productName'] ?: $mat['productRef'], 50), 1, 0);
                $pdf->Cell(30, 6, $mat['qtyUsed'], 1, 0, 'C');
                $pdf->Cell(30, 6, $mat['unit'] ?: 'pce', 1, 0, 'C');
                $pdf->Cell(30, 6, '', 1, 1, 'C');
                $y += 6;
            }
            $y += 5;
        }
        
        // Hours summary
        if (!empty($intervention->hours)) {
            $this->_checkPageBreak($pdf, $y, 40);
            $y = $pdf->GetY();
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Heures de travail', 0, 1);
            $y += 8;
            
            $totalHours = 0;
            $pdf->SetFont('helvetica', '', 10);
            foreach ($intervention->hours as $hour) {
                $duration = floatval($hour['durationHours']);
                $totalHours += $duration;
                $pdf->SetXY(15, $y);
                $workTypeLabels = array('travail' => 'Travail', 'deplacement' => 'Déplacement', 'pause' => 'Pause');
                $workType = $workTypeLabels[$hour['workType']] ?? $hour['workType'];
                $pdf->Cell(180, 5, '• '.($hour['userName'] ?: 'Technicien').': '.number_format($duration, 2).'h ('.$workType.')', 0, 1);
                $y += 5;
            }
            
            $pdf->SetFont('helvetica', 'B', 10);
            $pdf->SetXY(15, $y + 2);
            $pdf->Cell(180, 6, 'Total: '.number_format($totalHours, 2).' heures', 0, 1);
            $y += 12;
        }
        
        // Photos thumbnails (if any)
        if (!empty($intervention->photos)) {
            $this->_checkPageBreak($pdf, $y, 60);
            $y = $pdf->GetY();
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Photos ('.count($intervention->photos).')', 0, 1);
            $y += 10;
            
            $x = 15;
            $photoCount = 0;
            foreach ($intervention->photos as $photo) {
                if ($photoCount >= 6) break; // Max 6 photos per page
                
                $photoPath = $photo['filePath'];
                if (file_exists($photoPath)) {
                    try {
                        $pdf->Image($photoPath, $x, $y, 28, 28, '', '', '', true, 72);
                        $pdf->SetFont('helvetica', '', 7);
                        $pdf->SetXY($x, $y + 28);
                        $pdf->Cell(28, 4, ucfirst($photo['type']), 0, 0, 'C');
                    } catch (Exception $e) {
                        // Skip invalid images
                    }
                }
                
                $x += 32;
                $photoCount++;
                if ($photoCount % 6 == 0) {
                    $x = 15;
                    $y += 35;
                }
            }
            $y += 40;
        }
        
        // AI Summary
        if ($intervention->ai_summary) {
            $this->_checkPageBreak($pdf, $y, 40);
            $y = $pdf->GetY();
            
            $pdf->SetFillColor(240, 248, 255);
            $pdf->RoundedRect(10, $y, 190, 5, 2, '1100', 'F');
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, '⚡ Résumé (généré par IA)', 0, 1);
            
            $pdf->SetFont('helvetica', 'I', 10);
            $pdf->SetXY(10, $y + 8);
            $pdf->MultiCell(190, 5, $intervention->ai_summary, 0, 'L');
            $y = $pdf->GetY() + 5;
        }
        
        // Signature section
        if ($intervention->signature_path && file_exists($intervention->signature_path)) {
            $this->_checkPageBreak($pdf, $y, 60);
            $y = $pdf->GetY();
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Signature client', 0, 1);
            
            $pdf->SetFont('helvetica', '', 10);
            $pdf->SetXY(10, $y + 10);
            $pdf->Cell(100, 6, 'Nom: '.($intervention->signature_name ?: 'Client'), 0, 1);
            $pdf->SetXY(10, $y + 16);
            $pdf->Cell(100, 6, 'Date: '.dol_print_date($intervention->signature_date, 'dayhour'), 0, 1);
            
            try {
                $pdf->Image($intervention->signature_path, 10, $y + 24, 70, 35, '', '', '', false, 150);
            } catch (Exception $e) {
                // Skip if image error
            }
        }
        
        // Footer on each page
        $this->_pageFooter($pdf);
        
        // Save PDF
        $dir = DOL_DATA_ROOT.'/smartelectric/interventions/'.$intervention->ref;
        if (!is_dir($dir)) {
            dol_mkdir($dir);
        }
        
        $filename = $intervention->ref.'_'.date('Ymd_His').'.pdf';
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
        global $conf, $langs, $mysoc;
        
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
        $pdf->SetCreator('MV-3 PRO - SmartElectric Suite');
        $pdf->SetAuthor($this->emetteur->name);
        $pdf->SetTitle('Rapport OIBT '.$oibt->ref);
        $pdf->SetMargins(10, 10, 10);
        $pdf->SetAutoPageBreak(true, 25);
        
        $pdf->AddPage();
        
        // Header
        $this->_pageHeader($pdf, 'RAPPORT DE CONTRÔLE OIBT', $oibt->ref);
        
        $y = 50;
        
        // Result banner
        $resultColors = array(
            'conforme' => array(46, 204, 113),
            'non_conforme' => array(231, 76, 60),
            'reserve' => array(241, 196, 15)
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
        $pdf->RoundedRect(10, $y, 92, 42, 3, '1111', 'F');
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
        if ($oibt->next_control_date) {
            $pdf->SetXY(15, $y + 34);
            $pdf->Cell(82, 5, 'Prochain contrôle: '.dol_print_date($this->db->jdate($oibt->next_control_date), 'day'), 0, 1);
        }
        
        // Right box - Client info
        $pdf->RoundedRect(108, $y, 92, 42, 3, '1111', 'F');
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
        
        $y += 50;
        
        // Installation info
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(10, $y);
        $pdf->Cell(190, 8, 'Installation électrique', 0, 1);
        $y += 8;
        
        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetXY(10, $y);
        $pdf->Cell(95, 6, 'Type: '.ucfirst($oibt->installation_type ?: 'N/C'), 0, 0);
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
            $this->_checkPageBreak($pdf, $y, 50);
            $y = $pdf->GetY();
            
            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetXY(10, $y);
            $pdf->Cell(190, 8, 'Points de contrôle', 0, 1);
            $y += 8;
            
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
                if ($y > 265) {
                    $pdf->AddPage();
                    $y = 20;
                }
                
                $pdf->SetXY(10, $y);
                $pdf->Cell(20, 5, $check->check_code, 1, 0, 'C');
                $pdf->Cell(90, 5, dol_trunc($check->check_label, 45), 1, 0);
                
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
                $pdf->Cell(30, 5, dol_trunc($check->comment, 15), 1, 1);
                $y += 5;
            }
        }
        
        $y += 8;
        
        // Comments section
        if ($oibt->comment_general || $oibt->defects_found || $oibt->recommendations) {
            $this->_checkPageBreak($pdf, $y, 50);
            $y = $pdf->GetY();
            
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
        
        // Footer
        $this->_pageFooter($pdf);
        
        // Save PDF
        $dir = DOL_DATA_ROOT.'/smartelectric/oibt';
        if (!is_dir($dir)) {
            dol_mkdir($dir);
        }
        
        $filename = 'OIBT_'.$oibt->ref.'_'.date('Ymd').'.pdf';
        $filepath = $dir.'/'.$filename;
        
        $pdf->Output($filepath, 'F');
        
        // Update OIBT record with PDF path
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_oibt SET pdf_path = '".$this->db->escape($filepath)."' WHERE rowid = ".(int) $oibt_id;
        $this->db->query($sql);
        
        return $filepath;
    }

    /**
     * Page header with logo
     */
    private function _pageHeader($pdf, $title, $ref = '')
    {
        global $mysoc;
        
        // Logo MV-3 PRO (or company logo if exists)
        $logo = $mysoc->logo;
        $logo_path = DOL_DATA_ROOT.'/mycompany/logos/'.$logo;
        
        if ($logo && file_exists($logo_path)) {
            $pdf->Image($logo_path, 10, 8, 40, 0, '', '', '', true, 300);
        } else {
            // Default: text logo
            $pdf->SetFont('helvetica', 'B', 20);
            $pdf->SetTextColor(37, 99, 235); // Blue
            $pdf->SetXY(10, 10);
            $pdf->Cell(50, 12, 'MV-3 PRO', 0, 0);
            
            $pdf->SetFont('helvetica', '', 9);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY(10, 20);
            $pdf->Cell(50, 5, 'Électricien professionnel', 0, 1);
        }
        
        // Title
        $pdf->SetFont('helvetica', 'B', 16);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetXY(65, 12);
        $pdf->Cell(135, 10, $title, 0, 1, 'R');
        
        if ($ref) {
            $pdf->SetFont('helvetica', '', 10);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY(65, 22);
            $pdf->Cell(135, 6, $ref, 0, 1, 'R');
        }
        
        // Line separator
        $pdf->SetDrawColor(37, 99, 235);
        $pdf->SetLineWidth(0.5);
        $pdf->Line(10, 35, 200, 35);
        
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetDrawColor(0, 0, 0);
        $pdf->SetLineWidth(0.2);
    }

    /**
     * Page footer
     */
    private function _pageFooter($pdf)
    {
        global $mysoc;
        
        $pages = $pdf->getNumPages();
        for ($i = 1; $i <= $pages; $i++) {
            $pdf->setPage($i);
            
            // Footer line
            $pdf->SetDrawColor(200, 200, 200);
            $pdf->Line(10, 280, 200, 280);
            
            // Company info
            $pdf->SetFont('helvetica', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY(10, 282);
            
            $footer = $mysoc->name;
            if ($mysoc->address) $footer .= ' | '.$mysoc->address;
            if ($mysoc->zip || $mysoc->town) $footer .= ', '.$mysoc->zip.' '.$mysoc->town;
            if ($mysoc->phone) $footer .= ' | Tél: '.$mysoc->phone;
            if ($mysoc->email) $footer .= ' | '.$mysoc->email;
            
            $pdf->Cell(140, 5, dol_trunc($footer, 100), 0, 0, 'L');
            
            // Page number
            $pdf->SetXY(160, 282);
            $pdf->Cell(40, 5, 'Page '.$i.'/'.$pages, 0, 0, 'R');
        }
    }

    /**
     * Check if we need a page break
     */
    private function _checkPageBreak($pdf, &$y, $height)
    {
        if ($y + $height > 265) {
            $pdf->AddPage();
            $y = 20;
        }
    }
}
