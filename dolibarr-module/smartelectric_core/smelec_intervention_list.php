<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Liste des interventions SmartElectric
 */

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/date.lib.php';
require_once DOL_DOCUMENT_ROOT.'/core/class/html.formother.class.php';
require_once './class/smelec_intervention.class.php';

$langs->loadLangs(array("smartelectric_core@smartelectric_core", "companies", "projects"));

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

$action = GETPOST('action', 'aZ09');
$massaction = GETPOST('massaction', 'alpha');
$show_files = GETPOST('show_files', 'int');
$confirm = GETPOST('confirm', 'alpha');
$toselect = GETPOST('toselect', 'array');
$contextpage = GETPOST('contextpage', 'aZ') ? GETPOST('contextpage', 'aZ') : 'smelecinterventionlist';

// Search filters
$search_ref = GETPOST('search_ref', 'alpha');
$search_label = GETPOST('search_label', 'alpha');
$search_soc = GETPOST('search_soc', 'alpha');
$search_type = GETPOST('search_type', 'alpha');
$search_status = GETPOST('search_status', 'int');
$search_tech = GETPOST('search_tech', 'int');
$search_date_start = dol_mktime(0, 0, 0, GETPOST('search_date_startmonth', 'int'), GETPOST('search_date_startday', 'int'), GETPOST('search_date_startyear', 'int'));
$search_date_end = dol_mktime(23, 59, 59, GETPOST('search_date_endmonth', 'int'), GETPOST('search_date_endday', 'int'), GETPOST('search_date_endyear', 'int'));

// Pagination
$limit = GETPOST('limit', 'int') ? GETPOST('limit', 'int') : $conf->liste_limit;
$sortfield = GETPOST('sortfield', 'aZ09comma');
$sortorder = GETPOST('sortorder', 'aZ09comma');
$page = GETPOSTISSET('pageplusone') ? (GETPOST('pageplusone') - 1) : GETPOST("page", 'int');
if (empty($page) || $page < 0) $page = 0;
$offset = $limit * $page;
if (!$sortfield) $sortfield = 'i.date_planned';
if (!$sortorder) $sortorder = 'DESC';

// Build SQL query
$sql = "SELECT i.rowid, i.ref, i.label, i.type, i.priority, i.status, i.date_planned, i.date_creation,";
$sql .= " s.nom as socname, s.rowid as socid,";
$sql .= " p.ref as project_ref,";
$sql .= " u.login, CONCAT(u.firstname, ' ', u.lastname) as tech_name";
$sql .= " FROM ".MAIN_DB_PREFIX."smelec_intervention as i";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe as s ON s.rowid = i.fk_soc";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."projet as p ON p.rowid = i.fk_project";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user as u ON u.rowid = i.fk_user_tech_main";
$sql .= " WHERE i.entity = ".(int) $conf->entity;

// Filters
if ($search_ref) $sql .= natural_search('i.ref', $search_ref);
if ($search_label) $sql .= natural_search('i.label', $search_label);
if ($search_soc) $sql .= natural_search('s.nom', $search_soc);
if ($search_type) $sql .= " AND i.type = '".$db->escape($search_type)."'";
if ($search_status !== '' && $search_status >= 0) $sql .= " AND i.status = ".(int) $search_status;
if ($search_tech > 0) $sql .= " AND i.fk_user_tech_main = ".(int) $search_tech;
if ($search_date_start) $sql .= " AND i.date_planned >= '".$db->idate($search_date_start)."'";
if ($search_date_end) $sql .= " AND i.date_planned <= '".$db->idate($search_date_end)."'";

// Count total
$nbtotalofrecords = '';
if (empty($conf->global->MAIN_DISABLE_FULL_SCANLIST)) {
    $resql = $db->query($sql);
    $nbtotalofrecords = $db->num_rows($resql);
}

$sql .= $db->order($sortfield, $sortorder);
$sql .= $db->plimit($limit + 1, $offset);

$resql = $db->query($sql);
if (!$resql) {
    dol_print_error($db);
    exit;
}

$num = $db->num_rows($resql);

// Page header
llxHeader('', 'Liste des interventions SmartElectric', '');

$form = new Form($db);
$formother = new FormOther($db);

// Title
$title = 'Liste des interventions';
print load_fiche_titre($title, '', 'fa-bolt');

// Search form
print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'" name="formulaire">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="list">';
print '<input type="hidden" name="sortfield" value="'.$sortfield.'">';
print '<input type="hidden" name="sortorder" value="'.$sortorder.'">';

print '<div class="div-table-responsive-no-min">';
print '<table class="tagtable nobottomiftotal liste'.($moreforfilter ? " listwithfilterbefore" : "").'">';

