<?php
/* Copyright (C) 2024 MV-3 PRO Électricien
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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
        $this->picto = 'technic';

        // NO Dependencies - remove blocking
        $this->depends = array();
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
            "/mv3_electricien/signatures"
        );

        // Config page
        $this->config_page_url = array("setup.php@mv3_electricien");

        // NO Boxes/Widgets for now
        $this->boxes = array();

        // NO Cronjobs for now
        $this->cronjobs = array();

        // Permissions
        $this->rights = array();
        $this->rights_class = 'mv3_electricien';
        $r = 0;

        // Read permission
        $this->rights[$r][0] = $this->numero + $r + 1;
        $this->rights[$r][1] = 'Read electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'read';
        $r++;

        // Create permission
        $this->rights[$r][0] = $this->numero + $r + 1;
        $this->rights[$r][1] = 'Create/Update electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'write';
        $r++;

        // Delete permission
        $this->rights[$r][0] = $this->numero + $r + 1;
        $this->rights[$r][1] = 'Delete electrical interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'delete';
        $r++;

        // Menus - SIMPLIFIED
        $this->menu = array();
        $r = 0;

        // Top menu - uses existing MV-3 PRO mainmenu
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3pro',
            'type' => 'left',
            'titre' => 'Électricien',
            'prefix' => '',
            'mainmenu' => 'mv3pro',
            'leftmenu' => 'mv3electricien',
            'url' => '/mv3_electricien/admin/setup.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 1000 + $r,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '1',
            'target' => '',
            'user' => 2,
        );

        // Left menu - Configuration
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3pro,fk_leftmenu=mv3electricien',
            'type' => 'left',
            'titre' => 'Configuration PWA',
            'mainmenu' => 'mv3pro',
            'leftmenu' => 'mv3electricien_config',
            'url' => '/mv3_electricien/admin/setup.php',
            'langs' => 'mv3_electricien@mv3_electricien',
            'position' => 1000 + $r,
            'enabled' => '$conf->mv3_electricien->enabled',
            'perms' => '1',
            'target' => '',
            'user' => 2,
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
        // Don't load tables automatically - let user do it manually
        // Just init the module
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
