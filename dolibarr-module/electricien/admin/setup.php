<?php
/* Copyright (C) 2024-2025 MV-3 PRO
 * Page de configuration du module Électricien
 */

// Load Dolibarr environment
$res = 0;
if (!$res && file_exists("../main.inc.php")) $res = @include "../main.inc.php";
if (!$res && file_exists("../../main.inc.php")) $res = @include "../../main.inc.php";
if (!$res && file_exists("../../../main.inc.php")) $res = @include "../../../main.inc.php";
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';

$langs->loadLangs(array("admin", "electricien@electricien"));

if (!$user->admin) accessforbidden();

$action = GETPOST('action', 'aZ09');

// Save settings
if ($action == 'update') {
    dolibarr_set_const($db, "ELECTRICIEN_OIBT_ENABLED", GETPOST('oibt_enabled', 'int'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "ELECTRICIEN_GPS_TRACKING", GETPOST('gps_tracking', 'int'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "ELECTRICIEN_AI_ENABLED", GETPOST('ai_enabled', 'int'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "ELECTRICIEN_AI_API_URL", GETPOST('ai_api_url', 'alpha'), 'chaine', 0, '', $conf->entity);
    dolibarr_set_const($db, "ELECTRICIEN_AI_API_KEY", GETPOST('ai_api_key', 'alpha'), 'chaine', 0, '', $conf->entity);
    setEventMessages('Configuration sauvegardée', null, 'mesgs');
}

llxHeader('', 'Électricien - Configuration');

print load_fiche_titre('⚡ Configuration Électricien PWA', '', 'title_setup');

print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="update">';

// General Settings
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="3">Paramètres généraux</td></tr>';

print '<tr class="oddeven">';
print '<td>Activer les contrôles OIBT</td>';
print '<td>'.$form->selectyesno('oibt_enabled', $conf->global->ELECTRICIEN_OIBT_ENABLED, 1).'</td>';
print '<td>Permet d\'effectuer des contrôles OIBT avec génération de rapport PDF</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>Activer le suivi GPS</td>';
print '<td>'.$form->selectyesno('gps_tracking', $conf->global->ELECTRICIEN_GPS_TRACKING, 1).'</td>';
print '<td>Enregistre les coordonnées GPS lors des démarrages/arrêts de travail</td>';
print '</tr>';

print '</table><br>';

// AI Settings
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="3">Configuration IA</td></tr>';

print '<tr class="oddeven">';
print '<td>Activer les fonctions IA</td>';
print '<td>'.$form->selectyesno('ai_enabled', $conf->global->ELECTRICIEN_AI_ENABLED, 1).'</td>';
print '<td>Active la génération automatique de résumés et diagnostics</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>URL de l\'API IA</td>';
print '<td><input type="text" name="ai_api_url" value="'.dol_escape_htmltag($conf->global->ELECTRICIEN_AI_API_URL).'" size="50"></td>';
print '<td>Ex: https://api.openai.com/v1/chat/completions</td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>Clé API IA</td>';
print '<td><input type="password" name="ai_api_key" value="'.($conf->global->ELECTRICIEN_AI_API_KEY ? '********' : '').'" size="50" placeholder="Laisser vide pour conserver la clé actuelle"></td>';
print '<td>Laisser vide pour conserver la clé actuelle</td>';
print '</tr>';

print '</table><br>';

// PWA Info
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Application Mobile (PWA)</td></tr>';

print '<tr class="oddeven">';
print '<td>URL de l\'API REST</td>';
print '<td><code>'.DOL_MAIN_URL_ROOT.'/api/index.php/electricien</code></td>';
print '</tr>';

print '<tr class="oddeven">';
print '<td>Documentation API</td>';
print '<td>Les endpoints disponibles sont documentés dans <code>/custom/electricien/doc/api.md</code></td>';
print '</tr>';

print '</table><br>';

print '<div class="center"><input type="submit" class="button" value="Enregistrer"></div>';

print '</form>';

llxFooter();
$db->close();
