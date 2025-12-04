<?php
/* Copyright (C) 2024-2025 SmartElectric Suite
 * API REST pour SmartElectric Mobile (PWA)
 */

use Luracast\Restler\RestException;

require_once DOL_DOCUMENT_ROOT.'/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/smartelectric_core/class/smelec_intervention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/smartelectric_core/class/smelec_aiclient.class.php';

/**
 * API class for SmartElectric Core module
 */
class SmartelectricApi extends DolibarrApi
{
    private $db;

    public function __construct()
    {
        global $db;
        $this->db = $db;
    }

    /**
     * Login worker
     *
     * @param string $login    User login
     * @param string $password User password
     * @return array Token and worker info
     *
     * @url POST /login
     */
    public function login($login, $password)
    {
        global $conf, $dolibarr_main_authentication;

        require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

        $user = new User($this->db);
        $result = $user->fetch('', $login);

        if ($result <= 0) {
            throw new RestException(401, 'Identifiants invalides');
        }

        // Check password
        $password_crypted = dol_hash($password);
        if ($user->pass_indatabase_crypted != $password_crypted && 
            !password_verify($password, $user->pass_indatabase_crypted)) {
            throw new RestException(401, 'Identifiants invalides');
        }

        if ($user->statut != 1) {
            throw new RestException(403, 'Compte utilisateur désactivé');
        }

        // Generate API token
        $token = bin2hex(random_bytes(32));
        
        $sql = "UPDATE ".MAIN_DB_PREFIX."user SET api_key = '".$this->db->escape($token)."' WHERE rowid = ".$user->id;
        $this->db->query($sql);

        return array(
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
     * Get today's interventions for the logged worker
     *
     * @return array List of interventions
     *
     * @url GET /worker/interventions
     */
    public function getWorkerInterventions()
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $interventions = SmelecIntervention::getInterventionsForDay($this->db, DolibarrApiAccess::$user->id);
        return $interventions;
    }

    /**
     * Get intervention details
     *
     * @param int $id Intervention ID
     * @return array Intervention details
     *
     * @url GET /intervention/{id}
     */
    public function getIntervention($id)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        $intervention->fetchLines();

        require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
        $intervention->thirdparty = new Societe($this->db);
        $intervention->thirdparty->fetch($intervention->fk_soc);

        if ($intervention->fk_project > 0) {
            require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
            $intervention->project = new Project($this->db);
            $intervention->project->fetch($intervention->fk_project);
        }

        return $intervention->toArray();
    }

    /**
     * Start/Stop/Add hours
     *
     * @param int    $id       Intervention ID
     * @param string $action   Action: start, stop, manual
     * @param array  $data     Hour data
     * @return array Result
     *
     * @url POST /intervention/{id}/hours
     */
    public function manageHours($id, $action, $data = array())
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $userId = DolibarrApiAccess::$user->id;

        if ($action === 'start') {
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_workerhours ";
            $sql .= "(fk_intervention, fk_user, date_start, work_type) VALUES (";
            $sql .= (int) $id.", ".(int) $userId.", NOW(), ";
            $sql .= "'".$this->db->escape($data['workType'] ?: 'travail')."')";

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Erreur lors du démarrage des heures');
            }

            $hourId = $this->db->last_insert_id(MAIN_DB_PREFIX.'smelec_workerhours');

            $this->db->query("UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET status = 1, date_start = IFNULL(date_start, NOW()) WHERE rowid = ".(int) $id);

