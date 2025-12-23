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

// API Status Check
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Vérification API</td></tr>';

// Check if API class exists
$apiClassFile = dol_buildpath('/electricien/class/api_electricien.class.php', 0);
print '<tr class="oddeven">';
print '<td>Fichier API</td>';
if (file_exists($apiClassFile)) {
    print '<td><span style="color:green;">✓ Trouvé</span> - '.$apiClassFile.'</td>';
} else {
    print '<td><span style="color:red;">✗ Non trouvé</span> - '.$apiClassFile.'</td>';
}
print '</tr>';

// Check module API registration
print '<tr class="oddeven">';
print '<td>Module API activé</td>';
$moduleFile = dol_buildpath('/electricien/core/modules/modElectricien.class.php', 0);
$moduleContent = file_get_contents($moduleFile);
if (strpos($moduleContent, "'api' => 1") !== false || strpos($moduleContent, '"api" => 1') !== false) {
    print '<td><span style="color:green;">✓ Oui</span></td>';
} else {
    print '<td><span style="color:red;">✗ Non - Ajoutez "api" => 1 dans module_parts</span></td>';
}
print '</tr>';

// Test API endpoint
print '<tr class="oddeven">';
print '<td>Test endpoint /status</td>';
print '<td><a href="'.DOL_MAIN_URL_ROOT.'/api/index.php/electricien/status" target="_blank" class="button">Tester /status</a></td>';
print '</tr>';

print '</table><br>';

// Show API endpoints
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td colspan="2">Endpoints API disponibles</td></tr>';

$endpoints = array(
    'GET /status' => 'Vérifier le statut de l\'API (public)',
    'POST /login' => 'Authentification (login, password)',
    'GET /interventions/today' => 'Interventions du jour',
    'GET /interventions/{id}' => 'Détails d\'une intervention',
    'PUT /interventions/{id}' => 'Mettre à jour une intervention',
    'POST /interventions/{id}/lines' => 'Ajouter une ligne/heures',
    'GET /products' => 'Liste des produits/matériaux',
);

foreach ($endpoints as $endpoint => $description) {
    print '<tr class="oddeven">';
    print '<td><code>'.$endpoint.'</code></td>';
    print '<td>'.$description.'</td>';
    print '</tr>';
}

print '</table><br>';

// Show API code preview
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><td>Aperçu du code API (api_electricien.class.php)</td></tr>';
print '<tr class="oddeven"><td>';
if (file_exists($apiClassFile)) {
    $code = file_get_contents($apiClassFile);
    $code = htmlspecialchars($code);
    print '<pre style="max-height:400px;overflow:auto;background:#f5f5f5;padding:10px;font-size:11px;">'.$code.'</pre>';
} else {
    print '<span style="color:red;">Fichier non trouvé</span>';
}
print '</td></tr>';
print '</table><br>';

print '<div class="center"><input type="submit" class="button" value="Enregistrer"></div>';

print '</form>';

llxFooter();
$db->close();
