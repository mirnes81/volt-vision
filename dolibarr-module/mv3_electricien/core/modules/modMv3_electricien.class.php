<?php
/* Copyright (C) 2024 MV-3 PRO Électricien
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * \defgroup mv3_electricien Module MV3 Électricien
 * \brief Module for electrical interventions management with PWA support
 */

/**
 * \file    core/modules/modMv3_electricien.class.php
 * \ingroup mv3_electricien
 * \brief   Description and activation file for module MV3 Électricien
 */

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

/**
 * Class modMv3_electricien
 * Description and activation class for module MV3 Électricien
 */
class modMv3_electricien extends DolibarrModules
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
        $this->numero = 500100;

        // Family (for grouping modules)
        $this->family = "crm";

        // Module position in the menu
        $this->module_position = '90';

        // Module name
        $this->name = preg_replace('/^mod/i', '', get_class($this));

        // Module description
        $this->description = "Gestion des interventions électriques avec application mobile PWA";

        // Editor name
        $this->editor_name = 'MV-3 PRO Électricien';
        $this->editor_url = 'https://mv3-electricien.ch';

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
            1 => array('MV3EL_AI_ENABLED', 'chaine', '0', 'Enable AI features', 0, 'current', 1),
            2 => array('MV3EL_AI_API_URL', 'chaine', '', 'AI API URL', 0, 'current', 1),
            3 => array('MV3EL_AI_API_KEY', 'chaine', '', 'AI API Key', 0, 'current', 1),
            4 => array('MV3EL_OIBT_ENABLED', 'chaine', '1', 'Enable OIBT controls', 0, 'current', 1),
            5 => array('MV3EL_GPS_TRACKING', 'chaine', '1', 'Enable GPS tracking', 0, 'current', 1),
        );

        // Data directories
        $this->dirs = array(
            "/mv3_electricien/temp",
            "/mv3_electricien/photos",
            "/mv3_electricien/signatures",
            "/mv3_electricien/voicenotes",
            "/mv3_electricien/oibt"
        );

        // Config page
        $this->config_page_url = array("setup.php@mv3_electricien");

        // Boxes/Widgets
        $this->boxes = array(
            0 => array(
                'file' => 'mv3electricienwidget1.php@mv3_electricien',
                'note' => 'Interventions du jour',
                'enabledbydefaulton' => 'Home',
            ),
        );

        // Cronjobs
        $this->cronjobs = array(
            0 => array(
                'label' => 'Sync pending interventions',
                'jobtype' => 'method',
                'class' => '/mv3_electricien/class/mv3el_intervention.class.php',
                'objectname' => 'Mv3elIntervention',
                'method' => 'syncPending',
                'parameters' => '',
                'comment' => 'Synchronize pending mobile data',
                'frequency' => 5,
                'unitfrequency' => 60,
                'status' => 0,
                'test' => '$conf->mv3_electricien->enabled',
                'priority' => 50,
            ),
        );

        // Permissions
        $this->rights = array();
        $this->rights_class = 'mv3_electricien';
        $r = 0;

        // Read permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Read electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'read';
        $r++;

        // Create permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Create/Update electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'write';
        $r++;

        // Delete permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Delete electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'delete';
        $r++;

        // Admin permission
        $this->rights[$r][0] = $this->numero + $r;
        $this->rights[$r][1] = 'Administrate MV3 Électricien module';
        $this->rights[$r][4] = 'admin';
        $this->rights[$r][5] = '';
        $r++;

        // Menus
        $this->menu = array();
        $r = 0;

        // Top menu - use module number as base for unique IDs
        $this->menu[$r++] = array(
            'fk_menu' => '',
            'type' => 'top',
            'titre' => 'MV3 Électricien',
            'prefix' => img_picto('', $this->picto, 'class="paddingright pictofixedwidth valignmiddle"'),
            'mainmenu' => 'mv3electricien',
            'leftmenu' => '',
            'url' => '/mv3_electricien/index.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 500100,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '$user->rights->mv3_electricien->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - Interventions list
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3electricien',
            'type' => 'left',
            'titre' => 'Liste interventions',
            'mainmenu' => 'mv3electricien',
            'leftmenu' => 'mv3electricien_list',
            'url' => '/mv3_electricien/intervention_list.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 500101,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '$user->rights->mv3_electricien->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - New intervention
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3electricien',
            'type' => 'left',
            'titre' => 'Nouvelle intervention',
            'mainmenu' => 'mv3electricien',
            'leftmenu' => 'mv3electricien_new',
            'url' => '/mv3_electricien/intervention_card.php?action=create',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 500102,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '$user->rights->mv3_electricien->intervention->write',
            'target' => '',
            'user' => 0,
        );

        // Left menu - OIBT Controls
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3electricien',
            'type' => 'left',
            'titre' => 'Contrôles OIBT',
            'mainmenu' => 'mv3electricien',
            'leftmenu' => 'mv3electricien_oibt',
            'url' => '/mv3_electricien/oibt_list.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 500103,
            'enabled' => '$conf->mv3_electricien->enabled && $conf->global->MV3EL_OIBT_ENABLED',
            'perms' => '$user->rights->mv3_electricien->intervention->read',
            'target' => '',
            'user' => 0,
        );

        // Left menu - Statistics
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3electricien',
            'type' => 'left',
            'titre' => 'Statistiques',
            'mainmenu' => 'mv3electricien',
            'leftmenu' => 'mv3electricien_stats',
            'url' => '/mv3_electricien/stats.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 500104,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '$user->rights->mv3_electricien->intervention->read',
            'target' => '',
            'user' => 0,
        );
    }

    /**
     * Function called when module is enabled
     *
     * @param string $options Options when enabling module ('', 'noboxes')
     * @return int 1 if OK, 0 if KO
     */
    public function init($options = '')
    {
        global $conf, $langs;

        $result = $this->_load_tables('/install/mysql/', 'mv3_electricien');
        if ($result < 0) {
            return -1;
        }

        // Create extrafields if needed
        include_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';
        $extrafields = new ExtraFields($this->db);

        // Add extrafield to link ficheinter to mv3el_intervention
        $extrafields->addExtraField(
            'mv3el_intervention_id',
            'MV3 Intervention ID',
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
            'mv3_electricien@mv3_electricien',
            '$conf->mv3_electricien->enabled'
        );

        return $this->_init(array(), $options);
    }

    /**
     * Function called when module is disabled
     *
     * @param string $options Options when disabling module ('', 'noboxes')
     * @return int 1 if OK, 0 if KO
     */
    public function remove($options = '')
    {
        $sql = array();
        return $this->_remove($sql, $options);
    }
}
