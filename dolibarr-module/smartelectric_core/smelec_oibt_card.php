<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Fiche contrôle OIBT (Ordonnance sur les Installations à Basse Tension)
 */

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/company.lib.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once './class/smelec_intervention.class.php';

$langs->loadLangs(array("smartelectric_core@smartelectric_core", "companies"));

$id = GETPOST('id', 'int');
$intervention_id = GETPOST('intervention_id', 'int');
$action = GETPOST('action', 'aZ09');
$confirm = GETPOST('confirm', 'alpha');

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

$form = new Form($db);

// Load OIBT if exists
$oibt = null;
if ($id > 0) {
    $sql = "SELECT o.*, i.ref as intervention_ref, i.label as intervention_label, s.nom as client_name ";
    $sql .= "FROM ".MAIN_DB_PREFIX."smelec_oibt o ";
    $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."smelec_intervention i ON i.rowid = o.fk_intervention ";
    $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = o.fk_soc ";
    $sql .= "WHERE o.rowid = ".(int) $id;
    $resql = $db->query($sql);
    if ($resql) {
        $oibt = $db->fetch_object($resql);
    }
}

// Load intervention if creating new OIBT
$intervention = null;
if ($intervention_id > 0) {
    $intervention = new SmelecIntervention($db);
    $intervention->fetch($intervention_id);
}

/*
 * ACTIONS
 */

