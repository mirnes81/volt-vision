<?php
/* Copyright (C) 2024-2025 SmartElectric Suite / MV-3 PRO
 * OIBT Controls List
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
require_once DOL_DOCUMENT_ROOT.'/core/class/html.formfile.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/smartelectric_core/class/smelec_intervention.class.php';

// Load translation files
$langs->loadLangs(array("smartelectric_core@smartelectric_core", "other"));

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

// Parameters
$action = GETPOST('action', 'aZ09');
$massaction = GETPOST('massaction', 'alpha');
$search_ref = GETPOST('search_ref', 'alpha');
$search_label = GETPOST('search_label', 'alpha');
$search_status = GETPOST('search_status', 'int');

$sortfield = GETPOST('sortfield', 'aZ09comma');
$sortorder = GETPOST('sortorder', 'aZ09comma');
$page = GETPOSTISSET('pageplusone') ? (GETPOST('pageplusone') - 1) : GETPOST("page", 'int');
$limit = GETPOST('limit', 'int') ? GETPOST('limit', 'int') : $conf->liste_limit;
$offset = $limit * $page;

if (empty($sortfield)) {
    $sortfield = "o.date_control";
}
if (empty($sortorder)) {
    $sortorder = "DESC";
}

/*
 * View
 */

$form = new Form($db);

$title = 'Contrôles OIBT';
llxHeader('', $title);

print load_fiche_titre($title, '', 'fa-clipboard-check');

// Build SQL query
$sql = "SELECT o.rowid, o.ref, o.fk_intervention, o.installation_type, o.voltage, o.date_control, o.status, o.overall_status, o.conformity_level";
$sql .= ", i.ref as intervention_ref, i.label as intervention_label, s.nom as client_name";
$sql .= " FROM ".MAIN_DB_PREFIX."smelec_oibt o";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."smelec_intervention i ON i.rowid = o.fk_intervention";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc";
$sql .= " WHERE o.entity = ".(int) $conf->entity;

if ($search_ref) {
    $sql .= natural_search('o.ref', $search_ref);
}
if ($search_label) {
    $sql .= natural_search('i.label', $search_label);
}
if ($search_status !== '' && $search_status >= 0) {
    $sql .= " AND o.status = ".(int) $search_status;
}

$sql .= " ORDER BY ".$sortfield." ".$sortorder;

// Count total
$resql = $db->query($sql);
$nbtotalofrecords = $db->num_rows($resql);

// Apply limit
$sql .= $db->plimit($limit + 1, $offset);

$resql = $db->query($sql);
if (!$resql) {
    dol_print_error($db);
    exit;
}

$num = $db->num_rows($resql);

// Toolbar
print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="list">';
print '<input type="hidden" name="sortfield" value="'.$sortfield.'">';
print '<input type="hidden" name="sortorder" value="'.$sortorder.'">';

print_barre_liste($title, $page, $_SERVER["PHP_SELF"], '', $sortfield, $sortorder, '', $num, $nbtotalofrecords, 'fa-clipboard-check', 0, '', '', $limit);

print '<div class="div-table-responsive">';
print '<table class="tagtable nobottomiftotal liste">';

// Header row
print '<tr class="liste_titre">';
print_liste_field_titre('Réf.', $_SERVER["PHP_SELF"], 'o.ref', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Intervention', $_SERVER["PHP_SELF"], 'i.ref', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Client', $_SERVER["PHP_SELF"], 's.nom', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Type installation', $_SERVER["PHP_SELF"], 'o.installation_type', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Tension', $_SERVER["PHP_SELF"], 'o.voltage', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Date contrôle', $_SERVER["PHP_SELF"], 'o.date_control', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Conformité', $_SERVER["PHP_SELF"], 'o.conformity_level', '', '', 'align="center"', $sortfield, $sortorder);
print_liste_field_titre('Statut', $_SERVER["PHP_SELF"], 'o.status', '', '', 'align="center"', $sortfield, $sortorder);
print '</tr>';

// Search row
print '<tr class="liste_titre_filter">';
print '<td><input type="text" name="search_ref" value="'.dol_escape_htmltag($search_ref).'" class="maxwidth100"></td>';
print '<td><input type="text" name="search_label" value="'.dol_escape_htmltag($search_label).'" class="maxwidth150"></td>';
print '<td></td>';
print '<td></td>';
print '<td></td>';
print '<td></td>';
print '<td></td>';
print '<td align="center"><input type="submit" class="button" value="'.$langs->trans("Search").'"></td>';
print '</tr>';

// Data rows
$i = 0;
while ($i < min($num, $limit)) {
    $obj = $db->fetch_object($resql);
    
    print '<tr class="oddeven">';
    
    // Ref with link
    print '<td>';
    print '<a href="smelec_oibt_card.php?id='.$obj->rowid.'">'.$obj->ref.'</a>';
    print '</td>';
    
    // Intervention
    print '<td>';
    if ($obj->fk_intervention > 0) {
        print '<a href="smelec_intervention_card.php?id='.$obj->fk_intervention.'">'.$obj->intervention_ref.'</a>';
        print ' - '.$obj->intervention_label;
    }
    print '</td>';
    
    // Client
    print '<td>'.$obj->client_name.'</td>';
    
    // Installation type
    print '<td>'.$obj->installation_type.'</td>';
    
    // Voltage
    print '<td>'.$obj->voltage.'V</td>';
    
    // Date
    print '<td>'.dol_print_date($db->jdate($obj->date_control), 'day').'</td>';
    
    // Conformity level
    print '<td align="center">';
    $conformityColors = array(
        'conforme' => 'badge-status4',
        'non_conforme' => 'badge-status8',
        'a_verifier' => 'badge-status1',
    );
    $color = $conformityColors[$obj->conformity_level] ?? 'badge-status0';
    print '<span class="badge '.$color.'">'.ucfirst(str_replace('_', ' ', $obj->conformity_level)).'</span>';
    print '</td>';
    
    // Status
    print '<td align="center">';
    $statusLabels = array(0 => 'Brouillon', 1 => 'En cours', 2 => 'Terminé', 3 => 'Validé');
    $statusColors = array(0 => 'badge-status0', 1 => 'badge-status1', 2 => 'badge-status4', 3 => 'badge-status6');
    print '<span class="badge '.($statusColors[$obj->status] ?? 'badge-status0').'">'.($statusLabels[$obj->status] ?? 'Inconnu').'</span>';
    print '</td>';
    
    print '</tr>';
    $i++;
}

if ($num == 0) {
    print '<tr class="oddeven"><td colspan="8" class="opacitymedium">Aucun contrôle OIBT trouvé</td></tr>';
}

print '</table>';
print '</div>';
print '</form>';

llxFooter();
$db->close();
