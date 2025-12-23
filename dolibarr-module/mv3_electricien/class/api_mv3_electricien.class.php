<?php
/* Copyright (C) 2024 MV-3 PRO Électricien
 * REST API for PWA communication
 */

use Luracast\Restler\RestException;

dol_include_once('/mv3_electricien/class/mv3el_intervention.class.php');
dol_include_once('/mv3_electricien/class/mv3el_ai.class.php');

/**
 * API class for MV3 Électricien module
 */
class Mv3Electricien extends DolibarrApi
{
    /**
     * @var DoliDB $db Database handler
     */
    private $db;

    /**
     * Constructor
     */
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
            throw new RestException(401, 'Invalid credentials');
        }

        // Check password
        $password_crypted = dol_hash($password);
        if ($user->pass_indatabase_crypted != $password_crypted && 
            !password_verify($password, $user->pass_indatabase_crypted)) {
            throw new RestException(401, 'Invalid credentials');
        }

        // Check if user is active
        if ($user->statut != 1) {
            throw new RestException(403, 'User account is disabled');
        }

        // Generate API token
        $token = bin2hex(random_bytes(32));
        
        // Store token (you might want to use a dedicated token table)
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
        global $user;

        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->read) {
            throw new RestException(403, 'Access denied');
        }

        $interventions = Mv3elIntervention::getInterventionsForDay($this->db, DolibarrApiAccess::$user->id);
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
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->read) {
            throw new RestException(403, 'Access denied');
        }

        $intervention = new Mv3elIntervention($this->db);
        $result = $intervention->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention not found');
        }

        // Load related data
        $intervention->fetchLines();

        // Load thirdparty
        require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
        $intervention->thirdparty = new Societe($this->db);
        $intervention->thirdparty->fetch($intervention->fk_soc);

        // Load project if exists
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
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        $userId = DolibarrApiAccess::$user->id;

        if ($action === 'start') {
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_workerhours ";
            $sql .= "(fk_intervention, fk_user, date_start, work_type) VALUES (";
            $sql .= (int) $id.", ".(int) $userId.", NOW(), ";
            $sql .= "'".$this->db->escape($data['workType'] ?: 'travail')."')";

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Failed to start hours');
            }

            $hourId = $this->db->last_insert_id(MAIN_DB_PREFIX.'mv3el_workerhours');

            // Update intervention status
            $this->db->query("UPDATE ".MAIN_DB_PREFIX."mv3el_intervention SET status = 'en_cours', date_start = IFNULL(date_start, NOW()) WHERE rowid = ".(int) $id);

            return array('id' => $hourId, 'status' => 'started');

        } elseif ($action === 'stop') {
            $hourId = (int) $data['hourId'];

            $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_workerhours SET ";
            $sql .= "date_end = NOW(), ";
            $sql .= "duration_hours = TIMESTAMPDIFF(MINUTE, date_start, NOW()) / 60, ";
            $sql .= "comment = '".$this->db->escape($data['comment'] ?: '')."' ";
            $sql .= "WHERE rowid = ".$hourId." AND fk_intervention = ".(int) $id;

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Failed to stop hours');
            }

            // Get updated hour
            $resql = $this->db->query("SELECT * FROM ".MAIN_DB_PREFIX."mv3el_workerhours WHERE rowid = ".$hourId);
            $hour = $this->db->fetch_object($resql);

            return array(
                'id' => $hourId,
                'status' => 'stopped',
                'durationHours' => $hour->duration_hours
            );

        } elseif ($action === 'manual') {
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_workerhours ";
            $sql .= "(fk_intervention, fk_user, date_start, date_end, duration_hours, work_type, comment, is_manual) VALUES (";
            $sql .= (int) $id.", ".(int) $userId.", ";
            $sql .= "'".$this->db->escape($data['dateStart'])."', ";
            $sql .= "'".$this->db->escape($data['dateEnd'])."', ";
            $sql .= (float) $data['durationHours'].", ";
            $sql .= "'".$this->db->escape($data['workType'] ?: 'travail')."', ";
            $sql .= "'".$this->db->escape($data['comment'] ?: '')."', 1)";

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Failed to add manual hours');
            }

            return array('id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'mv3el_workerhours'), 'status' => 'added');
        }

        throw new RestException(400, 'Invalid action');
    }

    /**
     * Add material to intervention
     *
     * @param int   $id   Intervention ID
     * @param array $data Material data (productId, qtyUsed, comment)
     * @return array Result
     *
     * @url POST /intervention/{id}/material
     */
    public function addMaterial($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_material ";
        $sql .= "(fk_intervention, fk_product, qty_used, unit, comment, fk_user_creat, date_creation) VALUES (";
        $sql .= (int) $id.", ";
        $sql .= (int) $data['productId'].", ";
        $sql .= (float) $data['qtyUsed'].", ";
        $sql .= "'".$this->db->escape($data['unit'] ?: 'pce')."', ";
        $sql .= "'".$this->db->escape($data['comment'] ?: '')."', ";
        $sql .= (int) DolibarrApiAccess::$user->id.", NOW())";

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Failed to add material');
        }

        $materialId = $this->db->last_insert_id(MAIN_DB_PREFIX.'mv3el_material');

        // Update vehicle stock if enabled
        $this->updateVehicleStock(DolibarrApiAccess::$user->id, $data['productId'], $data['qtyUsed']);

        return array('id' => $materialId, 'status' => 'added');
    }

    /**
     * Update task status
     *
     * @param int   $id     Intervention ID
     * @param int   $taskId Task ID
     * @param array $data   Task data (status, comment)
     * @return array Result
     *
     * @url POST /intervention/{id}/task/{taskId}
     */
    public function updateTask($id, $taskId, $data)
    {
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_task SET ";
        $sql .= "status = '".$this->db->escape($data['status'])."', ";
        $sql .= "date_done = ".($data['status'] === 'fait' ? "NOW()" : "NULL").", ";
        $sql .= "fk_user_done = ".($data['status'] === 'fait' ? (int) DolibarrApiAccess::$user->id : "NULL").", ";
        $sql .= "comment = '".$this->db->escape($data['comment'] ?: '')."' ";
        $sql .= "WHERE rowid = ".(int) $taskId." AND fk_intervention = ".(int) $id;

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Failed to update task');
        }

        return array('status' => 'updated');
    }

    /**
     * Upload photo
     *
     * @param int    $id   Intervention ID
     * @param string $type Photo type (avant, pendant, apres, oibt, defaut)
     * @return array Result with file path
     *
     * @url POST /intervention/{id}/photo
     */
    public function uploadPhoto($id, $type = 'pendant')
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        if (empty($_FILES['photo'])) {
            throw new RestException(400, 'No photo uploaded');
        }

        $upload_dir = $conf->mv3_electricien->dir_output.'/photos/'.$id;
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        $file = $_FILES['photo'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = $type.'_'.date('YmdHis').'_'.uniqid().'.'.$ext;
        $filepath = $upload_dir.'/'.$filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new RestException(500, 'Failed to save photo');
        }

        // Insert into database
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_photo ";
        $sql .= "(fk_intervention, photo_type, file_path, file_name, file_size, mime_type, fk_user_creat, date_photo) VALUES (";
        $sql .= (int) $id.", ";
        $sql .= "'".$this->db->escape($type)."', ";
        $sql .= "'".$this->db->escape($filepath)."', ";
        $sql .= "'".$this->db->escape($filename)."', ";
        $sql .= (int) $file['size'].", ";
        $sql .= "'".$this->db->escape($file['type'])."', ";
        $sql .= (int) DolibarrApiAccess::$user->id.", NOW())";

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Failed to save photo record');
        }

        return array(
            'id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'mv3el_photo'),
            'filePath' => $filepath,
            'fileName' => $filename
        );
    }

    /**
     * Save signature
     *
     * @param int   $id   Intervention ID
     * @param array $data Signature data (signatureData base64, signerName)
     * @return array Result
     *
     * @url POST /intervention/{id}/sign
     */
    public function saveSignature($id, $data)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        $upload_dir = $conf->mv3_electricien->dir_output.'/signatures';
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        // Decode base64 signature
        $signatureData = $data['signatureData'];
        if (strpos($signatureData, 'data:image') === 0) {
            $signatureData = explode(',', $signatureData)[1];
        }
        $signatureImage = base64_decode($signatureData);

        $filename = 'signature_'.$id.'_'.date('YmdHis').'.png';
        $filepath = $upload_dir.'/'.$filename;

        if (!file_put_contents($filepath, $signatureImage)) {
            throw new RestException(500, 'Failed to save signature');
        }

        // Update intervention
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_intervention SET ";
        $sql .= "signature_path = '".$this->db->escape($filepath)."', ";
        $sql .= "signature_date = NOW(), ";
        $sql .= "signature_name = '".$this->db->escape($data['signerName'] ?: '')."', ";
        $sql .= "status = 'termine', ";
        $sql .= "date_end = NOW() ";
        $sql .= "WHERE rowid = ".(int) $id;

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Failed to update intervention');
        }

        return array('status' => 'signed', 'signaturePath' => $filepath);
    }

    /**
     * Generate AI summary
     *
     * @param int $id Intervention ID
     * @return array AI generated content
     *
     * @url POST /intervention/{id}/ai-summary
     */
    public function generateAiSummary($id)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        if (empty($conf->global->MV3EL_AI_ENABLED)) {
            throw new RestException(400, 'AI features are disabled');
        }

        $intervention = new Mv3elIntervention($this->db);
        $result = $intervention->fetch($id);
        if ($result <= 0) {
            throw new RestException(404, 'Intervention not found');
        }
        $intervention->fetchLines();

        $ai = new Mv3elAiClient($this->db);
        $summary = $ai->generateSummary($intervention);
        $clientText = $ai->generateClientText($intervention);

        // Save to database
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_intervention SET ";
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
     * @param array $data Symptoms description
     * @return array AI diagnostic
     *
     * @url POST /intervention/{id}/ai-diagnostic
     */
    public function generateAiDiagnostic($id, $data)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        if (empty($conf->global->MV3EL_AI_ENABLED)) {
            throw new RestException(400, 'AI features are disabled');
        }

        $intervention = new Mv3elIntervention($this->db);
        $result = $intervention->fetch($id);
        if ($result <= 0) {
            throw new RestException(404, 'Intervention not found');
        }

        $ai = new Mv3elAiClient($this->db);
        $diagnostic = $ai->generateDiagnostic($intervention, $data['symptoms'] ?? '');

        // Save to database
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_intervention SET ";
        $sql .= "ai_diagnostic = '".$this->db->escape($diagnostic)."' ";
        $sql .= "WHERE rowid = ".(int) $id;
        $this->db->query($sql);

        return array('diagnostic' => $diagnostic);
    }

    /**
     * Get products list for materials
     *
     * @param string $search Search term
     * @return array Products list
     *
     * @url GET /products
     */
    public function getProducts($search = '')
    {
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->read) {
            throw new RestException(403, 'Access denied');
        }

        $products = array();
        $sql = "SELECT rowid, ref, label, fk_unit, price FROM ".MAIN_DB_PREFIX."product ";
        $sql .= "WHERE tosell = 1 AND fk_product_type = 0 ";  // Products, not services
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
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->read) {
            throw new RestException(403, 'Access denied');
        }

        $stock = array();
        $sql = "SELECT vs.*, p.ref, p.label FROM ".MAIN_DB_PREFIX."mv3el_vehicle_stock vs ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."product p ON p.rowid = vs.fk_product ";
        $sql .= "WHERE vs.fk_user = ".(int) DolibarrApiAccess::$user->id;
        $sql .= " ORDER BY p.label";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $stock[] = array(
                    'productId' => $obj->fk_product,
                    'productRef' => $obj->ref,
                    'productLabel' => $obj->label,
                    'qtyAvailable' => $obj->qty_available,
                    'qtyMin' => $obj->qty_min,
                    'isLowStock' => $obj->qty_available <= $obj->qty_min
                );
            }
        }

        return $stock;
    }

    /**
     * Update vehicle stock
     *
     * @param int $userId    User ID
     * @param int $productId Product ID
     * @param float $qtyUsed Quantity used
     */
    private function updateVehicleStock($userId, $productId, $qtyUsed)
    {
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_vehicle_stock SET ";
        $sql .= "qty_available = qty_available - ".(float) $qtyUsed." ";
        $sql .= "WHERE fk_user = ".(int) $userId." AND fk_product = ".(int) $productId;
        $this->db->query($sql);
    }

    /**
     * Save OIBT control
     *
     * @param int   $id   Intervention ID
     * @param array $data OIBT data
     * @return array Result
     *
     * @url POST /intervention/{id}/oibt
     */
    public function saveOibt($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->mv3_electricien->intervention->write) {
            throw new RestException(403, 'Access denied');
        }

        // Check if OIBT already exists for this intervention
        $resql = $this->db->query("SELECT rowid FROM ".MAIN_DB_PREFIX."mv3el_oibt WHERE fk_intervention = ".(int) $id);
        $existing = $this->db->fetch_object($resql);

        if ($existing) {
            // Update
            $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_oibt SET ";
            $sql .= "voltage = ".($data['voltage'] ? (float) $data['voltage'] : "NULL").", ";
            $sql .= "amperage = ".($data['amperage'] ? (float) $data['amperage'] : "NULL").", ";
            $sql .= "isolation_resistance = ".($data['isolationResistance'] ? (float) $data['isolationResistance'] : "NULL").", ";
            $sql .= "earth_resistance = ".($data['earthResistance'] ? (float) $data['earthResistance'] : "NULL").", ";
            $sql .= "loop_impedance = ".($data['loopImpedance'] ? (float) $data['loopImpedance'] : "NULL").", ";
            $sql .= "rcd_trip_time = ".($data['rcdTripTime'] ? (float) $data['rcdTripTime'] : "NULL").", ";
            $sql .= "rcd_trip_current = ".($data['rcdTripCurrent'] ? (float) $data['rcdTripCurrent'] : "NULL").", ";
            $sql .= "global_result = '".$this->db->escape($data['globalResult'] ?: 'conforme')."', ";
            $sql .= "comments = '".$this->db->escape($data['comments'] ?: '')."', ";
            $sql .= "control_date = '".$this->db->escape($data['controlDate'] ?: date('Y-m-d'))."' ";
            $sql .= "WHERE rowid = ".(int) $existing->rowid;

            $this->db->query($sql);
            return array('id' => $existing->rowid, 'status' => 'updated');
        } else {
            // Insert
            $ref = 'OIBT-'.sprintf('%06d', $id);
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_oibt ";
            $sql .= "(fk_intervention, ref, voltage, amperage, isolation_resistance, earth_resistance, ";
            $sql .= "loop_impedance, rcd_trip_time, rcd_trip_current, global_result, comments, ";
            $sql .= "control_date, fk_user_control, date_creation) VALUES (";
            $sql .= (int) $id.", '".$this->db->escape($ref)."', ";
            $sql .= ($data['voltage'] ? (float) $data['voltage'] : "NULL").", ";
            $sql .= ($data['amperage'] ? (float) $data['amperage'] : "NULL").", ";
            $sql .= ($data['isolationResistance'] ? (float) $data['isolationResistance'] : "NULL").", ";
            $sql .= ($data['earthResistance'] ? (float) $data['earthResistance'] : "NULL").", ";
            $sql .= ($data['loopImpedance'] ? (float) $data['loopImpedance'] : "NULL").", ";
            $sql .= ($data['rcdTripTime'] ? (float) $data['rcdTripTime'] : "NULL").", ";
            $sql .= ($data['rcdTripCurrent'] ? (float) $data['rcdTripCurrent'] : "NULL").", ";
            $sql .= "'".$this->db->escape($data['globalResult'] ?: 'conforme')."', ";
            $sql .= "'".$this->db->escape($data['comments'] ?: '')."', ";
            $sql .= "'".$this->db->escape($data['controlDate'] ?: date('Y-m-d'))."', ";
            $sql .= (int) DolibarrApiAccess::$user->id.", NOW())";

            if (!$this->db->query($sql)) {
                throw new RestException(500, 'Failed to save OIBT');
            }

            return array('id' => $this->db->last_insert_id(MAIN_DB_PREFIX.'mv3el_oibt'), 'status' => 'created');
        }
    }
}
