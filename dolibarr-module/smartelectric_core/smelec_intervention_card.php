<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * Fiche intervention SmartElectric
 */

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/company.lib.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/project.lib.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once './class/smelec_intervention.class.php';
require_once './class/smelec_aiclient.class.php';

$langs->loadLangs(array("smartelectric_core@smartelectric_core", "companies", "projects"));

$id = GETPOST('id', 'int');
$ref = GETPOST('ref', 'alpha');
$action = GETPOST('action', 'aZ09');
$cancel = GETPOST('cancel', 'aZ09');
$confirm = GETPOST('confirm', 'alpha');

// Initialize objects
$object = new SmelecIntervention($db);
$aiClient = new SmelecAiClient($db);

// Load object
if ($id > 0 || !empty($ref)) {
    $object->fetch($id, $ref);
    $object->fetchLines();
}

// Security check
if (!$user->rights->smartelectric_core->intervention->read) {
    accessforbidden();
}

/*
 * ACTIONS
 */

if ($cancel) {
    if (!empty($backtopage)) {
        header("Location: ".$backtopage);
        exit;
    }
    $action = '';
}

// Create
if ($action == 'add' && $user->rights->smartelectric_core->intervention->write) {
    $object->label = GETPOST('label', 'alphanohtml');
    $object->fk_soc = GETPOST('fk_soc', 'int');
    $object->fk_project = GETPOST('fk_project', 'int');
    $object->location = GETPOST('location', 'alphanohtml');
    $object->type = GETPOST('type', 'alpha');
    $object->priority = GETPOST('priority', 'int');
    $object->description = GETPOST('description', 'restricthtml');
    $object->fk_user_tech_main = GETPOST('fk_user_tech', 'int');
    $object->date_planned = dol_mktime(GETPOST('date_plannedhour', 'int'), GETPOST('date_plannedmin', 'int'), 0, GETPOST('date_plannedmonth', 'int'), GETPOST('date_plannedday', 'int'), GETPOST('date_plannedyear', 'int'));

    $result = $object->create($user);
    if ($result > 0) {
        header("Location: smelec_intervention_card.php?id=".$result);
        exit;
    } else {
        setEventMessages($object->error, $object->errors, 'errors');
        $action = 'create';
    }
}

// Update
if ($action == 'update' && $user->rights->smartelectric_core->intervention->write) {
    $object->label = GETPOST('label', 'alphanohtml');
    $object->fk_soc = GETPOST('fk_soc', 'int');
    $object->fk_project = GETPOST('fk_project', 'int');
    $object->location = GETPOST('location', 'alphanohtml');
    $object->type = GETPOST('type', 'alpha');
    $object->priority = GETPOST('priority', 'int');
    $object->status = GETPOST('status', 'int');
    $object->description = GETPOST('description', 'restricthtml');
    $object->fk_user_tech_main = GETPOST('fk_user_tech', 'int');
    $object->date_planned = dol_mktime(GETPOST('date_plannedhour', 'int'), GETPOST('date_plannedmin', 'int'), 0, GETPOST('date_plannedmonth', 'int'), GETPOST('date_plannedday', 'int'), GETPOST('date_plannedyear', 'int'));

    $result = $object->update($user);
    if ($result > 0) {
        setEventMessages('Intervention mise à jour', null, 'mesgs');
    } else {
        setEventMessages($object->error, $object->errors, 'errors');
    }
    $action = '';
}

// Delete
if ($action == 'confirm_delete' && $confirm == 'yes' && $user->rights->smartelectric_core->intervention->delete) {
    $result = $object->delete($user);
    if ($result > 0) {
        header("Location: smelec_intervention_list.php");
        exit;
    } else {
        setEventMessages($object->error, $object->errors, 'errors');
    }
}

// AI Actions
if ($action == 'generate_ai_summary' && $user->rights->smartelectric_core->intervention->write) {
    $result = $aiClient->generateSummary($object);
    if ($result && strpos($result, 'Erreur') === false) {
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ai_summary = '".$db->escape($result)."' WHERE rowid = ".(int) $object->id;
        $db->query($sql);
        $object->ai_summary = $result;
        setEventMessages('Résumé IA généré', null, 'mesgs');
    } else {
        setEventMessages($result, null, 'errors');
    }
}

