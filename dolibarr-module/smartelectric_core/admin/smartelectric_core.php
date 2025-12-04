<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Page de configuration du module
 */

require '../../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';

$langs->loadLangs(array("admin", "smartelectric_core@smartelectric_core"));

// Security check
if (!$user->admin) {
    accessforbidden();
}

$action = GETPOST('action', 'aZ09');

// Actions
if ($action == 'update') {
    $error = 0;

    // AI Settings
    dolibarr_set_const($db, "SMELEC_AI_ENABLED", GETPOST('SMELEC_AI_ENABLED', 'int'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "SMELEC_AI_API_URL", GETPOST('SMELEC_AI_API_URL', 'alpha'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "SMELEC_AI_API_KEY", GETPOST('SMELEC_AI_API_KEY', 'alpha'), 'chaine', 0, '', $conf->entity);

    // Features
    dolibarr_set_const($db, "SMELEC_OIBT_ENABLED", GETPOST('SMELEC_OIBT_ENABLED', 'int'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "SMELEC_GPS_TRACKING", GETPOST('SMELEC_GPS_TRACKING', 'int'), 'chaine', 0, '', $conf->entity);

    // Work types
    dolibarr_set_const($db, "SMELEC_WORK_TYPES", GETPOST('SMELEC_WORK_TYPES', 'alpha'), 'chaine', 0, '', $conf->entity);

    if (!$error) {
        setEventMessages('Configuration sauvegardée', null, 'mesgs');
    }
}

// Page Header
llxHeader('', 'Configuration SmartElectric', '');

print load_fiche_titre('Configuration SmartElectric Core', '', 'fa-bolt');

print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="update">';

// AI Settings
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="2">⚡ Intelligence Artificielle</td>';
print '</tr>';

// Enable AI
print '<tr class="oddeven">';
print '<td>Activer les fonctionnalités IA</td>';
print '<td>';
print $form->selectyesno('SMELEC_AI_ENABLED', $conf->global->SMELEC_AI_ENABLED, 1);
print '</td>';
print '</tr>';

// AI API URL
print '<tr class="oddeven">';
print '<td>URL de l\'API IA</td>';
print '<td>';
print '<input type="text" name="SMELEC_AI_API_URL" class="minwidth400" value="'.dol_escape_htmltag($conf->global->SMELEC_AI_API_URL).'" placeholder="https://api.openai.com/v1/chat/completions">';
print '</td>';
print '</tr>';

// AI API Key
print '<tr class="oddeven">';
print '<td>Clé API IA</td>';
print '<td>';
print '<input type="password" name="SMELEC_AI_API_KEY" class="minwidth300" value="'.dol_escape_htmltag($conf->global->SMELEC_AI_API_KEY).'">';
print '</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

// Features Settings
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="2">🔧 Fonctionnalités</td>';
print '</tr>';

// OIBT
print '<tr class="oddeven">';
print '<td>Activer les contrôles OIBT</td>';
print '<td>';
print $form->selectyesno('SMELEC_OIBT_ENABLED', $conf->global->SMELEC_OIBT_ENABLED ?? 1, 1);
print '</td>';
print '</tr>';

// GPS Tracking
print '<tr class="oddeven">';
print '<td>Activer le suivi GPS</td>';
print '<td>';
print $form->selectyesno('SMELEC_GPS_TRACKING', $conf->global->SMELEC_GPS_TRACKING ?? 1, 1);
print '</td>';
print '</tr>';

// Work types
print '<tr class="oddeven">';
print '<td>Types d\'heures (séparés par virgule)</td>';
print '<td>';
print '<input type="text" name="SMELEC_WORK_TYPES" class="minwidth400" value="'.dol_escape_htmltag($conf->global->SMELEC_WORK_TYPES ?? 'travail,deplacement,pause').'">';
print '</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

// PWA Info
print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre">';
print '<td colspan="2">📱 Application Mobile (PWA)</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>URL de l\'API REST</td>';
print '<td>';
$apiUrl = DOL_MAIN_URL_ROOT.'/api/index.php/smartelectric';
print '<code>'.$apiUrl.'</code>';
print '</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>Documentation API</td>';
print '<td>';
print '<a href="'.DOL_URL_ROOT.'/custom/smartelectric_core/doc/api.md" target="_blank">Voir la documentation</a>';
print '</td>';
print '</tr>';

print '</table>';
print '</div>';

print '<br>';

print '<div class="center">';
print '<input type="submit" class="button button-save" value="Enregistrer">';
print '</div>';

print '</form>';

llxFooter();
$db->close();
