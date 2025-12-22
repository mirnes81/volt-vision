<?php
/* Copyright (C) 2024-2025 SmartElectric Suite / MV-3 PRO
 * Statistics Page
 */

// Load Dolibarr environment
$res = 0;
if (!$res && !empty($_SERVER["CONTEXT_DOCUMENT_ROOT"])) {
    $res = @include $_SERVER["CONTEXT_DOCUMENT_ROOT"]."/main.inc.php";
}
if (!$res) {
    $res = @include "../main.inc.php";
}
if (!$res) {
    $res = @include "../../main.inc.php";
}
if (!$res) {
    $res = @include "../../../main.inc.php";
}
if (!$res) {
    die("Include of main fails");
}

require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';

// Load translation files
$langs->loadLangs(array("smartelectric_core@smartelectric_core", "other"));

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

// Parameters
$year = GETPOST('year', 'int') ?: date('Y');
$month = GETPOST('month', 'int') ?: 0;

/*
 * View
 */

llxHeader('', 'Statistiques SmartElectric');

print load_fiche_titre('Statistiques SmartElectric', '', 'fa-chart-bar');

// Year/Month filter
print '<div class="fichecenter">';
print '<form method="GET" action="'.$_SERVER["PHP_SELF"].'">';
print '<div class="tabBar">';
print '<div class="inline-block marginrightonly">';
print '<label for="year">Année:</label> ';
print '<select name="year" id="year" class="flat">';
for ($y = date('Y'); $y >= date('Y') - 5; $y--) {
    print '<option value="'.$y.'"'.($year == $y ? ' selected' : '').'>'.$y.'</option>';
}
print '</select>';
print '</div>';
print '<div class="inline-block marginrightonly">';
print '<label for="month">Mois:</label> ';
print '<select name="month" id="month" class="flat">';
print '<option value="0">Tous</option>';
for ($m = 1; $m <= 12; $m++) {
    print '<option value="'.$m.'"'.($month == $m ? ' selected' : '').'>'.dol_print_date(mktime(0, 0, 0, $m, 1, $year), '%B').'</option>';
}
print '</select>';
print '</div>';
print '<input type="submit" class="button" value="Filtrer">';
print '</div>';
print '</form>';
print '</div>';

print '<br>';

// Statistics queries
$dateFilter = " AND YEAR(i.date_creation) = ".(int) $year;
if ($month > 0) {
    $dateFilter .= " AND MONTH(i.date_creation) = ".(int) $month;
}

// Total interventions
$sql = "SELECT COUNT(*) as total FROM ".MAIN_DB_PREFIX."smelec_intervention i WHERE i.entity = ".(int) $conf->entity.$dateFilter;
$resql = $db->query($sql);
$totalInterventions = $db->fetch_object($resql)->total;

// By status
$sql = "SELECT i.status, COUNT(*) as cnt FROM ".MAIN_DB_PREFIX."smelec_intervention i WHERE i.entity = ".(int) $conf->entity.$dateFilter." GROUP BY i.status ORDER BY i.status";
$resql = $db->query($sql);
$statsByStatus = array();
while ($obj = $db->fetch_object($resql)) {
    $statsByStatus[$obj->status] = $obj->cnt;
}

// By type
$sql = "SELECT i.type, COUNT(*) as cnt FROM ".MAIN_DB_PREFIX."smelec_intervention i WHERE i.entity = ".(int) $conf->entity.$dateFilter." GROUP BY i.type ORDER BY cnt DESC";
$resql = $db->query($sql);
$statsByType = array();
while ($obj = $db->fetch_object($resql)) {
    $statsByType[$obj->type] = $obj->cnt;
}

// Total hours worked
$sql = "SELECT COALESCE(SUM(wh.duration_hours), 0) as total_hours FROM ".MAIN_DB_PREFIX."smelec_workerhours wh ";
$sql .= "INNER JOIN ".MAIN_DB_PREFIX."smelec_intervention i ON i.rowid = wh.fk_intervention ";
$sql .= "WHERE i.entity = ".(int) $conf->entity.$dateFilter;
$resql = $db->query($sql);
$totalHours = round($db->fetch_object($resql)->total_hours, 1);

// Monthly breakdown
$sql = "SELECT MONTH(i.date_creation) as month, COUNT(*) as cnt FROM ".MAIN_DB_PREFIX."smelec_intervention i ";
$sql .= "WHERE i.entity = ".(int) $conf->entity." AND YEAR(i.date_creation) = ".(int) $year." ";
$sql .= "GROUP BY MONTH(i.date_creation) ORDER BY month";
$resql = $db->query($sql);
$monthlyData = array_fill(1, 12, 0);
while ($obj = $db->fetch_object($resql)) {
    $monthlyData[$obj->month] = $obj->cnt;
}