if ($action == 'generate_ai_client' && $user->rights->smartelectric_core->intervention->write) {
    $result = $aiClient->generateClientText($object);
    if ($result && strpos($result, 'Erreur') === false) {
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ai_client_text = '".$db->escape($result)."' WHERE rowid = ".(int) $object->id;
        $db->query($sql);
        $object->ai_client_text = $result;
        setEventMessages('Texte client IA généré', null, 'mesgs');
    } else {
        setEventMessages($result, null, 'errors');
    }
}

if ($action == 'generate_ai_diagnostic' && $user->rights->smartelectric_core->intervention->write) {
    $symptoms = GETPOST('symptoms', 'restricthtml');
    $result = $aiClient->generateDiagnostic($object, $symptoms);
    if ($result && strpos($result, 'Erreur') === false) {
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ai_diagnostic = '".$db->escape($result)."' WHERE rowid = ".(int) $object->id;
        $db->query($sql);
        $object->ai_diagnostic = $result;
        setEventMessages('Diagnostic IA généré', null, 'mesgs');
    } else {
        setEventMessages($result, null, 'errors');
    }
}

/*
 * VIEW
 */

$form = new Form($db);
llxHeader('', 'Intervention SmartElectric', '');

// Create form
if ($action == 'create') {
    print load_fiche_titre('Nouvelle intervention', '', 'fa-bolt');
    
    print '<form method="POST" action="'.$_SERVER["PHP_SELF"].'">';
    print '<input type="hidden" name="token" value="'.newToken().'">';
    print '<input type="hidden" name="action" value="add">';
    
    print '<table class="border centpercent tableforfieldcreate">';
    
    // Label
    print '<tr><td class="titlefieldcreate fieldrequired">Libellé</td>';
    print '<td><input class="flat quatrevingtpercent" type="text" name="label" value="'.GETPOST('label').'"></td></tr>';
    
    // Client
    print '<tr><td class="fieldrequired">Client</td>';
    print '<td>'.$form->select_company(GETPOST('fk_soc'), 'fk_soc', '', 'SelectThirdParty', 1, 0, null, 0, 'minwidth300').'</td></tr>';
    
    // Project
    print '<tr><td>Projet</td>';
    print '<td>';
    $formproject = new FormProjets($db);
    $formproject->select_projects(-1, GETPOST('fk_project'), 'fk_project', 0, 0, 1, 1, 0, 0, 0, '', 1, 0, 'minwidth300');
    print '</td></tr>';
    
    // Location
    print '<tr><td>Adresse intervention</td>';
    print '<td><input class="flat quatrevingtpercent" type="text" name="location" value="'.GETPOST('location').'"></td></tr>';
    
    // Type
    print '<tr><td class="fieldrequired">Type</td>';
    print '<td>';
    $types = array('installation' => 'Installation', 'depannage' => 'Dépannage', 'renovation' => 'Rénovation', 'tableau' => 'Tableau électrique', 'cuisine' => 'Cuisine professionnelle', 'oibt' => 'Contrôle OIBT', 'autre' => 'Autre');
    print $form->selectarray('type', $types, GETPOST('type') ?: 'depannage', 0, 0, 0, '', 0, 0, 0, '', 'minwidth200');
    print '</td></tr>';
    
    // Priority
    print '<tr><td>Priorité</td>';
    print '<td>';
    $priorities = array(0 => 'Normal', 1 => 'Urgent', 2 => 'Critique');
    print $form->selectarray('priority', $priorities, GETPOST('priority') ?: 0, 0, 0, 0, '', 0, 0, 0, '', 'minwidth150');
    print '</td></tr>';
    
    // Date planned
    print '<tr><td>Date planifiée</td>';
    print '<td>'.$form->selectDate('', 'date_planned', 1, 1, 0, '', 1, 1).'</td></tr>';
    
    // Technician
    print '<tr><td>Technicien assigné</td>';
    print '<td>'.$form->select_dolusers(GETPOST('fk_user_tech'), 'fk_user_tech', 1, null, 0, '', '', $conf->entity, 0, 0, '', 0, '', 'minwidth200').'</td></tr>';
    
    // Description
    print '<tr><td>Description</td>';
    print '<td>';
    $doleditor = new DolEditor('description', GETPOST('description'), '', 200, 'dolibarr_notes', '', false, true, true, ROWS_5, '90%');
    $doleditor->Create();
    print '</td></tr>';
    
    print '</table>';
    
    print '<div class="center">';
    print '<input type="submit" class="button button-save" value="Créer">';
    print ' <input type="submit" class="button button-cancel" name="cancel" value="Annuler">';
    print '</div>';
    
    print '</form>';
}

