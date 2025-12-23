<?php
/* Copyright (C) 2024-2025 SmartElectric Suite / MV-3 PRO
 * API REST pour SmartElectric Mobile (PWA)
 */

use Luracast\Restler\RestException;

dol_include_once('/smartelectric_core/class/smelec_intervention.class.php');
dol_include_once('/smartelectric_core/class/smelec_aiclient.class.php');
dol_include_once('/smartelectric_core/class/smelec_pdf_generator.class.php');

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
     * Get all interventions with filters
     *
     * @param string $status   Filter by status
     * @param int    $user     Filter by user ID
     * @param string $date     Filter by date (Y-m-d)
     * @param int    $limit    Limit results
     * @return array List of interventions
     *
     * @url GET /interventions
     */
    public function getInterventions($status = '', $user = 0, $date = '', $limit = 100)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $interventions = array();
        
        $sql = "SELECT i.*, s.nom as client_name, p.ref as project_ref ";
        $sql .= "FROM ".MAIN_DB_PREFIX."smelec_intervention i ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."projet p ON p.rowid = i.fk_project ";
        $sql .= "WHERE i.entity = ".(int) $conf->entity;
        
        if ($status !== '') {
            $sql .= " AND i.status = ".(int) $status;
        }
        if ($user > 0) {
            $sql .= " AND (i.fk_user_tech_main = ".(int) $user." OR i.fk_user_author = ".(int) $user.")";
        }
        if ($date) {
            $sql .= " AND DATE(i.date_planned) = '".$this->db->escape($date)."'";
        }
        
        $sql .= " ORDER BY i.date_planned DESC, i.priority DESC";
        $sql .= " LIMIT ".(int) $limit;

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $interventions[] = array(
                    'id' => $obj->rowid,
                    'ref' => $obj->ref,
                    'label' => $obj->label,
                    'clientId' => $obj->fk_soc,
                    'clientName' => $obj->client_name,
                    'location' => $obj->location,
                    'type' => $obj->type,
                    'priority' => $obj->priority,
                    'status' => $obj->status,
                    'datePlanned' => $obj->date_planned,
                    'projectRef' => $obj->project_ref,
                );
            }
        }

        return $interventions;
    }

    /**
     * Create new intervention
     *
     * @param array $data Intervention data
     * @return array Created intervention
     *
     * @url POST /interventions
     */
    public function createIntervention($data)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $intervention = new SmelecIntervention($this->db);
        
        $intervention->label = $data['label'] ?? '';
        $intervention->fk_soc = (int) ($data['clientId'] ?? $data['fk_soc'] ?? 0);
        $intervention->fk_project = (int) ($data['projectId'] ?? $data['fk_project'] ?? 0);
        $intervention->location = $data['location'] ?? '';
        $intervention->location_gps_lat = $data['gpsLat'] ?? null;
        $intervention->location_gps_lng = $data['gpsLng'] ?? null;
        $intervention->type = $data['type'] ?? 'depannage';
        $intervention->priority = (int) ($data['priority'] ?? 0);
        $intervention->description = $data['description'] ?? '';
        $intervention->fk_user_tech_main = (int) ($data['technicianId'] ?? DolibarrApiAccess::$user->id);
        
        if (!empty($data['datePlanned'])) {
            $intervention->date_planned = strtotime($data['datePlanned']);
        }

        if (empty($intervention->label) || empty($intervention->fk_soc)) {
            throw new RestException(400, 'Libellé et client sont obligatoires');
        }

        $result = $intervention->create(DolibarrApiAccess::$user);
        
        if ($result <= 0) {
            throw new RestException(500, 'Erreur création intervention: '.implode(', ', $intervention->errors));
        }

        return array(
            'id' => $intervention->id,
            'ref' => $intervention->ref,
            'status' => 'created'
        );
    }

    /**
     * Get intervention details
     *
     * @param int $id Intervention ID
     * @return array Intervention details
     *
     * @url GET /interventions/{id}
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
     * Update intervention
     *
     * @param int   $id   Intervention ID
     * @param array $data Updated data
     * @return array Result
     *
     * @url PUT /interventions/{id}
     */
    public function updateIntervention($id, $data)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($id);

        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }

        // Update fields if provided
        if (isset($data['label'])) $intervention->label = $data['label'];
        if (isset($data['location'])) $intervention->location = $data['location'];
        if (isset($data['type'])) $intervention->type = $data['type'];
        if (isset($data['priority'])) $intervention->priority = (int) $data['priority'];
        if (isset($data['status'])) $intervention->status = (int) $data['status'];
        if (isset($data['description'])) $intervention->description = $data['description'];

        $result = $intervention->update(DolibarrApiAccess::$user);
        
        if ($result < 0) {
            throw new RestException(500, 'Erreur mise à jour');
        }

        return array('status' => 'updated');
    }

    /**
     * Start/Stop/Add hours
     *
     * @param int    $id       Intervention ID
     * @param string $action   Action: start, stop, manual
     * @param array  $data     Hour data
     * @return array Result
     *
     * @url POST /interventions/{id}/hours
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
     * @url POST /interventions/{id}/materials
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
     * @url POST /interventions/{id}/tasks/{taskId}
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
     * @url POST /interventions/{id}/photos
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

        // Fetch intervention to get ref
        $intervention = new SmelecIntervention($this->db);
        $intervention->fetch($id);

        $upload_dir = DOL_DATA_ROOT.'/smartelectric/interventions/'.$intervention->ref.'/photos';
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        $file = $_FILES['photo'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
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
     * @url POST /interventions/{id}/signature
     */
    public function saveSignature($id, $data)
    {
        global $conf;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        // Fetch intervention to get ref
        $intervention = new SmelecIntervention($this->db);
        $intervention->fetch($id);

        $upload_dir = DOL_DATA_ROOT.'/smartelectric/interventions/'.$intervention->ref;
        if (!is_dir($upload_dir)) {
            dol_mkdir($upload_dir);
        }

        $signatureData = $data['signatureData'];
        if (strpos($signatureData, 'data:image') === 0) {
            $signatureData = explode(',', $signatureData)[1];
        }
        $signatureImage = base64_decode($signatureData);

        $filename = 'signature_'.date('YmdHis').'.png';
        $filepath = $upload_dir.'/'.$filename;

        if (!file_put_contents($filepath, $signatureImage)) {
            throw new RestException(500, 'Erreur lors de l\'enregistrement de la signature');
        }

        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "signature_path = '".$this->db->escape($filepath)."', ";
        $sql .= "signature_date = NOW(), ";
        $sql .= "signature_name = '".$this->db->escape($data['signerName'] ?: '')."', ";
        $sql .= "status = 2, "; // Terminé
        $sql .= "date_end = NOW() ";
        $sql .= "WHERE rowid = ".(int) $id;

        if (!$this->db->query($sql)) {
            throw new RestException(500, 'Erreur lors de la mise à jour');
        }

        return array('status' => 'signed', 'signaturePath' => $filepath);
    }

    /**
     * Generate PDF report
     *
     * @param int $id Intervention ID
     * @return array PDF info
     *
     * @url POST /interventions/{id}/pdf
     */
    public function generatePdf($id)
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $pdfGenerator = new SmelecPdfGenerator($this->db);
        $filepath = $pdfGenerator->generateInterventionPdf($id);

        if ($filepath === -1 || !$filepath) {
            throw new RestException(500, 'Erreur lors de la génération du PDF');
        }

        // Update intervention with PDF path
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET note_private = CONCAT(IFNULL(note_private, ''), '\nPDF généré: ".basename($filepath)."') WHERE rowid = ".(int) $id;
        $this->db->query($sql);

        return array(
            'status' => 'generated',
            'filePath' => $filepath,
            'fileName' => basename($filepath),
            'downloadUrl' => DOL_URL_ROOT.'/document.php?modulepart=smartelectric&file=interventions/'.basename(dirname($filepath)).'/'.basename($filepath)
        );
    }

    /**
     * Send intervention report by email
     *
     * @param int   $id   Intervention ID
     * @param array $data Email data (optional: recipientEmail, message)
     * @return array Result
     *
     * @url POST /interventions/{id}/send-email
     */
    public function sendEmail($id, $data = array())
    {
        global $conf, $mysoc;

        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->write) {
            throw new RestException(403, 'Accès refusé');
        }

        require_once DOL_DOCUMENT_ROOT.'/core/class/CMailFile.class.php';
        require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';

        // Fetch intervention
        $intervention = new SmelecIntervention($this->db);
        $result = $intervention->fetch($id);
        if ($result <= 0) {
            throw new RestException(404, 'Intervention non trouvée');
        }
        $intervention->fetchLines();

        // Fetch client
        $client = new Societe($this->db);
        $client->fetch($intervention->fk_soc);

        // Generate PDF first
        $pdfGenerator = new SmelecPdfGenerator($this->db);
        $pdfPath = $pdfGenerator->generateInterventionPdf($id);

        if (!$pdfPath || !file_exists($pdfPath)) {
            throw new RestException(500, 'Erreur lors de la génération du PDF');
        }

        // Email recipient
        $recipientEmail = $data['recipientEmail'] ?? $client->email;
        if (empty($recipientEmail)) {
            throw new RestException(400, 'Email du destinataire non défini');
        }

        // Email copy
        $copyEmail = 'info@mv-3pro.ch';

        // Email subject
        $subject = 'Rapport d\'intervention '.$intervention->ref.' - '.$mysoc->name;

        // Email message
        $message = $data['message'] ?? $this->_getDefaultEmailMessage($intervention, $client, $mysoc);

        // Send email
        $mailfile = new CMailFile(
            $subject,
            $recipientEmail,
            $conf->global->MAIN_MAIL_EMAIL_FROM ?: $mysoc->email,
            $message,
            array($pdfPath),        // Attachments
            array('application/pdf'), // Mime types
            array(basename($pdfPath)), // Filenames
            $copyEmail,             // CC
            '',                     // BCC
            0,                      // Delivery receipt
            1                       // HTML
        );

        $result = $mailfile->sendfile();

        if (!$result) {
            throw new RestException(500, 'Erreur lors de l\'envoi de l\'email: '.$mailfile->error);
        }

        // Update intervention status to "sent"
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "status = 3, "; // Facturé/Envoyé
        $sql .= "note_private = CONCAT(IFNULL(note_private, ''), '\nEmail envoyé à ".$this->db->escape($recipientEmail)." le ".date('d/m/Y H:i')."') ";
        $sql .= "WHERE rowid = ".(int) $id;
        $this->db->query($sql);

        return array(
            'status' => 'sent',
            'recipientEmail' => $recipientEmail,
            'copyEmail' => $copyEmail,
            'pdfPath' => $pdfPath
        );
    }

    /**
     * Get default email message
     */
    private function _getDefaultEmailMessage($intervention, $client, $mysoc)
    {
        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">';
        $html .= '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">';
        
        // Header
        $html .= '<div style="text-align: center; margin-bottom: 30px;">';
        $html .= '<h1 style="color: #2563eb; margin: 0;">MV-3 PRO</h1>';
        $html .= '<p style="color: #666; margin: 5px 0;">Électricien professionnel</p>';
        $html .= '</div>';
        
        // Content
        $html .= '<p>Bonjour,</p>';
        $html .= '<p>Veuillez trouver ci-joint le rapport d\'intervention n° <strong>'.$intervention->ref.'</strong>.</p>';
        
        $html .= '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">';
        $html .= '<p style="margin: 5px 0;"><strong>Intervention:</strong> '.$intervention->label.'</p>';
        $html .= '<p style="margin: 5px 0;"><strong>Date:</strong> '.dol_print_date($intervention->date_creation, 'day').'</p>';
        $html .= '<p style="margin: 5px 0;"><strong>Adresse:</strong> '.$intervention->location.'</p>';
        $html .= '</div>';
        
        if ($intervention->ai_client_text) {
            $html .= '<p>'.$intervention->ai_client_text.'</p>';
        } else {
            $html .= '<p>Nous restons à votre disposition pour toute question concernant cette intervention.</p>';
        }
        
        // Footer
        $html .= '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">';
        $html .= '<p style="color: #666; font-size: 14px;">';
        $html .= '<strong>'.$mysoc->name.'</strong><br>';
        if ($mysoc->address) $html .= $mysoc->address.'<br>';
        if ($mysoc->zip || $mysoc->town) $html .= $mysoc->zip.' '.$mysoc->town.'<br>';
        if ($mysoc->phone) $html .= 'Tél: '.$mysoc->phone.'<br>';
        if ($mysoc->email) $html .= 'Email: '.$mysoc->email;
        $html .= '</p>';
        
        $html .= '</div></body></html>';
        
        return $html;
    }

    /**
     * Generate AI summary
     *
     * @param int $id Intervention ID
     * @return array AI content
     *
     * @url POST /interventions/{id}/ai-summary
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
     * @url POST /interventions/{id}/ai-diagnostic
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
     * Get clients list
     *
     * @param string $search Search term
     * @return array Clients
     *
     * @url GET /clients
     */
    public function getClients($search = '')
    {
        if (!DolibarrApiAccess::$user->rights->smartelectric_core->intervention->read) {
            throw new RestException(403, 'Accès refusé');
        }

        $clients = array();
        $sql = "SELECT rowid, nom, name_alias, address, zip, town, phone, email FROM ".MAIN_DB_PREFIX."societe ";
        $sql .= "WHERE status = 1 AND client IN (1, 3) ";
        if ($search) {
            $sql .= "AND (nom LIKE '%".$this->db->escape($search)."%' OR name_alias LIKE '%".$this->db->escape($search)."%') ";
        }
        $sql .= "ORDER BY nom LIMIT 100";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $clients[] = array(
                    'id' => $obj->rowid,
                    'name' => $obj->nom,
                    'alias' => $obj->name_alias,
                    'address' => $obj->address,
                    'zip' => $obj->zip,
                    'town' => $obj->town,
                    'phone' => $obj->phone,
                    'email' => $obj->email
                );
            }
        }

        return $clients;
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
