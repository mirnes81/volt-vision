<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Liste des rapports journaliers
 */

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/date.lib.php';

$langs->loadLangs(array("smartelectric_core@smartelectric_core"));

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

$action = GETPOST('action', 'aZ09');
$date_filter = GETPOST('date_filter', 'alpha');
$user_filter = GETPOST('user_filter', 'int');

$form = new Form($db);

/*
 * ACTIONS
 */

// Generate daily report
if ($action == 'generate') {
    $report_date = GETPOST('report_date', 'alpha') ?: date('Y-m-d');
    $report_user = GETPOST('report_user', 'int') ?: $user->id;
    
    // Get interventions for the day
    $sql = "SELECT i.rowid, i.ref, i.label, i.type, i.status,";
    $sql .= " s.nom as client_name,";
    $sql .= " (SELECT SUM(wh.duration_hours) FROM ".MAIN_DB_PREFIX."smelec_workerhours wh ";
    $sql .= "  WHERE wh.fk_intervention = i.rowid AND wh.fk_user = ".(int) $report_user.") as total_hours";
    $sql .= " FROM ".MAIN_DB_PREFIX."smelec_intervention i";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc";
    $sql .= " WHERE DATE(i.date_planned) = '".$db->escape($report_date)."'";
    $sql .= " AND (i.fk_user_tech_main = ".(int) $report_user." OR i.fk_user_author = ".(int) $report_user.")";
    
    $resql = $db->query($sql);
    $interventions = array();
    $total_hours = 0;
    
    while ($obj = $db->fetch_object($resql)) {
        $interventions[] = array(
            'id' => $obj->rowid,
            'ref' => $obj->ref,
            'label' => $obj->label,
            'type' => $obj->type,
            'status' => $obj->status,
            'client' => $obj->client_name,
            'hours' => floatval($obj->total_hours)
        );
        $total_hours += floatval($obj->total_hours);
    }
    
    // Check if report already exists
    $sql_check = "SELECT rowid FROM ".MAIN_DB_PREFIX."smelec_dailyreport ";
    $sql_check .= "WHERE fk_user = ".(int) $report_user." AND report_date = '".$db->escape($report_date)."'";
    $resql_check = $db->query($sql_check);
    
    if ($db->num_rows($resql_check) > 0) {
        // Update existing
        $existing = $db->fetch_object($resql_check);
        $sql_update = "UPDATE ".MAIN_DB_PREFIX."smelec_dailyreport SET ";
        $sql_update .= "total_hours = ".floatval($total_hours).", ";
        $sql_update .= "interventions_json = '".$db->escape(json_encode($interventions))."' ";
        $sql_update .= "WHERE rowid = ".(int) $existing->rowid;
        $db->query($sql_update);
        setEventMessages('Rapport journalier mis à jour', null, 'mesgs');
    } else {
        // Create new
        $sql_insert = "INSERT INTO ".MAIN_DB_PREFIX."smelec_dailyreport ";
        $sql_insert .= "(fk_user, report_date, total_hours, interventions_json, date_creation) VALUES (";
        $sql_insert .= (int) $report_user.", ";
        $sql_insert .= "'".$db->escape($report_date)."', ";
        $sql_insert .= floatval($total_hours).", ";
        $sql_insert .= "'".$db->escape(json_encode($interventions))."', ";
        $sql_insert .= "'".$db->idate(dol_now())."')";
        $db->query($sql_insert);
        setEventMessages('Rapport journalier créé', null, 'mesgs');
    }
}

/*
 * VIEW
 */

llxHeader('', 'Rapports journaliers SmartElectric', '');

print load_fiche_titre('📊 Rapports journaliers', '', 'fa-calendar-day');

// Filters
print '<form method="GET" action="'.$_SERVER["PHP_SELF"].'">';
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="4">Filtres</td>';
print '</tr>';
print '<tr class="oddeven">';
print '<td class="titlefield">Mois</td>';
print '<td>';
$months = array();
for ($m = 1; $m <= 12; $m++) {
    $months[$m] = dol_print_date(mktime(0, 0, 0, $m, 1), '%B');
}
print $form->selectarray('month_filter', $months, GETPOST('month_filter') ?: date('n'), 0, 0, 0, '', 0, 0, 0, '', 'minwidth150');
print ' ';
print '<input type="number" name="year_filter" class="flat minwidth75" value="'.(GETPOST('year_filter') ?: date('Y')).'" min="2020" max="2100">';
print '</td>';
print '<td>Technicien</td>';
print '<td>';
print $form->select_dolusers($user_filter ?: $user->id, 'user_filter', 1, null, 0, '', '', $conf->entity);
print '</td>';
print '</tr>';
print '<tr class="oddeven">';
print '<td colspan="4" class="center">';
print '<input type="submit" class="button" value="Filtrer">';
print ' <a href="'.$_SERVER["PHP_SELF"].'?action=generate&report_date='.date('Y-m-d').'&report_user='.$user->id.'&token='.newToken().'" class="button">Générer rapport aujourd\'hui</a>';
print '</td>';
print '</tr>';
print '</table>';
print '</div>';
print '</form>';

print '<br>';

// List of reports
$month = GETPOST('month_filter', 'int') ?: date('n');
$year = GETPOST('year_filter', 'int') ?: date('Y');
$selected_user = $user_filter ?: $user->id;