            return array('id' => $hourId, 'status' => 'started');

        } elseif ($action === 'stop') {
            $hourId = (int) $data['hourId'];

            $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_workerhours SET ";
            $sql .= "date_end = NOW(), ";
            $sql .= "duration_hours = TIMESTAMPDIFF(MINUTE, date_start, NOW()) / 60, ";
            $sql .= "comment = '".$this->db->escape($data['comment'] ?: '')."' ";
            $sql .= "WHERE rowid = ".$hourId." AND fk_intervention = ".(int) $id;

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Erreur lors de l\'arrêt des heures');
            }

            $resql = $this->db->query("SELECT * FROM ".MAIN_DB_PREFIX."smelec_workerhours WHERE rowid = ".$hourId);
            $hour = $this->db->fetch_object($resql);

            return array(
                'id' => $hourId,
                'status' => 'stopped',
                'durationHours' => $hour->duration_hours
            );

        } elseif ($action === 'manual') {
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_workerhours ";
            $sql .= "(fk_intervention, fk_user, date_start, date_end, duration_hours, work_type, comment, is_manual) VALUES (";
            $sql .= (int) $id.", ".(int) $userId.", ";
            $sql .= "'".$this->db->escape($data['dateStart'])."', ";
            $sql .= "'".$this->db->escape($data['dateEnd'])."', ";
            $sql .= (float) $data['durationHours'].", ";
            $sql .= "'".$this->db->escape($data['workType'] ?: 'travail')."', ";
            $sql .= "'".$this->db->escape($data['comment'] ?: '')."', 1)";

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Erreur lors de l\'ajout manuel des heures');
            }

            return array('id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'smelec_workerhours'), 'status' => 'added');
        }

        throw new RestException(400, 'Action invalide');
    }

    /**
     * Add material to intervention
     *
     * @param int   $id   Intervention ID
     * @param array $data Material data
     * @return array Result
     *
     * @url POST /intervention/{id}/material
     */
    public function addMaterial($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_material ";
        $sql .= "(fk_intervention, fk_product, qty_used, unit, comment, fk_user, date_use) VALUES (";
        $sql .= (int) $id.", ";
        $sql .= (int) $data['productId'].", ";
        $sql .= (float) $data['qtyUsed'].", ";
        $sql .= "'".$this->db->escape($data['unit'] ?: 'pce')."', ";
        $sql .= "'".$this->db->escape($data['comment'] ?: '')."', ";
        $sql .= (int) DolibarrApiAccess::$user->id.", NOW())";

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Erreur lors de l\'ajout du matériel');
        }

        return array('id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'smelec_material'), 'status' => 'added');
    }

    /**
     * Update task status
     *
     * @param int   $id     Intervention ID
     * @param int   $taskId Task ID
     * @param array $data   Task data
     * @return array Result
     *
     * @url POST /intervention/{id}/task/{taskId}
     */
    public function updateTask($id, $taskId, $data)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_task SET ";
        $sql .= "status = '".$this->db->escape($data['status'])."', ";
        $sql .= "date_done = ".($data['status'] === 'fait' ? "NOW()" : "NULL").", ";
        $sql .= "fk_user_done = ".($data['status'] === 'fait' ? (int) DolibarrApiAccess::$user->id : "NULL").", ";
        $sql .= "comment = '".$this->db->escape($data['comment'] ?: '')."' ";
        $sql .= "WHERE rowid = ".(int) $taskId." AND fk_intervention = ".(int) $id;

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Erreur lors de la mise à jour de la tâche');
        }

        return array('status' => 'updated');
    }

    /**
     * Upload photo
     *
     * @param int    $id   Intervention ID
     * @param string $type Photo type
     * @return array Result
     *
     * @url POST /intervention/{id}/photo
     */
    public function uploadPhoto($id, $type = 'pendant')
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        if (empty($_FILES['photo'])) {
            throw new RestException(400, 'Aucune photo fournie');
        }

        $upload_dir = $conf->smartelectric_core->dir_output.'/photos/'.$id;
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        $file = $_FILES['photo'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = $type.'_'.date('YmdHis').'_'.uniqid().'.'.$ext;
        $filepath = $upload_dir.'/'.$filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new RestException(500, 'Erreur lors de l\'enregistrement de la photo');
        }

        $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_photo ";
        $sql .= "(fk_intervention, photo_type, file_path, file_name, file_size, mime_type, fk_user, date_photo) VALUES (";
        $sql .= (int) $id.", ";
        $sql .= "'".$this->db->escape($type)."', ";
        $sql .= "'".$this->db->escape($filepath)."', ";
        $sql .= "'".$this->db->escape($filename)."', ";
        $sql .= (int) $file['size'].", ";
        $sql .= "'".$this->db->escape($file['type'])."', ";
        $sql .= (int) DolibarrApiAccess::$user->id.", NOW())";

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Erreur lors de l\'enregistrement');
        }

        return array(
            'id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'smelec_photo'),
            'filePath' => $filepath,
            'fileName' => $filename
        );
    }

    /**
     * Save signature
     *
     * @param int   $id   Intervention ID
     * @param array $data Signature data
     * @return array Result
     *
     * @url POST /intervention/{id}/sign
     */
    public function saveSignature($id, $data)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $upload_dir = $conf->smartelectric_core->dir_output.'/signatures';
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        $signatureData = $data['signatureData'];
        if (strpos($signatureData, 'data:image') === 0) {
            $signatureData = explode(',', $signatureData)[1];
        }
        $signatureImage = base64_decode($signatureData);

        $filename = 'signature_'.$id.'_'.date('YmdHis').'.png';
        $filepath = $upload_dir.'/'.$filename;

        if (!file_put_contents($filepath, $signatureImage)) {
            throw new RestException(500, 'Erreur lors de l\'enregistrement de la signature');
        }

        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "signature_path = '".$this->db->escape($filepath)."', ";
        $sql .= "signature_date = NOW(), ";
        $sql .= "signature_name = '".$this->db->escape($data['signerName'] ?: '')."', ";
        $sql .= "status = 2, ";
        $sql .= "date_end = NOW() ";
        $sql .= "WHERE rowid = ".(int) $id;

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Erreur lors de la mise à jour');
        }

        return array('status' => 'signed', 'signaturePath' => $filepath);
    }

    /**
     * Generate AI summary
     *
     * @param int $id Intervention ID
     * @return array AI content
     *
     * @url POST /intervention/{id}/ai-summary
     */
    public function generateAiSummary($id)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        if (empty($conf->global->SMELEC_AI_ENABLED)) {
            throw new RestException(400, 'Les fonctionnalités IA sont désactivées');
        }

        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($id);
        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }
        $intervention->fetchLines();

        $ai = new SmelecAiClient($this->db);
        $summary = $ai->generateSummary($intervention);
        $clientText = $ai->generateClientText($intervention);

        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "ai_summary = '".$this->db->escape($summary)."', ";
        $sql .= "ai_client_text = '".$this->db->escape($clientText)."' ";
        $sql .= "WHERE rowid = ".(int) $id;
        $this->db->query($sql);

        return array(
            'summary' => $summary,
            'clientText' => $clientText
        );
    }

    /**
     * Generate AI diagnostic
     *
     * @param int   $id   Intervention ID
     * @param array $data Symptoms
     * @return array AI diagnostic
     *
     * @url POST /intervention/{id}/ai-diagnostic
     */
    public function generateAiDiagnostic($id, $data)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        if (empty($conf->global->SMELEC_AI_ENABLED)) {
            throw new RestException(400, 'Les fonctionnalités IA sont désactivées');
        }

        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($id);
        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        $ai = new SmelecAiClient($this->db);
        $diagnostic = $ai->generateDiagnostic($intervention, $data['symptoms'] ?? '');

        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "ai_diagnostic = '".$this->db->escape($diagnostic)."' ";
        $sql .= "WHERE rowid = ".(int) $id;
        $this->db->query($sql);

        return array('diagnostic' => $diagnostic);
    }

    /**
     * Get products list
     *
     * @param string $search Search term
     * @return array Products
     *
     * @url GET /products
     */
    public function getProducts($search = '')
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $products = array();
        $sql = "SELECT rowid, ref, label, fk_unit, price FROM ".MAIN_DB_PREFIX."product ";
        $sql .= "WHERE tosell = 1 AND fk_product_type = 0 ";
        if ($search) {
            $sql .= "AND (ref LIKE '%".$this->db->escape($search)."%' OR label LIKE '%".$this->db->escape($search)."%') ";
        }
        $sql .= "ORDER BY label LIMIT 100";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $products[] = array(
                    'id' => $obj->rowid,
                    'ref' => $obj->ref,
                    'label' => $obj->label,
                    'unit' => $obj->fk_unit,
                    'price' => $obj->price
                );
            }
        }

        return $products;
    }

    /**
     * Get vehicle stock for current user
     *
     * @return array Stock items
     *
     * @url GET /vehicle-stock
     */
    public function getVehicleStock()
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        // TODO: Implement vehicle stock table if needed
        return array();
    }
}
