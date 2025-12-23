<?php
/* Copyright (C) 2024-2025 MV-3 PRO
 * Module Électricien - Gestion des interventions avec PWA
 */

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

class modElectricien extends DolibarrModules
{
    public function __construct($db)
    {
        global $langs, $conf;

        $this->db = $db;

        $this->numero = 436100;
        $this->rights_class = 'electricien';
        $this->family = "crm";
        $this->module_position = '50';
        $this->name = preg_replace('/^mod/i', '', get_class($this));
        $this->description = "Module Électricien - Gestion des interventions avec application mobile PWA";
        $this->descriptionlong = "Gestion complète des interventions électriques : heures, matériaux, photos, signatures, contrôles OIBT, GPS, IA";
        $this->editor_name = 'MV-3 PRO';
        $this->editor_url = 'https://mv-3pro.ch';
        $this->version = '1.0.0';
        $this->const_name = 'MAIN_MODULE_'.strtoupper($this->name);
        $this->picto = 'technic';

        $this->module_parts = array(
            'triggers' => 0,
            'login' => 0,
            'substitutions' => 0,
            'menus' => 0,
            'tpl' => 0,
            'barcode' => 0,
            'models' => 0,
            'theme' => 0,
            'css' => array(),
            'js' => array(),
            'hooks' => array(),
            'moduleforexternal' => 0,
        );

        $this->dirs = array("/electricien/temp", "/electricien/photos", "/electricien/signatures");

        $this->config_page_url = array("setup.php@electricien");

        $this->hidden = false;
        $this->depends = array();
        $this->requiredby = array();
        $this->conflictwith = array();
        $this->langfiles = array("electricien@electricien");
        $this->phpmin = array(7, 4);
        $this->need_dolibarr_version = array(16, 0);
        $this->warnings_activation = array();
        $this->warnings_activation_ext = array();

        $this->const = array(
            0 => array('ELECTRICIEN_AI_ENABLED', 'chaine', '0', 'Enable AI features', 0, 'current', 1),
            1 => array('ELECTRICIEN_AI_API_URL', 'chaine', '', 'AI API URL', 0, 'current', 1),
            2 => array('ELECTRICIEN_AI_API_KEY', 'chaine', '', 'AI API Key', 0, 'current', 1),
            3 => array('ELECTRICIEN_OIBT_ENABLED', 'chaine', '1', 'Enable OIBT controls', 0, 'current', 1),
            4 => array('ELECTRICIEN_GPS_TRACKING', 'chaine', '1', 'Enable GPS tracking', 0, 'current', 1),
        );

        if (!isset($conf->electricien) || !isset($conf->electricien->enabled)) {
            $conf->electricien = new stdClass();
            $conf->electricien->enabled = 0;
        }

        $this->boxes = array();
        $this->cronjobs = array();

        // Permissions
        $this->rights = array();
        $r = 0;

        $this->rights[$r][0] = $this->numero + 1;
        $this->rights[$r][1] = 'Lire les interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'read';
        $r++;

        $this->rights[$r][0] = $this->numero + 2;
        $this->rights[$r][1] = 'Créer/Modifier les interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'write';
        $r++;

        $this->rights[$r][0] = $this->numero + 3;
        $this->rights[$r][1] = 'Supprimer les interventions';
        $this->rights[$r][4] = 'intervention';
        $this->rights[$r][5] = 'delete';
        $r++;

        // Menus
        $this->menu = array();
        $r = 0;

        // Left menu under existing MV-3 PRO
        $this->menu[$r++] = array(
            'fk_menu' => 'fk_mainmenu=mv3pro',
            'type' => 'left',
            'titre' => 'Électricien PWA',
            'mainmenu' => 'mv3pro',
            'leftmenu' => 'electricien',
            'url' => '/electricien/admin/setup.php',
            'langs' => 'electricien@electricien',
            'position' => 100,
            'enabled' => '$conf->electricien->enabled',
            'perms' => '1',
            'target' => '',
            'user' => 2,
        );
    }

    public function init($options = '')
    {
        $result = $this->_load_tables('/electricien/sql/');
        return $this->_init(array(), $options);
    }

    public function remove($options = '')
    {
        return $this->_remove(array(), $options);
    }
}
