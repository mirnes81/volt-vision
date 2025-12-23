<?php
/* Copyright (C) 2024-2025 MV-3 PRO
 * API REST pour l'application mobile Électricien PWA
 */

use Luracast\Restler\RestException;

/**
 * API class for Electricien module
 */
class ElectricienApi extends DolibarrApi
{
    /**
     * Constructor
     */
    public function __construct()
    {
        global $db;
        $this->db = $db;
    }

    /**
     * Login worker and get API token
     *
     * @param string $login    User login
     * @param string $password User password
     * @return array Token and worker info
     *
     * @url POST /login
     */
    public function login($login, $password)
    {
        require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

        $user = new User($this->db);
        $result = $user->fetch('', $login);

        if ($result <= 0) {
            throw new RestException(401, 'Identifiants invalides');
        }

        // Check password
        if (!password_verify($password, $user->pass_indatabase_crypted) && 
            dol_hash($password) != $user->pass_indatabase_crypted) {
            throw new RestException(401, 'Identifiants invalides');
        }

        if ($user->statut != 1) {
            throw new RestException(403, 'Compte désactivé');
        }

        // Generate token
        $token = bin2hex(random_bytes(32));
        $this->db->query("UPDATE ".MAIN_DB_PREFIX."user SET api_key = '".$this->db->escape($token)."' WHERE rowid = ".$user->id);

        return array(
            'success' => true,
            'token' => $token,
            'worker' => array(
                'id' => $user->id,
                'login' => $user->login,
                'name' => $user->lastname,
                'firstName' => $user->firstname,
                'email' => $user->email,
                'phone' => $user->user_mobile,
            )
        );
    }

    /**
     * Get today's interventions for worker
     *
     * @return array List of interventions
     *
     * @url GET /interventions/today
     */
    public function getTodayInterventions()
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->electricien->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $userId = DolibarrApiAccess::$user->id;
        $interventions = array();

        $sql = "SELECT f.rowid, f.ref, f.description, f.datei, f.dateo, f.datee, f.fk_statut as status,";
        $sql .= " s.nom as client_name, s.address, s.town, s.zip";
        $sql .= " FROM ".MAIN_DB_PREFIX."fichinter f";
        $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = f.fk_soc";
        $sql .= " WHERE f.entity = ".(int) $conf->entity;
        $sql .= " AND DATE(f.datei) = CURDATE()";
        $sql .= " ORDER BY f.datei ASC";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $interventions[] = array(
                    'id' => (int) $obj->rowid,
                    'ref' => $obj->ref,
                    'description' => $obj->description,
                    'datePlanned' => $obj->datei,
                    'dateStart' => $obj->dateo,
                    'dateEnd' => $obj->datee,
                    'status' => (int) $obj->status,
                    'client' => array(
                        'name' => $obj->client_name,
                        'address' => $obj->address,
                        'town' => $obj->town,
                        'zip' => $obj->zip,
                    )
                );
            }
        }

        return $interventions;
    }

    /**
     * Get intervention details
     *
     * @param int $id Intervention ID
     * @return array Intervention data
     *
     * @url GET /interventions/{id}
     */
    public function getIntervention($id)
    {
        if (!DolibarrApiAccess::$user->rights->electricien->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        require_once DOL_DOCUMENT_ROOT.'/fichinter/class/fichinter.class.php';
        
        $fichinter = new Fichinter($this->db);
        $result = $fichinter->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        $fichinter->fetch_thirdparty();

        return array(
            'id' => $fichinter->id,
            'ref' => $fichinter->ref,
            'description' => $fichinter->description,
            'datePlanned' => $fichinter->datei,
            'dateStart' => $fichinter->dateo,
            'dateEnd' => $fichinter->datee,
            'status' => $fichinter->statut,
            'duration' => $fichinter->duration,
            'client' => array(
                'id' => $fichinter->thirdparty->id,
                'name' => $fichinter->thirdparty->name,
                'address' => $fichinter->thirdparty->address,
                'town' => $fichinter->thirdparty->town,
                'zip' => $fichinter->thirdparty->zip,
                'phone' => $fichinter->thirdparty->phone,
                'email' => $fichinter->thirdparty->email,
            ),
            'lines' => $fichinter->lines,
        );
    }

    /**
     * Update intervention status
     *
     * @param int   $id     Intervention ID
     * @param array $data   Update data (status, notes, etc.)
     * @return array Result
     *
     * @url PUT /interventions/{id}
     */
    public function updateIntervention($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->electricien->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        require_once DOL_DOCUMENT_ROOT.'/fichinter/class/fichinter.class.php';
        
        $fichinter = new Fichinter($this->db);
        $result = $fichinter->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        if (isset($data['status'])) {
            if ($data['status'] == 1) {
                $fichinter->setStatut(1); // Validated
            } elseif ($data['status'] == 2) {
                $fichinter->setStatut(2); // Done
            }
        }

        if (isset($data['dateStart'])) {
            $fichinter->dateo = $data['dateStart'];
        }
        if (isset($data['dateEnd'])) {
            $fichinter->datee = $data['dateEnd'];
        }

        $fichinter->update(DolibarrApiAccess::$user);

        return array('success' => true, 'message' => 'Intervention mise à jour');
    }

    /**
     * Add line/hours to intervention
     *
     * @param int   $id   Intervention ID
     * @param array $data Line data (description, duration, date)
     * @return array Result
     *
     * @url POST /interventions/{id}/lines
     */
    public function addLine($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->electricien->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        require_once DOL_DOCUMENT_ROOT.'/fichinter/class/fichinter.class.php';
        
        $fichinter = new Fichinter($this->db);
        $result = $fichinter->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        $result = $fichinter->addline(
            DolibarrApiAccess::$user,
            $id,
            $data['description'] ?? '',
            $data['date'] ?? dol_now(),
            $data['duration'] ?? 3600 // Default 1 hour in seconds
        );

        if ($result < 0) {
            throw new RestException(500, 'Erreur lors de l\'ajout de la ligne');
        }

        return array('success' => true, 'lineId' => $result);
    }

    /**
     * Get products list for materials
     *
     * @param string $search Search term
     * @return array Products
     *
     * @url GET /products
     */
    public function getProducts($search = '')
    {
        if (!DolibarrApiAccess::$user->rights->electricien->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $products = array();
        $sql = "SELECT rowid, ref, label, price FROM ".MAIN_DB_PREFIX."product ";
        $sql .= "WHERE tosell = 1 AND fk_product_type = 0";
        if ($search) {
            $sql .= " AND (ref LIKE '%".$this->db->escape($search)."%' OR label LIKE '%".$this->db->escape($search)."%')";
        }
        $sql .= " ORDER BY label LIMIT 50";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $products[] = array(
                    'id' => (int) $obj->rowid,
                    'ref' => $obj->ref,
                    'label' => $obj->label,
                    'price' => (float) $obj->price,
                );
            }
        }

        return $products;
    }

    /**
     * Get status/ping
     *
     * @return array Status
     *
     * @url GET /status
     */
    public function getStatus()
    {
        return array(
            'success' => true,
            'module' => 'electricien',
            'version' => '1.0.0',
            'timestamp' => date('c')
        );
    }
}
