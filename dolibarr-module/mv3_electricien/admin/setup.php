<?php
/* Copyright (C) 2024 MV-3 PRO Électricien
 * Module configuration page
 */

// Load Dolibarr environment
$res = 0;
if (!$res && file_exists("../main.inc.php")) $res = @include "../main.inc.php";
if (!$res && file_exists("../../main.inc.php")) $res = @include "../../main.inc.php";
if (!$res && file_exists("../../../main.inc.php")) $res = @include "../../../main.inc.php";
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';

// Access control
if (!$user->admin) accessforbidden();

$langs->loadLangs(array("admin", "mv3_electricien@mv3_electricien"));

$action = GETPOST('action', 'aZ09');

// Actions
if ($action == 'update') {
    $error = 0;

    // General settings
    if (!$error) {
        $res = dolibarr_set_const($db, "MV3EL_OIBT_ENABLED", GETPOST('MV3EL_OIBT_ENABLED', 'int'), 'chaine', 0, '', $conf->entity);
        if (!$res > 0) $error++;
    }
    if (!$error) {
        $res = dolibarr_set_const($db, "MV3EL_GPS_TRACKING", GETPOST('MV3EL_GPS_TRACKING', 'int'), 'chaine', 0, '', $conf->entity);
        if (!$res > 0) $error++;
    }

    // AI settings
    if (!$error) {
        $res = dolibarr_set_const($db, "MV3EL_AI_ENABLED", GETPOST('MV3EL_AI_ENABLED', 'int'), 'chaine', 0, '', $conf->entity);
        if (!$res > 0) $error++;
    }
    if (!$error) {
        $res = dolibarr_set_const($db, "MV3EL_AI_API_URL", GETPOST('MV3EL_AI_API_URL', 'alpha'), 'chaine', 0, '', $conf->entity);
        if (!$res > 0) $error++;
    }
    if (!$error && GETPOST('MV3EL_AI_API_KEY', 'alpha')) {
        $res = dolibarr_set_const($db, "MV3EL_AI_API_KEY", GETPOST('MV3EL_AI_API_KEY', 'alpha'), 'chaine', 0, '', $conf->entity);
        if (!$res > 0) $error++;
    }

    if (!$error) {
        setEventMessages($langs->trans("SetupSaved"), null, 'mesgs');
    } else {
        setEventMessages($langs->trans("Error"), null, 'errors');
    }
}

/*
 * View
 */

$page_name = "MV3 Électricien - Configuration";
llxHeader('', $page_name);

$linkback = '<a href="'.DOL_URL_ROOT.'/admin/modules.php?restore_lastsearch_values=1">'.$langs->trans("BackToModuleList").'</a>';
print load_fiche_titre($page_name, $linkback, 'fa-bolt');

print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="update">';

// General settings
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="3">Paramètres généraux</td></tr>';

// OIBT Controls
print '<tr class="oddeven">';
print '<td>Activer les contrôles OIBT</td>';
print '<td>';
print '<input type="checkbox" name="MV3EL_OIBT_ENABLED" value="1"'.($conf->global->MV3EL_OIBT_ENABLED ? ' checked' : '').'>';
print '</td>';
print '<td class="nowrap">Permet d\'effectuer des contrôles OIBT avec génération de rapport PDF</td>';
print '</tr>';

// GPS Tracking
print '<tr class="oddeven">';
print '<td>Activer le suivi GPS</td>';
print '<td>';
print '<input type="checkbox" name="MV3EL_GPS_TRACKING" value="1"'.($conf->global->MV3EL_GPS_TRACKING ? ' checked' : '').'>';
print '</td>';
print '<td class="nowrap">Enregistre les coordonnées GPS lors des démarrages/arrêts de travail</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

// AI settings
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="3">Configuration IA</td></tr>';

// AI Enabled
print '<tr class="oddeven">';
print '<td>Activer les fonctions IA</td>';
print '<td>';
print '<input type="checkbox" name="MV3EL_AI_ENABLED" value="1"'.($conf->global->MV3EL_AI_ENABLED ? ' checked' : '').'>';
print '</td>';
print '<td class="nowrap">Active la génération automatique de résumés et diagnostics</td>';
print '</tr>';

// AI API URL
print '<tr class="oddeven">';
print '<td>URL de l\'API IA</td>';
print '<td>';
print '<input type="text" class="flat minwidth400" name="MV3EL_AI_API_URL" value="'.dol_escape_htmltag($conf->global->MV3EL_AI_API_URL).'">';
print '</td>';
print '<td class="nowrap">Ex: https://api.openai.com/v1/chat/completions</td>';
print '</tr>';

// AI API Key
print '<tr class="oddeven">';
print '<td>Clé API IA</td>';
print '<td>';
print '<input type="password" class="flat minwidth400" name="MV3EL_AI_API_KEY" placeholder="'.($conf->global->MV3EL_AI_API_KEY ? '******** (inchangé)' : 'Entrer la clé API').'">';
print '</td>';
print '<td class="nowrap">Laisser vide pour conserver la clé actuelle</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

// PWA Information
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Application Mobile (PWA)</td></tr>';

print '<tr class="oddeven">';
print '<td>URL de l\'API REST</td>';
print '<td><code>'.DOL_URL_ROOT.'/api/index.php/mv3electricien</code></td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>Documentation API</td>';
print '<td>Les endpoints disponibles sont documentés dans <code>/custom/mv3_electricien/doc/api.md</code></td>';
print '</tr>';

print '</table>';
print '</div>';

print '<div class="center">';
print '<input type="submit" class="button button-save" value="'.$langs->trans("Save").'">';
print '</div>';

print '</form>';

llxFooter();
$db->close();
