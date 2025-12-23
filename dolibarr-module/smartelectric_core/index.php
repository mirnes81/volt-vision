<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Page d'accueil du module SmartElectric
 */

// Dolibarr environment - try multiple paths for compatibility
$res = 0;
if (!$res && file_exists("../main.inc.php")) $res = @include "../main.inc.php";
if (!$res && file_exists("../../main.inc.php")) $res = @include "../../main.inc.php";
if (!$res && file_exists("../../../main.inc.php")) $res = @include "../../../main.inc.php";
if (!$res) die("Error: main.inc.php not found");

require_once './class/smelec_intervention.class.php';

$langs->loadLangs(array("smartelectric_core@smartelectric_core"));

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

llxHeader('', 'SmartElectric - Tableau de bord', '');

print load_fiche_titre('⚡ SmartElectric Suite', '', 'fa-bolt');

// Stats cards
print '<div class="fichecenter">';

// Quick stats
$sql_stats = "SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as a_planifier,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as en_cours,
    SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as termine,
    SUM(CASE WHEN DATE(date_planned) = CURDATE() THEN 1 ELSE 0 END) as today
FROM ".MAIN_DB_PREFIX."smelec_intervention 
WHERE entity = ".(int) $conf->entity;

$resql = $db->query($sql_stats);
if ($resql) {
    $stats = $db->fetch_object($resql);
} else {
    // Table doesn't exist yet - show zeros
    $stats = (object) array('total' => 0, 'a_planifier' => 0, 'en_cours' => 0, 'termine' => 0, 'today' => 0);
}

print '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">';

// Card: Today's interventions
print '<div class="info-box">';
print '<span class="info-box-icon bg-primary"><i class="fas fa-calendar-day"></i></span>';
print '<div class="info-box-content">';
print '<span class="info-box-text">Aujourd\'hui</span>';
print '<span class="info-box-number">'.$stats->today.'</span>';
print '<span class="info-box-more"><a href="smelec_intervention_list.php?search_date_start='.date('Y-m-d').'">Voir &rarr;</a></span>';
print '</div>';
print '</div>';

// Card: In progress
print '<div class="info-box">';
print '<span class="info-box-icon" style="background-color: #f39c12;"><i class="fas fa-spinner"></i></span>';
print '<div class="info-box-content">';
print '<span class="info-box-text">En cours</span>';
print '<span class="info-box-number">'.$stats->en_cours.'</span>';
print '<span class="info-box-more"><a href="smelec_intervention_list.php?search_status=1">Voir &rarr;</a></span>';
print '</div>';
print '</div>';

// Card: To plan
print '<div class="info-box">';
print '<span class="info-box-icon" style="background-color: #3498db;"><i class="fas fa-clock"></i></span>';
print '<div class="info-box-content">';
print '<span class="info-box-text">À planifier</span>';
print '<span class="info-box-number">'.$stats->a_planifier.'</span>';
print '<span class="info-box-more"><a href="smelec_intervention_list.php?search_status=0">Voir &rarr;</a></span>';
print '</div>';
print '</div>';

// Card: Completed
print '<div class="info-box">';
print '<span class="info-box-icon" style="background-color: #27ae60;"><i class="fas fa-check-circle"></i></span>';
print '<div class="info-box-content">';
print '<span class="info-box-text">Terminées</span>';
print '<span class="info-box-number">'.$stats->termine.'</span>';
print '<span class="info-box-more"><a href="smelec_intervention_list.php?search_status=2">Voir &rarr;</a></span>';
print '</div>';
print '</div>';

print '</div>'; // End stats grid

// Quick actions
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="2">🚀 Actions rapides</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td width="50%">';
print '<a class="butAction" href="smelec_intervention_card.php?action=create" style="margin: 5px;">➕ Nouvelle intervention</a>';
print '<a class="butAction" href="smelec_oibt_card.php?action=create" style="margin: 5px;">📋 Nouveau contrôle OIBT</a>';
print '</td>';
print '<td>';
print '<a class="butAction" href="smelec_intervention_list.php" style="margin: 5px;">📄 Liste interventions</a>';
print '<a class="butAction" href="smelec_dailyreport_list.php" style="margin: 5px;">📊 Rapports journaliers</a>';
print '</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

// Today's interventions
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="6">📅 Interventions du jour</td>';
print '</tr>';
print '<tr class="liste_titre">';
print '<td>Référence</td><td>Client</td><td>Type</td><td>Technicien</td><td>Statut</td><td>Actions</td>';
print '</tr>';

$sql_today = "SELECT i.rowid, i.ref, i.label, i.type, i.status, i.date_planned,";
$sql_today .= " s.nom as client_name,";
$sql_today .= " CONCAT(u.firstname, ' ', u.lastname) as tech_name";
$sql_today .= " FROM ".MAIN_DB_PREFIX."smelec_intervention i";
$sql_today .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc";
$sql_today .= " LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = i.fk_user_tech_main";
$sql_today .= " WHERE i.entity = ".(int) $conf->entity;
$sql_today .= " AND DATE(i.date_planned) = CURDATE()";
$sql_today .= " ORDER BY i.date_planned ASC";
$sql_today .= " LIMIT 10";

$resql_today = $db->query($sql_today);
$num_today = $resql_today ? $db->num_rows($resql_today) : 0;

if ($resql_today && $num_today > 0) {
    while ($obj = $db->fetch_object($resql_today)) {
        $typeLabels = array('installation' => '🔧', 'depannage' => '⚡', 'renovation' => '🏠', 'tableau' => '📦', 'cuisine' => '🍳', 'oibt' => '📋', 'autre' => '📝');
        $statusLabels = array(0 => '<span class="badge badge-status0">À planifier</span>', 1 => '<span class="badge badge-status1">En cours</span>', 2 => '<span class="badge badge-status4">Terminé</span>', 3 => '<span class="badge badge-status6">Facturé</span>');
        
        print '<tr class="oddeven">';
        print '<td><a href="smelec_intervention_card.php?id='.$obj->rowid.'">'.$obj->ref.'</a></td>';
        print '<td>'.$obj->client_name.'</td>';
        print '<td>'.($typeLabels[$obj->type] ?? '').' '.ucfirst($obj->type).'</td>';
        print '<td>'.($obj->tech_name ?: '-').'</td>';
        print '<td>'.$statusLabels[$obj->status].'</td>';
        print '<td><a href="smelec_intervention_card.php?id='.$obj->rowid.'">'.img_edit().'</a></td>';
        print '</tr>';
    }
} else {
    print '<tr class="oddeven"><td colspan="6" class="opacitymedium center">Aucune intervention planifiée aujourd\'hui</td></tr>';
}

print '</table>';
print '</div>';

print '</div>'; // End fichecenter

// PWA Info box
print '<br>';
print '<div class="info-box">';
print '<span class="info-box-icon bg-primary"><i class="fas fa-mobile-alt"></i></span>';
print '<div class="info-box-content">';
print '<span class="info-box-text"><strong>Application Mobile SmartElectric</strong></span>';
print '<span class="info-box-number" style="font-size: 12px; font-weight: normal;">Vos techniciens peuvent utiliser l\'application mobile PWA pour gérer les interventions sur le terrain.</span>';
print '<span class="info-box-more" style="margin-top: 5px;">';
print 'API REST: <code>'.DOL_MAIN_URL_ROOT.'/api/index.php/smartelectric</code>';
print '</span>';
print '</div>';
print '</div>';

llxFooter();
$db->close();