// Table header
print '<tr class="liste_titre_filter">';
print '<td class="liste_titre"><input type="text" class="flat" name="search_ref" size="8" value="'.dol_escape_htmltag($search_ref).'"></td>';
print '<td class="liste_titre"><input type="text" class="flat" name="search_label" size="15" value="'.dol_escape_htmltag($search_label).'"></td>';
print '<td class="liste_titre"><input type="text" class="flat" name="search_soc" size="15" value="'.dol_escape_htmltag($search_soc).'"></td>';
print '<td class="liste_titre">';
$types = array('installation' => 'Installation', 'depannage' => 'Dépannage', 'renovation' => 'Rénovation', 'tableau' => 'Tableau', 'cuisine' => 'Cuisine', 'oibt' => 'OIBT', 'autre' => 'Autre');
print $form->selectarray('search_type', $types, $search_type, 1, 0, 0, '', 0, 0, 0, '', 'minwidth100');
print '</td>';
print '<td class="liste_titre">';
$statuses = array(0 => 'À planifier', 1 => 'En cours', 2 => 'Terminé', 3 => 'Facturé');
print $form->selectarray('search_status', $statuses, $search_status, 1, 0, 0, '', 0, 0, 0, '', 'minwidth100');
print '</td>';
print '<td class="liste_titre center">';
print $form->selectDate($search_date_start, 'search_date_start', 0, 0, 1, '', 1, 0);
print ' - ';
print $form->selectDate($search_date_end, 'search_date_end', 0, 0, 1, '', 1, 0);
print '</td>';
print '<td class="liste_titre"></td>';
print '<td class="liste_titre center maxwidthsearch">';
print '<input type="image" class="liste_titre" name="button_search" src="'.DOL_URL_ROOT.'/theme/'.$conf->theme.'/img/search.png" value="'.dol_escape_htmltag($langs->trans("Search")).'" title="'.dol_escape_htmltag($langs->trans("Search")).'">';
print '<input type="image" class="liste_titre" name="button_removefilter" src="'.DOL_URL_ROOT.'/theme/'.$conf->theme.'/img/searchclear.png" value="'.dol_escape_htmltag($langs->trans("RemoveFilter")).'" title="'.dol_escape_htmltag($langs->trans("RemoveFilter")).'">';
print '</td>';
print '</tr>';

// Column titles
print '<tr class="liste_titre">';
print_liste_field_titre('Ref', $_SERVER["PHP_SELF"], 'i.ref', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Label', $_SERVER["PHP_SELF"], 'i.label', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Client', $_SERVER["PHP_SELF"], 's.nom', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Type', $_SERVER["PHP_SELF"], 'i.type', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Statut', $_SERVER["PHP_SELF"], 'i.status', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Date planifiée', $_SERVER["PHP_SELF"], 'i.date_planned', '', '', 'align="center"', $sortfield, $sortorder);
print_liste_field_titre('Technicien', $_SERVER["PHP_SELF"], 'tech_name', '', '', '', $sortfield, $sortorder);
print_liste_field_titre('Actions', $_SERVER["PHP_SELF"], '', '', '', 'align="center"', $sortfield, $sortorder);
print '</tr>';

// Data rows
$i = 0;
while ($i < min($num, $limit)) {
    $obj = $db->fetch_object($resql);
    
    print '<tr class="oddeven">';
    
    // Ref
    print '<td class="nowraponall">';
    print '<a href="smelec_intervention_card.php?id='.$obj->rowid.'">'.$obj->ref.'</a>';
    print '</td>';
    
    // Label
    print '<td>'.dol_trunc($obj->label, 40).'</td>';
    
    // Client
    print '<td>';
    if ($obj->socid > 0) {
        print '<a href="'.DOL_URL_ROOT.'/societe/card.php?socid='.$obj->socid.'">'.$obj->socname.'</a>';
    }
    print '</td>';
    
    // Type
    $typeLabels = array('installation' => '🔧 Installation', 'depannage' => '⚡ Dépannage', 'renovation' => '🏠 Rénovation', 'tableau' => '📦 Tableau', 'cuisine' => '🍳 Cuisine', 'oibt' => '📋 OIBT', 'autre' => '📝 Autre');
    print '<td>'.($typeLabels[$obj->type] ?? $obj->type).'</td>';
    
    // Status
    $statusClasses = array(0 => 'status0', 1 => 'status1', 2 => 'status4', 3 => 'status6');
    $statusLabels = array(0 => 'À planifier', 1 => 'En cours', 2 => 'Terminé', 3 => 'Facturé');
    print '<td><span class="badge badge-'.($statusClasses[$obj->status] ?? 'status0').'">'.$statusLabels[$obj->status].'</span></td>';
    
    // Date planned
    print '<td class="center">'.dol_print_date($db->jdate($obj->date_planned), 'day').'</td>';
    
    // Technician
    print '<td>'.($obj->tech_name ?: '-').'</td>';
    
    // Actions
    print '<td class="center nowraponall">';
    print '<a href="smelec_intervention_card.php?id='.$obj->rowid.'" class="paddingright">'.img_edit().'</a>';
    if ($user->rights->smartelectric_core->intervention->delete) {
        print '<a href="'.$_SERVER["PHP_SELF"].'?action=delete&id='.$obj->rowid.'&token='.newToken().'">'.img_delete().'</a>';
    }
    print '</td>';
    
    print '</tr>';
    $i++;
}

if ($num == 0) {
    print '<tr class="oddeven"><td colspan="8" class="opacitymedium center">Aucune intervention trouvée</td></tr>';
}

print '</table>';
print '</div>';

print '</form>';

// New intervention button
print '<div class="tabsAction">';
if ($user->rights->smartelectric_core->intervention->write) {
    print '<a class="butAction" href="smelec_intervention_card.php?action=create">Nouvelle intervention</a>';
}
print '</div>';

llxFooter();
$db->close();