// Top clients
$sql = "SELECT s.nom, COUNT(*) as cnt FROM ".MAIN_DB_PREFIX."smelec_intervention i ";
$sql .= "LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc ";
$sql .= "WHERE i.entity = ".(int) $conf->entity.$dateFilter." AND i.fk_soc > 0 ";
$sql .= "GROUP BY i.fk_soc ORDER BY cnt DESC LIMIT 10";
$resql = $db->query($sql);
$topClients = array();
while ($obj = $db->fetch_object($resql)) {
    $topClients[$obj->nom] = $obj->cnt;
}

// Display statistics cards
print '<div class="fichecenter">';
print '<div class="div-table-responsive-no-min">';
print '<table class="centpercent noborder">';
print '<tr class="liste_titre"><td colspan="4">Résumé - '.$year.($month > 0 ? ' / '.dol_print_date(mktime(0, 0, 0, $month, 1, $year), '%B') : '').'</td></tr>';

print '<tr class="oddeven">';
print '<td style="width:25%"><div class="info-box" style="margin:0;background:#3b82f6;color:white;padding:15px;text-align:center;border-radius:8px;">';
print '<div style="font-size:2em;font-weight:bold;">'.$totalInterventions.'</div>';
print '<div>Interventions</div>';
print '</div></td>';

print '<td style="width:25%"><div class="info-box" style="margin:0;background:#10b981;color:white;padding:15px;text-align:center;border-radius:8px;">';
print '<div style="font-size:2em;font-weight:bold;">'.($statsByStatus[2] ?? 0).'</div>';
print '<div>Terminées</div>';
print '</div></td>';

print '<td style="width:25%"><div class="info-box" style="margin:0;background:#f59e0b;color:white;padding:15px;text-align:center;border-radius:8px;">';
print '<div style="font-size:2em;font-weight:bold;">'.($statsByStatus[1] ?? 0).'</div>';
print '<div>En cours</div>';
print '</div></td>';

print '<td style="width:25%"><div class="info-box" style="margin:0;background:#8b5cf6;color:white;padding:15px;text-align:center;border-radius:8px;">';
print '<div style="font-size:2em;font-weight:bold;">'.$totalHours.'h</div>';
print '<div>Heures travaillées</div>';
print '</div></td>';
print '</tr>';
print '</table>';
print '</div>';
print '</div>';

print '<br>';

// Two column layout
print '<div class="fichecenter">';
print '<div class="fichehalfleft">';

// By type
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Par type d\'intervention</td></tr>';
$typeLabels = array(
    'depannage' => 'Dépannage',
    'installation' => 'Installation',
    'maintenance' => 'Maintenance',
    'controle' => 'Contrôle',
    'oibt' => 'OIBT',
);
foreach ($statsByType as $type => $count) {
    print '<tr class="oddeven">';
    print '<td>'.($typeLabels[$type] ?? ucfirst($type)).'</td>';
    print '<td align="right"><strong>'.$count.'</strong></td>';
    print '</tr>';
}
if (empty($statsByType)) {
    print '<tr class="oddeven"><td colspan="2" class="opacitymedium">Aucune donnée</td></tr>';
}
print '</table>';

print '</div>';
print '<div class="fichehalfright">';

// Top clients
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Top 10 clients</td></tr>';
foreach ($topClients as $client => $count) {
    print '<tr class="oddeven">';
    print '<td>'.$client.'</td>';
    print '<td align="right"><strong>'.$count.'</strong></td>';
    print '</tr>';
}
if (empty($topClients)) {
    print '<tr class="oddeven"><td colspan="2" class="opacitymedium">Aucune donnée</td></tr>';
}
print '</table>';

print '</div>';
print '</div>';

print '<div class="clearboth"></div><br>';

// Monthly chart (simple text-based)
print '<div class="fichecenter">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="13">Évolution mensuelle '.$year.'</td></tr>';
print '<tr class="oddeven">';
for ($m = 1; $m <= 12; $m++) {
    print '<td style="text-align:center;font-size:0.8em;">'.dol_print_date(mktime(0, 0, 0, $m, 1, $year), '%b').'</td>';
}
print '</tr>';
print '<tr class="oddeven">';
$maxMonthly = max($monthlyData) ?: 1;
for ($m = 1; $m <= 12; $m++) {
    $val = $monthlyData[$m];
    $height = round(($val / $maxMonthly) * 60);
    print '<td style="text-align:center;vertical-align:bottom;">';
    print '<div style="background:#3b82f6;height:'.$height.'px;width:20px;margin:0 auto;border-radius:3px 3px 0 0;"></div>';
    print '<div style="font-size:0.9em;font-weight:bold;">'.$val.'</div>';
    print '</td>';
}
print '</tr>';
print '</table>';
print '</div>';

llxFooter();
$db->close();