// View/Edit card
if ($object->id > 0 && $action != 'create') {
    print load_fiche_titre('Intervention '.$object->ref, '', 'fa-bolt');
    
    // Confirm delete
    if ($action == 'delete') {
        print $form->formconfirm($_SERVER["PHP_SELF"].'?id='.$object->id, 'Supprimer', 'Êtes-vous sûr de vouloir supprimer cette intervention ?', 'confirm_delete', '', 0, 1);
    }
    
    print '<div class="fichecenter">';
    print '<div class="fichehalfleft">';
    print '<div class="underbanner clearboth"></div>';
    print '<table class="border tableforfield centpercent">';
    
    // Ref
    print '<tr><td class="titlefield">Référence</td><td>'.$object->ref.'</td></tr>';
    
    // Label
    print '<tr><td>Libellé</td><td>'.$object->label.'</td></tr>';
    
    // Client
    print '<tr><td>Client</td><td>';
    if ($object->fk_soc > 0) {
        $soc = new Societe($db);
        $soc->fetch($object->fk_soc);
        print $soc->getNomUrl(1);
    }
    print '</td></tr>';
    
    // Type
    $typeLabels = array('installation' => '🔧 Installation', 'depannage' => '⚡ Dépannage', 'renovation' => '🏠 Rénovation', 'tableau' => '📦 Tableau', 'cuisine' => '🍳 Cuisine', 'oibt' => '📋 OIBT', 'autre' => '📝 Autre');
    print '<tr><td>Type</td><td>'.($typeLabels[$object->type] ?? $object->type).'</td></tr>';
    
    // Status
    $statusLabels = array(0 => '<span class="badge badge-status0">À planifier</span>', 1 => '<span class="badge badge-status1">En cours</span>', 2 => '<span class="badge badge-status4">Terminé</span>', 3 => '<span class="badge badge-status6">Facturé</span>');
    print '<tr><td>Statut</td><td>'.$statusLabels[$object->status].'</td></tr>';
    
    // Priority
    $priorityLabels = array(0 => 'Normal', 1 => '<span class="badge badge-warning">Urgent</span>', 2 => '<span class="badge badge-danger">Critique</span>');
    print '<tr><td>Priorité</td><td>'.$priorityLabels[$object->priority].'</td></tr>';
    
    // Location
    print '<tr><td>Adresse</td><td>'.$object->location.'</td></tr>';
    
    // Date planned
    print '<tr><td>Date planifiée</td><td>'.dol_print_date($object->date_planned, 'dayhour').'</td></tr>';
    
    print '</table>';
    print '</div>';
    
    print '<div class="fichehalfright">';
    print '<div class="underbanner clearboth"></div>';
    print '<table class="border tableforfield centpercent">';
    
    // Description
    print '<tr><td class="titlefield">Description</td><td>'.$object->description.'</td></tr>';
    
    // Tasks summary
    $tasksDone = count(array_filter($object->tasks, function($t) { return $t['status'] === 'fait'; }));
    print '<tr><td>Tâches</td><td>'.$tasksDone.'/'.count($object->tasks).' complétées</td></tr>';
    
    // Hours summary
    $totalHours = array_reduce($object->hours, function($acc, $h) { return $acc + floatval($h['durationHours']); }, 0);
    print '<tr><td>Heures</td><td>'.number_format($totalHours, 2).'h</td></tr>';
    
    // Materials
    print '<tr><td>Matériaux</td><td>'.count($object->materials).' articles</td></tr>';
    
    // Photos
    print '<tr><td>Photos</td><td>'.count($object->photos).' photos</td></tr>';
    
    print '</table>';
    print '</div>';
    print '</div>';
    
    // AI Section
    if ($aiClient->isEnabled()) {
        print '<div class="clearboth"></div>';
        print '<br>';
        print '<div class="div-table-responsive-no-min">';
        print '<table class="noborder centpercent">';
        print '<tr class="liste_titre">';
        print '<td colspan="2">⚡ Intelligence Artificielle</td>';
        print '</tr>';
        
        // AI Summary
        print '<tr class="oddeven">';
        print '<td class="titlefield">Résumé IA</td>';
        print '<td>';
        if ($object->ai_summary) {
            print nl2br($object->ai_summary);
        } else {
            print '<em class="opacitymedium">Non généré</em>';
        }
        print ' <a href="'.$_SERVER["PHP_SELF"].'?id='.$object->id.'&action=generate_ai_summary&token='.newToken().'" class="button small">Générer</a>';
        print '</td></tr>';
        
        // AI Client text
        print '<tr class="oddeven">';
        print '<td>Texte client IA</td>';
        print '<td>';
        if ($object->ai_client_text) {
            print nl2br($object->ai_client_text);
        } else {
            print '<em class="opacitymedium">Non généré</em>';
        }
        print ' <a href="'.$_SERVER["PHP_SELF"].'?id='.$object->id.'&action=generate_ai_client&token='.newToken().'" class="button small">Générer</a>';
        print '</td></tr>';
        
        // AI Diagnostic (for depannage)
        if ($object->type === 'depannage') {
            print '<tr class="oddeven">';
            print '<td>Diagnostic IA</td>';
            print '<td>';
            if ($object->ai_diagnostic) {
                print nl2br($object->ai_diagnostic);
            } else {
                print '<em class="opacitymedium">Non généré</em>';
            }
            print ' <a href="'.$_SERVER["PHP_SELF"].'?id='.$object->id.'&action=generate_ai_diagnostic&token='.newToken().'" class="button small">Générer</a>';
            print '</td></tr>';
        }
        
        print '</table>';
        print '</div>';
    }
    
    // Tasks section
    print '<div class="clearboth"></div>';
    print '<br>';
    print '<div class="div-table-responsive-no-min">';
    print '<table class="noborder centpercent">';
    print '<tr class="liste_titre">';
    print '<td colspan="4">📋 Checklist</td>';
    print '</tr>';
    print '<tr class="liste_titre">';
    print '<td>Tâche</td><td class="center">Statut</td><td>Commentaire</td><td class="center">Actions</td>';
    print '</tr>';
    
    foreach ($object->tasks as $task) {
        print '<tr class="oddeven">';
        print '<td>'.$task['label'].'</td>';
        print '<td class="center">';
        if ($task['status'] === 'fait') {
            print '<span class="badge badge-status4">✓ Fait</span>';
        } elseif ($task['status'] === 'na') {
            print '<span class="badge badge-status0">N/A</span>';
        } else {
            print '<span class="badge badge-status1">À faire</span>';
        }
        print '</td>';
        print '<td>'.$task['comment'].'</td>';
        print '<td class="center">-</td>';
        print '</tr>';
    }
    
    if (empty($object->tasks)) {
        print '<tr class="oddeven"><td colspan="4" class="opacitymedium center">Aucune tâche</td></tr>';
    }
    
    print '</table>';
    print '</div>';
    
    // Actions buttons
    print '<div class="tabsAction">';
    if ($user->rights->smartelectric_core->intervention->write) {
        print '<a class="butAction" href="'.$_SERVER["PHP_SELF"].'?id='.$object->id.'&action=edit&token='.newToken().'">Modifier</a>';
    }
    if ($user->rights->smartelectric_core->intervention->delete) {
        print '<a class="butActionDelete" href="'.$_SERVER["PHP_SELF"].'?id='.$object->id.'&action=delete&token='.newToken().'">Supprimer</a>';
    }
    print '</div>';
}

llxFooter();
$db->close();
