<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * \defgroup smartelectric_core Module SmartElectric Core
 * \brief Module for electrical interventions management with PWA support
 */

/**
 * \file    core/modules/modSmartelectric_core.class.php
 * \ingroup smartelectric_core
 * \brief   Description and activation file for module SmartElectric Core
 */

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

/**
 * Class modSmartelectric_core
 * Description and activation class for module SmartElectric - Core Électricien
 */
class modSmartelectric_core extends DolibarrModules
{
    /**
     * Constructor
     *
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        global $langs, $conf;

        $this->db = $db;

        // Module ID (must be unique)
        $this->numero = 500200;

        // Family (for grouping modules)
        $this->family = "crm";

        // Module position in the menu
        $this->module_position = '90';

        // Module name
        $this->name = preg_replace('/^mod/i', '', get_class($this));

        // Module description
        $this->description = "SmartElectric - Gestion des interventions électriques avec application mobile PWA";

        // Editor name
        $this->editor_name = 'SmartElectric Suite';
        $this->editor_url = 'https://smartelectric.ch';

        // Version
        $this->version = '1.0.0';

        // Picto (icon)
        $this->picto = 'fa-bolt';

        // Dependencies
        $this->depends = array('modFicheinter', 'modSociete', 'modProduct', 'modProjet');
        $this->requiredby = array();
        $this->conflictwith = array();

        // Minimum PHP version
        $this->phpmin = array(7, 4);

        // Constants
        $this->const = array(
            1 => array('SMELEC_AI_ENABLED', 'chaine', '0', 'Enable AI features', 0, 'current', 1),
            2 => array('SMELEC_AI_API_URL', 'chaine', '', 'AI API URL', 0, 'current', 1),
            3 => array('SMELEC_AI_API_KEY', 'chaine', '', 'AI API Key', 0, 'current', 1),
            4 => array('SMELEC_OIBT_ENABLED', 'chaine', '1', 'Enable OIBT controls', 0, 'current', 1),
            5 => array('SMELEC_GPS_TRACKING', 'chaine', '1', 'Enable GPS tracking', 0, 'current', 1),
            6 => array('SMELEC_DEFAULT_CHECKLIST', 'chaine', '', 'Default checklist items (JSON)', 0, 'current', 1),
            7 => array('SMELEC_WORK_TYPES', 'chaine', 'travail,deplacement,pause', 'Work types for hours', 0, 'current', 1),
            8 => array('SMELEC_DOCUMENTS_DIR', 'chaine', 'smartelectric', 'Documents directory name', 0, 'current', 1),
        );

        // Data directories
        $this->dirs = array(
            "/smartelectric/temp",
            "/smartelectric/photos",
            "/smartelectric/signatures",
            "/smartelectric/voicenotes",
            "/smartelectric/oibt",
            "/smartelectric/reports"
        );

        // Config page
        $this->config_page_url = array("smartelectric_core.php@smartelectric_core");

        // Boxes/Widgets
        $this->boxes = array(
            0 => array(
                'file' => 'smelecwidget1.php@smartelectric_core',
                'note' => 'Interventions du jour',
                'enabledbydefaulton' => 'Home',
            ),
        );

        // Cronjobs
        $this->cronjobs = array(
            0 => array(
                'label' => 'Sync pending interventions',
                'jobtype' => 'method',
                'class' => '/smartelectric_core/class/smelec_intervention.class.php',
                'objectname' => 'SmelecIntervention',
                'method' => 'syncPending',
                'parameters' => '',
                'comment' => 'Synchronize pending mobile data',
                'frequency' => 5,
                'unitfrequency' => 60,
                'status' => 0,
                'test' => '$conf->smartelectric_core->enabled',
                'priority' => 50,
            ),
        );

        // Permissions
        $this->rights = array();
        $this->rights_class = 'smartelectric_core';
        $r = 0;

        // Read permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Lire les interventions électriques';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'read';
        $r++;

        // Create permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Créer/Modifier les interventions électriques';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'write';
        $r++;

        // Delete permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Supprimer les interventions électriques';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'delete';
        $r++;

        // Admin permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Administrer le module SmartElectric';
        $this->rights[$r][4] = 'admin';
        $this->rights[$r][5] = '';
        $r++;

        // Menus
        $this->menu = array();
        $r = 0;

        // Top menu
        $this->menu[$r++] = array(
            'fk_menu' => '',
            'type' => 'top',
            'titre' => 'SmartElectric',
            'prefix' => img_picto('', $this->picto, 'class="paddingright pictofixedwidth valignmiddle"'),
            'mainmenu' => 'smartelectric',
            'leftmenu' => '',
            'url' => '/smartelectric_core/index.php',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500200,
            'enabled' => '$conf->smartelectric_core->enabled',
            'perms' => '$user->rights->smartelectric_core->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - Interventions list
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=smartelectric',
            'type' => 'left',
            'titre' => 'Liste interventions',
            'mainmenu' => 'smartelectric',
            'leftmenu' => 'smelec_list',
            'url' => '/smartelectric_core/smelec_intervention_list.php',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500201,
            'enabled' => '$conf->smartelectric_core->enabled',
            'perms' => '$user->rights->smartelectric_core->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - New intervention
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=smartelectric',
            'type' => 'left',
            'titre' => 'Nouvelle intervention',
            'mainmenu' => 'smartelectric',
            'leftmenu' => 'smelec_new',
            'url' => '/smartelectric_core/smelec_intervention_card.php?action=create',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500202,
            'enabled' => '$conf->smartelectric_core->enabled',
            'perms' => '$user->rights->smartelectric_core->intervention->write',
            'target' => '',
            'user' => 0,
        );

        // Left menu - OIBT Controls
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=smartelectric',
            'type' => 'left',
            'titre' => 'Contrôles OIBT',
            'mainmenu' => 'smartelectric',
            'leftmenu' => 'smelec_oibt',
            'url' => '/smartelectric_core/smelec_oibt_list.php',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500203,
            'enabled' => '$conf->smartelectric_core->enabled && $conf->global->SMELEC_OIBT_ENABLED',
            'perms' => '$user->rights->smartelectric_core->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - Daily Reports
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=smartelectric',
            'type' => 'left',
            'titre' => 'Rapports journaliers',
            'mainmenu' => 'smartelectric',
            'leftmenu' => 'smelec_dailyreport',
            'url' => '/smartelectric_core/smelec_dailyreport_list.php',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500204,
            'enabled' => '$conf->smartelectric_core->enabled',
            'perms' => '$user->rights->smartelectric_core->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - Statistics
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=smartelectric',
            'type' => 'left',
            'titre' => 'Statistiques',
            'mainmenu' => 'smartelectric',
            'leftmenu' => 'smelec_stats',
            'url' => '/smartelectric_core/stats.php',
            'langs' => 'smartelectric_core@smartelectric_core',
            'position' => 500205,
            'enabled' => '$conf->smartelectric_core->enabled',
            'perms' => '$user->rights->smartelectric_core->intervention->read',
            'target' => '',
            'user' => 0,
        );
    }

    /**
     * Function called when module is enabled
     *
     * @param string $options Options when enabling module
     * @return int 1 if OK, 0 if KO
     */
    public function init($options = '')
    {
        global $conf, $langs;

        $result = $this->_load_tables('/install/mysql/', 'smartelectric_core');
        if ($result < 0) {
            return -1;
        }

        // Create extrafields if needed
        include_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';
        $extrafields = new ExtraFields($this->db);

        // Add extrafield to link ficheinter to smelec_intervention
        $extrafields->addExtraField(
            'smelec_intervention_id',
            'SmartElectric Intervention ID',
            'int',
            100,
            11,
            'fichinter',
            0,
            0,
            '',
            '',
            1,
            '',
            0,
            '',
            '',
            '',
            'smartelectric_core@smartelectric_core',
            '$conf->smartelectric_core->enabled'
        );

        return $this->_init(array(), $options);
    }

    /**
     * Function called when module is disabled
     *
     * @param string $options Options when disabling module
     * @return int 1 if OK, 0 if KO
     */
    public function remove($options = '')
    {
        $sql = array();
        return $this->_remove($sql, $options);
    }
}