$sql = "SELECT dr.*, u.login, CONCAT(u.firstname, ' ', u.lastname) as user_name";
$sql .= " FROM ".MAIN_DB_PREFIX."smelec_dailyreport dr";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = dr.fk_user";
$sql .= " WHERE MONTH(dr.report_date) = ".(int) $month;
$sql .= " AND YEAR(dr.report_date) = ".(int) $year;
if ($selected_user > 0) {
    $sql .= " AND dr.fk_user = ".(int) $selected_user;
}
$sql .= " ORDER BY dr.report_date DESC";

$resql = $db->query($sql);

print '<div class="div-table-responsive-no-min">';
print '<table class="tagtable nobottomiftotal liste">';
print '<tr class="liste_titre">';
print '<td>Date</td>';
print '<td>Technicien</td>';
print '<td class="center">Interventions</td>';
print '<td class="center">Heures totales</td>';
print '<td class="center">PDF</td>';
print '<td class="center">Actions</td>';
print '</tr>';

$total_month_hours = 0;
$total_interventions = 0;

while ($obj = $db->fetch_object($resql)) {
    $interventions = json_decode($obj->interventions_json, true) ?: array();
    $num_interventions = count($interventions);
    
    print '<tr class="oddeven">';
    
    // Date with day name
    $date_ts = strtotime($obj->report_date);
    print '<td>';
    print '<strong>'.dol_print_date($date_ts, '%A').'</strong><br>';
    print dol_print_date($date_ts, 'day');
    print '</td>';
    
    // User
    print '<td>'.$obj->user_name.'</td>';
    
    // Interventions count
    print '<td class="center">';
    print '<span class="badge badge-status4">'.$num_interventions.'</span>';
    print '</td>';
    
    // Hours
    print '<td class="center">';
    $hours = floatval($obj->total_hours);
    $hours_class = $hours >= 8 ? 'badge-status4' : ($hours >= 4 ? 'badge-status1' : 'badge-status0');
    print '<span class="badge '.$hours_class.'">'.number_format($hours, 1).'h</span>';
    print '</td>';
    
    // PDF
    print '<td class="center">';
    if ($obj->pdf_path) {
        print '<a href="'.DOL_URL_ROOT.'/document.php?modulepart=smartelectric&file=reports/'.basename($obj->pdf_path).'">📄 PDF</a>';
    } else {
        print '<span class="opacitymedium">-</span>';
    }
    print '</td>';
    
    // Actions
    print '<td class="center">';
    print '<a href="smelec_dailyreport_card.php?id='.$obj->rowid.'" title="Voir détail">'.img_view().'</a>';
    print '</td>';
    
    print '</tr>';
    
    // Expandable detail
    if ($num_interventions > 0) {
        print '<tr class="oddeven" style="background: var(--colorbacklinepair2);">';
        print '<td colspan="6" style="padding-left: 40px;">';
        print '<small>';
        foreach ($interventions as $inter) {
            $status_icons = array('a_planifier' => '⏳', 'en_cours' => '🔄', 'termine' => '✅', 'facture' => '💰');
            print ($status_icons[$inter['status']] ?? '•').' ';
            print '<a href="smelec_intervention_card.php?id='.$inter['id'].'">'.$inter['ref'].'</a>';
            print ' - '.$inter['client'];
            print ' <span class="opacitymedium">('.number_format($inter['hours'], 1).'h)</span>';
            print '<br>';
        }
        print '</small>';
        print '</td>';
        print '</tr>';
    }
    
    $total_month_hours += $hours;
    $total_interventions += $num_interventions;
}

if ($db->num_rows($resql) == 0) {
    print '<tr class="oddeven"><td colspan="6" class="opacitymedium center">Aucun rapport pour cette période</td></tr>';
}

// Totals
print '<tr class="liste_total">';
print '<td colspan="2"><strong>Total du mois</strong></td>';
print '<td class="center"><strong>'.$total_interventions.'</strong></td>';
print '<td class="center"><strong>'.number_format($total_month_hours, 1).'h</strong></td>';
print '<td colspan="2"></td>';
print '</tr>';

print '</table>';
print '</div>';

// Monthly summary
print '<br>';
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">📈 Résumé mensuel - '.dol_print_date(mktime(0, 0, 0, $month, 1, $year), '%B %Y').'</td></tr>';

$working_days = 0;
$days_in_month = cal_days_in_month(CAL_GREGORIAN, $month, $year);
for ($d = 1; $d <= $days_in_month; $d++) {
    $dow = date('N', mktime(0, 0, 0, $month, $d, $year));
    if ($dow < 6) $working_days++; // Lun-Ven
}

print '<tr class="oddeven"><td class="titlefield">Jours ouvrés</td><td>'.$working_days.' jours</td></tr>';
print '<tr class="oddeven"><td>Heures théoriques (8h/jour)</td><td>'.($working_days * 8).'h</td></tr>';
print '<tr class="oddeven"><td>Heures travaillées</td><td><strong>'.number_format($total_month_hours, 1).'h</strong></td></tr>';

$efficiency = $working_days > 0 ? ($total_month_hours / ($working_days * 8)) * 100 : 0;
$eff_class = $efficiency >= 90 ? 'badge-status4' : ($efficiency >= 70 ? 'badge-status1' : 'badge-status8');
print '<tr class="oddeven"><td>Taux d\'occupation</td><td><span class="badge '.$eff_class.'">'.number_format($efficiency, 1).'%</span></td></tr>';

print '<tr class="oddeven"><td>Moyenne interventions/jour</td><td>'.number_format($total_interventions / max(1, $db->num_rows($resql)), 1).'</td></tr>';

print '</table>';
print '</div>';

llxFooter();
$db->close();