// Create OIBT
if ($action == 'add' && $user->rights->smartelectric_core->intervention->write) {
    $error = 0;
    
    $fk_intervention = GETPOST('fk_intervention', 'int');
    $fk_soc = GETPOST('fk_soc', 'int');
    
    // Generate ref
    $sql_ref = "SELECT MAX(CAST(SUBSTRING(ref, 6) AS UNSIGNED)) as max_num FROM ".MAIN_DB_PREFIX."smelec_oibt WHERE ref LIKE 'OIBT-%'";
    $resql_ref = $db->query($sql_ref);
    $obj_ref = $db->fetch_object($resql_ref);
    $ref = 'OIBT-'.sprintf('%05d', ($obj_ref->max_num ?: 0) + 1);
    
    $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_oibt (";
    $sql .= "fk_intervention, fk_soc, fk_project, ref, date_control, fk_user_control,";
    $sql .= "installation_type, installation_year, voltage, amperage,";
    $sql .= "isolation_resistance, earth_resistance, loop_impedance, rcd_trip_time, rcd_trip_current,";
    $sql .= "global_result, comment_general, defects_found, recommendations, next_control_date, date_creation";
    $sql .= ") VALUES (";
    $sql .= (int) $fk_intervention.", ";
    $sql .= (int) $fk_soc.", ";
    $sql .= (GETPOST('fk_project', 'int') > 0 ? (int) GETPOST('fk_project', 'int') : "NULL").", ";
    $sql .= "'".$db->escape($ref)."', ";
    $sql .= "'".$db->idate(dol_mktime(0, 0, 0, GETPOST('date_controlmonth'), GETPOST('date_controlday'), GETPOST('date_controlyear')))."', ";
    $sql .= (int) $user->id.", ";
    $sql .= "'".$db->escape(GETPOST('installation_type', 'alphanohtml'))."', ";
    $sql .= (GETPOST('installation_year', 'int') > 0 ? (int) GETPOST('installation_year', 'int') : "NULL").", ";
    $sql .= (GETPOST('voltage', 'int') > 0 ? floatval(GETPOST('voltage')) : "NULL").", ";
    $sql .= (GETPOST('amperage', 'int') > 0 ? floatval(GETPOST('amperage')) : "NULL").", ";
    $sql .= (GETPOST('isolation_resistance') != '' ? floatval(GETPOST('isolation_resistance')) : "NULL").", ";
    $sql .= (GETPOST('earth_resistance') != '' ? floatval(GETPOST('earth_resistance')) : "NULL").", ";
    $sql .= (GETPOST('loop_impedance') != '' ? floatval(GETPOST('loop_impedance')) : "NULL").", ";
    $sql .= (GETPOST('rcd_trip_time') != '' ? floatval(GETPOST('rcd_trip_time')) : "NULL").", ";
    $sql .= (GETPOST('rcd_trip_current') != '' ? floatval(GETPOST('rcd_trip_current')) : "NULL").", ";
    $sql .= "'".$db->escape(GETPOST('global_result', 'alpha'))."', ";
    $sql .= "'".$db->escape(GETPOST('comment_general', 'restricthtml'))."', ";
    $sql .= "'".$db->escape(GETPOST('defects_found', 'restricthtml'))."', ";
    $sql .= "'".$db->escape(GETPOST('recommendations', 'restricthtml'))."', ";
    $sql .= (GETPOST('next_control_dateyear') ? "'".$db->idate(dol_mktime(0, 0, 0, GETPOST('next_control_datemonth'), GETPOST('next_control_dateday'), GETPOST('next_control_dateyear')))."'" : "NULL").", ";
    $sql .= "'".$db->idate(dol_now())."'";
    $sql .= ")";
    
    $resql = $db->query($sql);
    if ($resql) {
        $new_id = $db->last_insert_id(MAIN_DB_PREFIX."smelec_oibt");
        
        // Insert OIBT check results
        $check_codes = GETPOST('check_code', 'array');
        $check_labels = GETPOST('check_label', 'array');
        $check_results = GETPOST('check_result', 'array');
        $check_values = GETPOST('check_value', 'array');
        $check_comments = GETPOST('check_comment', 'array');
        
        if (is_array($check_codes)) {
            foreach ($check_codes as $i => $code) {
                if (!empty($check_labels[$i])) {
                    $sql_result = "INSERT INTO ".MAIN_DB_PREFIX."smelec_oibt_result ";
                    $sql_result .= "(fk_oibt, check_code, check_label, result, measure_value, comment) VALUES (";
                    $sql_result .= (int) $new_id.", ";
                    $sql_result .= "'".$db->escape($code)."', ";
                    $sql_result .= "'".$db->escape($check_labels[$i])."', ";
                    $sql_result .= "'".$db->escape($check_results[$i] ?: 'na')."', ";
                    $sql_result .= "'".$db->escape($check_values[$i])."', ";
                    $sql_result .= "'".$db->escape($check_comments[$i])."')";
                    $db->query($sql_result);
                }
            }
        }
        
        setEventMessages('Contrôle OIBT créé avec succès', null, 'mesgs');
        header("Location: smelec_oibt_card.php?id=".$new_id);
        exit;
    } else {
        setEventMessages('Erreur lors de la création', null, 'errors');
        $action = 'create';
    }
}

// Generate PDF
if ($action == 'generate_pdf' && $id > 0) {
    require_once './class/smelec_oibt_pdf.class.php';
    
    $pdfGenerator = new SmelecOibtPdf($db);
    $result = $pdfGenerator->generate($id);
    
    if ($result > 0) {
        setEventMessages('PDF généré avec succès', null, 'mesgs');
    } else {
        setEventMessages('Erreur lors de la génération du PDF', null, 'errors');
    }
}

/*
 * VIEW
 */

llxHeader('', 'Contrôle OIBT SmartElectric', '');

// Create form
if ($action == 'create') {
    print load_fiche_titre('Nouveau contrôle OIBT', '', 'fa-clipboard-check');
    
    print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
    print '<input type="hidden" name="token" value="'.newToken().'">';
    print '<input type="hidden" name="action" value="add">';
    if ($intervention) {
        print '<input type="hidden" name="fk_intervention" value="'.$intervention->id.'">';
        print '<input type="hidden" name="fk_soc" value="'.$intervention->fk_soc.'">';
    }
    
    print '<div class="fichecenter">';
    
    // Information générale
    print '<div class="div-table-responsive-no-min">';
    print '<table class="border centpercent tableforfieldcreate">';
    
    print '<tr class="liste_titre"><td colspan="4">📋 Informations générales</td></tr>';
    
    // Intervention liée
    if ($intervention) {
        print '<tr><td class="titlefieldcreate">Intervention</td>';
        print '<td colspan="3"><a href="smelec_intervention_card.php?id='.$intervention->id.'">'.$intervention->ref.'</a> - '.$intervention->label.'</td></tr>';
    } else {
        print '<tr><td class="titlefieldcreate fieldrequired">Intervention</td>';
        print '<td colspan="3"><input type="text" name="fk_intervention" class="flat" placeholder="ID intervention"></td></tr>';
    }
    
    // Client
    print '<tr><td class="fieldrequired">Client</td>';
    if ($intervention) {
        $soc = new Societe($db);
        $soc->fetch($intervention->fk_soc);
        print '<td colspan="3">'.$soc->getNomUrl(1).'</td>';
    } else {
        print '<td colspan="3">'.$form->select_company('', 'fk_soc', '', 'SelectThirdParty', 1).'</td>';
    }
    print '</tr>';
    
    // Date contrôle
    print '<tr><td class="fieldrequired">Date du contrôle</td>';
    print '<td colspan="3">'.$form->selectDate(dol_now(), 'date_control', 0, 0, 0, '', 1, 1).'</td></tr>';
    
    // Type installation
    print '<tr><td>Type d\'installation</td>';
    print '<td colspan="3">';
    $types = array('domestique' => 'Domestique', 'commercial' => 'Commercial', 'industriel' => 'Industriel', 'agricole' => 'Agricole');
    print $form->selectarray('installation_type', $types, '', 1, 0, 0, '', 0, 0, 0, '', 'minwidth200');
    print '</td></tr>';
    
    // Année installation
    print '<tr><td>Année d\'installation</td>';
    print '<td><input type="number" name="installation_year" class="flat" min="1900" max="2100" placeholder="Ex: 2020"></td>';
    
    // Tension / Ampérage
    print '<td>Tension / Ampérage</td>';
    print '<td>';
    print '<input type="number" name="voltage" class="flat minwidth75" step="0.1" placeholder="V"> V &nbsp;';
    print '<input type="number" name="amperage" class="flat minwidth75" step="0.1" placeholder="A"> A';
    print '</td></tr>';
    
    print '</table>';
    print '</div>';
    
    print '<br>';
    
    // Mesures
    print '<div class="div-table-responsive-no-min">';
    print '<table class="border centpercent">';
    print '<tr class="liste_titre"><td colspan="4">📊 Mesures électriques</td></tr>';
    
    print '<tr>';
    print '<td class="titlefieldcreate">Résistance d\'isolation</td>';
    print '<td><input type="number" name="isolation_resistance" class="flat" step="0.01" placeholder="MΩ"> MΩ</td>';
    print '<td>Résistance de terre</td>';
    print '<td><input type="number" name="earth_resistance" class="flat" step="0.01" placeholder="Ω"> Ω</td>';
    print '</tr>';
    
    print '<tr>';
    print '<td>Impédance de boucle</td>';
    print '<td><input type="number" name="loop_impedance" class="flat" step="0.01" placeholder="Ω"> Ω</td>';
    print '<td>Temps déclenchement DDR</td>';
    print '<td><input type="number" name="rcd_trip_time" class="flat" step="0.1" placeholder="ms"> ms</td>';
    print '</tr>';
    
    print '<tr>';
    print '<td>Courant déclenchement DDR</td>';
    print '<td><input type="number" name="rcd_trip_current" class="flat" step="0.1" placeholder="mA"> mA</td>';
    print '<td colspan="2"></td>';
    print '</tr>';
    
    print '</table>';
    print '</div>';
    
    print '<br>';
    
    // Points de contrôle
    print '<div class="div-table-responsive-no-min">';
    print '<table class="border centpercent" id="oibt_checks">';
    print '<tr class="liste_titre"><td colspan="5">✓ Points de contrôle OIBT</td></tr>';
    print '<tr class="liste_titre">';
    print '<td width="80">Code</td>';
    print '<td>Point de contrôle</td>';
    print '<td width="100" class="center">Résultat</td>';
    print '<td width="120">Valeur mesurée</td>';
    print '<td>Commentaire</td>';
    print '</tr>';
    
    // Default OIBT checks
    $defaultChecks = array(
        array('4.1.1', 'Protection contre les contacts directs'),
        array('4.1.2', 'Protection contre les contacts indirects'),
        array('4.2.1', 'Continuité des conducteurs de protection'),
        array('4.2.2', 'Résistance d\'isolement'),
        array('4.2.3', 'Séparation des circuits TBTS/TBTP'),
        array('4.3.1', 'Fonctionnement des DDR'),
        array('4.3.2', 'Vérification de la terre'),
        array('4.4.1', 'Marquage et repérage'),
        array('4.4.2', 'Documentation technique'),
        array('5.1', 'Tableau électrique'),
        array('5.2', 'Câblage et connexions'),
        array('5.3', 'Appareillage'),
    );
    
    foreach ($defaultChecks as $i => $check) {
        print '<tr class="oddeven">';
        print '<td><input type="text" name="check_code[]" class="flat minwidth60" value="'.$check[0].'"></td>';
        print '<td><input type="text" name="check_label[]" class="flat quatrevingtpercent" value="'.$check[1].'"></td>';
        print '<td class="center">';
        print '<select name="check_result[]" class="flat">';
        print '<option value="na">N/A</option>';
        print '<option value="ok">✓ OK</option>';
        print '<option value="nok">✗ NOK</option>';
        print '</select>';
        print '</td>';
        print '<td><input type="text" name="check_value[]" class="flat minwidth100" placeholder="Valeur"></td>';
        print '<td><input type="text" name="check_comment[]" class="flat quatrevingtpercent" placeholder="Remarque"></td>';
        print '</tr>';
    }
    
    print '</table>';
    print '</div>';
    
    print '<br>';
    
    // Résultat global
    print '<div class="div-table-responsive-no-min">';
    print '<table class="border centpercent">';
    print '<tr class="liste_titre"><td colspan="2">📝 Conclusion</td></tr>';
    
    print '<tr><td class="titlefieldcreate fieldrequired">Résultat global</td>';
    print '<td>';
    print '<select name="global_result" class="flat minwidth200">';
    print '<option value="conforme">✓ CONFORME</option>';
    print '<option value="non_conforme">✗ NON CONFORME</option>';
    print '<option value="reserve">⚠ CONFORME AVEC RÉSERVES</option>';
    print '</select>';
    print '</td></tr>';
    
    print '<tr><td>Commentaire général</td>';
    print '<td><textarea name="comment_general" class="flat quatrevingtpercent" rows="3" placeholder="Observations générales..."></textarea></td></tr>';
    
    print '<tr><td>Défauts constatés</td>';
    print '<td><textarea name="defects_found" class="flat quatrevingtpercent" rows="3" placeholder="Liste des défauts..."></textarea></td></tr>';
    
    print '<tr><td>Recommandations</td>';
    print '<td><textarea name="recommendations" class="flat quatrevingtpercent" rows="3" placeholder="Recommandations et mesures correctives..."></textarea></td></tr>';
    
    print '<tr><td>Prochain contrôle</td>';
    print '<td>'.$form->selectDate('', 'next_control_date', 0, 0, 1, '', 1, 1).'</td></tr>';
    
    print '</table>';
    print '</div>';
    
    print '</div>';
    
    print '<div class="center" style="margin-top: 20px;">';
    print '<input type="submit" class="button button-save" value="Enregistrer le contrôle OIBT">';
    print ' <input type="submit" class="button button-cancel" name="cancel" value="Annuler">';
    print '</div>';
    
    print '</form>';
}

// View OIBT
if ($oibt && $action != 'create') {
    print load_fiche_titre('Contrôle OIBT '.$oibt->ref, '', 'fa-clipboard-check');
    
    print '<div class="fichecenter">';
    print '<div class="fichehalfleft">';
    print '<div class="underbanner clearboth"></div>';
    print '<table class="border tableforfield centpercent">';
    
    print '<tr><td class="titlefield">Référence</td><td><strong>'.$oibt->ref.'</strong></td></tr>';
    print '<tr><td>Intervention</td><td><a href="smelec_intervention_card.php?id='.$oibt->fk_intervention.'">'.$oibt->intervention_ref.'</a></td></tr>';
    print '<tr><td>Client</td><td>'.$oibt->client_name.'</td></tr>';
    print '<tr><td>Date contrôle</td><td>'.dol_print_date($db->jdate($oibt->date_control), 'day').'</td></tr>';
    print '<tr><td>Type installation</td><td>'.ucfirst($oibt->installation_type).'</td></tr>';
    print '<tr><td>Année installation</td><td>'.$oibt->installation_year.'</td></tr>';
    
    print '</table>';
    print '</div>';
    
    print '<div class="fichehalfright">';
    print '<div class="underbanner clearboth"></div>';
    print '<table class="border tableforfield centpercent">';
    
    // Résultat global avec badge coloré
    $resultBadges = array(
        'conforme' => '<span class="badge badge-status4" style="font-size: 14px;">✓ CONFORME</span>',
        'non_conforme' => '<span class="badge badge-status8" style="font-size: 14px;">✗ NON CONFORME</span>',
        'reserve' => '<span class="badge badge-status1" style="font-size: 14px;">⚠ AVEC RÉSERVES</span>'
    );
    print '<tr><td class="titlefield">Résultat</td><td>'.$resultBadges[$oibt->global_result].'</td></tr>';
    
    print '<tr><td>Tension</td><td>'.($oibt->voltage ? $oibt->voltage.' V' : '-').'</td></tr>';
    print '<tr><td>Ampérage</td><td>'.($oibt->amperage ? $oibt->amperage.' A' : '-').'</td></tr>';
    print '<tr><td>Prochain contrôle</td><td>'.($oibt->next_control_date ? dol_print_date($db->jdate($oibt->next_control_date), 'day') : '-').'</td></tr>';
    
    print '</table>';
    print '</div>';
    print '</div>';
    
    // Mesures
    print '<div class="clearboth"></div><br>';
    print '<div class="div-table-responsive-no-min">';
    print '<table class="noborder centpercent">';
    print '<tr class="liste_titre"><td colspan="4">📊 Mesures électriques</td></tr>';
    print '<tr class="oddeven">';
    print '<td><strong>Résistance isolation:</strong> '.($oibt->isolation_resistance ? $oibt->isolation_resistance.' MΩ' : '-').'</td>';
    print '<td><strong>Résistance terre:</strong> '.($oibt->earth_resistance ? $oibt->earth_resistance.' Ω' : '-').'</td>';
    print '<td><strong>Impédance boucle:</strong> '.($oibt->loop_impedance ? $oibt->loop_impedance.' Ω' : '-').'</td>';
    print '<td><strong>DDR:</strong> '.($oibt->rcd_trip_time ? $oibt->rcd_trip_time.' ms / '.$oibt->rcd_trip_current.' mA' : '-').'</td>';
    print '</tr>';
    print '</table>';
    print '</div>';
    
    // Points de contrôle
    print '<br>';
    print '<div class="div-table-responsive-no-min">';
    print '<table class="noborder centpercent">';
    print '<tr class="liste_titre">';
    print '<td>Code</td><td>Point de contrôle</td><td class="center">Résultat</td><td>Valeur</td><td>Commentaire</td>';
    print '</tr>';
    
    $sql_results = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_oibt_result WHERE fk_oibt = ".(int) $id." ORDER BY check_code";
    $resql_results = $db->query($sql_results);
    while ($check = $db->fetch_object($resql_results)) {
        print '<tr class="oddeven">';
        print '<td>'.$check->check_code.'</td>';
        print '<td>'.$check->check_label.'</td>';
        print '<td class="center">';
        if ($check->result == 'ok') print '<span class="badge badge-status4">✓ OK</span>';
        elseif ($check->result == 'nok') print '<span class="badge badge-status8">✗ NOK</span>';
        else print '<span class="badge badge-status0">N/A</span>';
        print '</td>';
        print '<td>'.$check->measure_value.'</td>';
        print '<td>'.$check->comment.'</td>';
        print '</tr>';
    }
    
    print '</table>';
    print '</div>';
    
    // Commentaires
    if ($oibt->comment_general || $oibt->defects_found || $oibt->recommendations) {
        print '<br>';
        print '<div class="div-table-responsive-no-min">';
        print '<table class="noborder centpercent">';
        print '<tr class="liste_titre"><td colspan="2">📝 Observations</td></tr>';
        if ($oibt->comment_general) {
            print '<tr class="oddeven"><td class="titlefield">Commentaire général</td><td>'.nl2br($oibt->comment_general).'</td></tr>';
        }
        if ($oibt->defects_found) {
            print '<tr class="oddeven"><td>Défauts constatés</td><td>'.nl2br($oibt->defects_found).'</td></tr>';
        }
        if ($oibt->recommendations) {
            print '<tr class="oddeven"><td>Recommandations</td><td>'.nl2br($oibt->recommendations).'</td></tr>';
        }
        print '</table>';
        print '</div>';
    }
    
    // Actions
    print '<div class="tabsAction">';
    print '<a class="butAction" href="'.$_SERVER["PHP_SELF"].'?id='.$id.'&action=generate_pdf&token='.newToken().'">Générer PDF</a>';
    if ($oibt->pdf_path) {
        print '<a class="butAction" href="'.DOL_URL_ROOT.'/document.php?modulepart=smartelectric&file=oibt/'.basename($oibt->pdf_path).'" target="_blank">Voir PDF</a>';
    }
    print '</div>';
}

// List of OIBT controls (if no ID)
if (!$id && $action != 'create') {
    print load_fiche_titre('Liste des contrôles OIBT', '<a class="butAction" href="'.$_SERVER["PHP_SELF"].'?action=create">Nouveau contrôle</a>', 'fa-clipboard-check');
    
    $sql = "SELECT o.rowid, o.ref, o.date_control, o.global_result, o.installation_type,";
    $sql .= " i.ref as intervention_ref, s.nom as client_name";
    $sql .= " FROM ".MAIN_DB_PREFIX."smelec_oibt o";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."smelec_intervention i ON i.rowid = o.fk_intervention";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = o.fk_soc";
    $sql .= " WHERE 1=1";
    $sql .= " ORDER BY o.date_control DESC";
    $sql .= " LIMIT 100";
    
    $resql = $db->query($sql);
    
    print '<div class="div-table-responsive-no-min">';
    print '<table class="tagtable nobottomiftotal liste">';
    print '<tr class="liste_titre">';
    print '<td>Référence</td><td>Intervention</td><td>Client</td><td>Date</td><td>Type</td><td class="center">Résultat</td><td>Actions</td>';
    print '</tr>';
    
    while ($obj = $db->fetch_object($resql)) {
        print '<tr class="oddeven">';
        print '<td><a href="'.$_SERVER["PHP_SELF"].'?id='.$obj->rowid.'">'.$obj->ref.'</a></td>';
        print '<td>'.$obj->intervention_ref.'</td>';
        print '<td>'.$obj->client_name.'</td>';
        print '<td>'.dol_print_date($db->jdate($obj->date_control), 'day').'</td>';
        print '<td>'.ucfirst($obj->installation_type).'</td>';
        print '<td class="center">';
        if ($obj->global_result == 'conforme') print '<span class="badge badge-status4">Conforme</span>';
        elseif ($obj->global_result == 'non_conforme') print '<span class="badge badge-status8">Non conforme</span>';
        else print '<span class="badge badge-status1">Réserves</span>';
        print '</td>';
        print '<td><a href="'.$_SERVER["PHP_SELF"].'?id='.$obj->rowid.'">'.img_view().'</a></td>';
        print '</tr>';
    }
    
    if ($db->num_rows($resql) == 0) {
        print '<tr class="oddeven"><td colspan="7" class="opacitymedium center">Aucun contrôle OIBT</td></tr>';
    }
    
    print '</table>';
    print '</div>';
}

llxFooter();
$db->close();
