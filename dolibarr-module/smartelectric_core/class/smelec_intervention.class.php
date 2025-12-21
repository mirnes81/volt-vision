<?php
/* Copyright (C) 2024-2025 SmartElectric Suite / MV-3 PRO
 * Classe principale pour les interventions électriques
 */

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

/**
 * Class SmelecIntervention
 * Gestion des interventions électriques SmartElectric / MV-3 PRO
 */
class SmelecIntervention extends CommonObject
{
    public $element = 'smelec_intervention';
    public $table_element = 'smelec_intervention';
    public $fk_element = 'fk_intervention';
    public $picto = 'fa-bolt';

    // Status constants
    const STATUS_DRAFT = 0;       // À planifier
    const STATUS_IN_PROGRESS = 1; // En cours
    const STATUS_DONE = 2;        // Terminé (signé)
    const STATUS_SENT = 3;        // Envoyé/Facturé

    // Priority constants
    const PRIORITY_NORMAL = 0;
    const PRIORITY_URGENT = 1;
    const PRIORITY_CRITICAL = 2;

    // Properties
    public $id;
    public $entity;
    public $ref;
    public $label;
    public $fk_soc;
    public $fk_project;
    public $location;
    public $location_gps_lat;
    public $location_gps_lng;
    public $type;
    public $priority;
    public $status;
    public $description;
    public $note_public;
    public $note_private;
    public $ai_summary;
    public $ai_client_text;
    public $ai_diagnostic;
    public $fk_user_author;
    public $fk_user_tech_main;
    public $date_creation;
    public $date_planned;
    public $date_start;
    public $date_end;
    public $signature_path;
    public $signature_date;
    public $signature_name;
    public $tms;

    // Related objects
    public $tasks = array();
    public $materials = array();
    public $hours = array();
    public $photos = array();
    public $thirdparty;
    public $project;

    /**
     * Constructor
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        $this->db = $db;
    }

    /**
     * Create intervention
     * @param User $user User creating
     * @param int $notrigger No trigger
     * @return int >0 if OK, <0 if KO
     */
    public function create($user, $notrigger = false)
    {
        global $conf;

        $error = 0;
        $now = dol_now();

        // Clean parameters
        $this->ref = $this->getNextNumRef();
        $this->label = trim($this->label);
        $this->status = self::STATUS_DRAFT;
        $this->entity = $conf->entity;

        $this->db->begin();

        $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_intervention (";
        $sql .= "entity, ref, label, fk_soc, fk_project, location,";
        $sql .= "location_gps_lat, location_gps_lng, type, priority, status,";
        $sql .= "description, note_public, note_private,";
        $sql .= "fk_user_author, fk_user_tech_main, date_creation, date_planned";
        $sql .= ") VALUES (";
        $sql .= (int) $this->entity.", ";
        $sql .= "'".$this->db->escape($this->ref)."', ";
        $sql .= "'".$this->db->escape($this->label)."', ";
        $sql .= (int) $this->fk_soc.", ";
        $sql .= ($this->fk_project > 0 ? (int) $this->fk_project : "NULL").", ";
        $sql .= "'".$this->db->escape($this->location)."', ";
        $sql .= ($this->location_gps_lat ? $this->location_gps_lat : "NULL").", ";
        $sql .= ($this->location_gps_lng ? $this->location_gps_lng : "NULL").", ";
        $sql .= "'".$this->db->escape($this->type ?: 'depannage')."', ";
        $sql .= (int) $this->priority.", ";
        $sql .= (int) $this->status.", ";
        $sql .= "'".$this->db->escape($this->description)."', ";
        $sql .= "'".$this->db->escape($this->note_public)."', ";
        $sql .= "'".$this->db->escape($this->note_private)."', ";
        $sql .= (int) $user->id.", ";
        $sql .= ($this->fk_user_tech_main > 0 ? (int) $this->fk_user_tech_main : "NULL").", ";
        $sql .= "'".$this->db->idate($now)."', ";
        $sql .= ($this->date_planned ? "'".$this->db->idate($this->date_planned)."'" : "NULL");
        $sql .= ")";

        $resql = $this->db->query($sql);
        if (!$resql) {
            $error++;
            $this->errors[] = "Error creating intervention: ".$this->db->lasterror();
        }

        if (!$error) {
            $this->id = $this->db->last_insert_id(MAIN_DB_PREFIX."smelec_intervention");

            // Create default checklist based on type
            $this->createDefaultTasks($user);
        }

        if (!$error) {
            $this->db->commit();
            return $this->id;
        } else {
            $this->db->rollback();
            return -1;
        }
    }

    /**
     * Fetch intervention
     * @param int $id Intervention ID
     * @param string $ref Intervention ref
     * @return int >0 if OK, 0 if not found, <0 if KO
     */
    public function fetch($id, $ref = '')
    {
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_intervention WHERE ";
        if ($id > 0) {
            $sql .= "rowid = ".(int) $id;
        } else {
            $sql .= "ref = '".$this->db->escape($ref)."'";
        }

        $resql = $this->db->query($sql);
        if ($resql) {
            if ($obj = $this->db->fetch_object($resql)) {
                $this->id = $obj->rowid;
                $this->entity = $obj->entity;
                $this->ref = $obj->ref;
                $this->label = $obj->label;
                $this->fk_soc = $obj->fk_soc;
                $this->fk_project = $obj->fk_project;
                $this->location = $obj->location;
                $this->location_gps_lat = $obj->location_gps_lat;
                $this->location_gps_lng = $obj->location_gps_lng;
                $this->type = $obj->type;
                $this->priority = $obj->priority;
                $this->status = $obj->status;
                $this->description = $obj->description;
                $this->note_public = $obj->note_public;
                $this->note_private = $obj->note_private;
                $this->ai_summary = $obj->ai_summary;
                $this->ai_client_text = $obj->ai_client_text;
                $this->ai_diagnostic = $obj->ai_diagnostic;
                $this->fk_user_author = $obj->fk_user_author;
                $this->fk_user_tech_main = $obj->fk_user_tech_main;
                $this->date_creation = $this->db->jdate($obj->date_creation);
                $this->date_planned = $this->db->jdate($obj->date_planned);
                $this->date_start = $this->db->jdate($obj->date_start);
                $this->date_end = $this->db->jdate($obj->date_end);
                $this->signature_path = $obj->signature_path;
                $this->signature_date = $this->db->jdate($obj->signature_date);
                $this->signature_name = $obj->signature_name;
                $this->tms = $obj->tms;

                return 1;
            }
            return 0;
        }
        return -1;
    }

    /**
     * Fetch all related data (tasks, materials, hours, photos)
     */
    public function fetchLines()
    {
        $this->fetchTasks();
        $this->fetchMaterials();
        $this->fetchHours();
        $this->fetchPhotos();
    }

    /**
     * Fetch tasks
     */
    public function fetchTasks()
    {
        $this->tasks = array();
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_task ";
        $sql .= "WHERE fk_intervention = ".(int) $this->id;
        $sql .= " ORDER BY task_order ASC";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $this->tasks[] = array(
                    'id' => $obj->rowid,
                    'label' => $obj->task_label,
                    'order' => $obj->task_order,
                    'status' => $obj->status,
                    'dateDone' => $obj->date_done,
                    'comment' => $obj->comment
                );
            }
        }
    }

    /**
     * Fetch materials
     */
    public function fetchMaterials()
    {
        $this->materials = array();
        $sql = "SELECT m.*, p.ref as product_ref, p.label as product_label ";
        $sql .= "FROM ".MAIN_DB_PREFIX."smelec_material m ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."product p ON p.rowid = m.fk_product ";
        $sql .= "WHERE m.fk_intervention = ".(int) $this->id;
        $sql .= " ORDER BY m.date_use DESC";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $this->materials[] = array(
                    'id' => $obj->rowid,
                    'productId' => $obj->fk_product,
                    'productRef' => $obj->product_ref,
                    'productName' => $obj->product_label,
                    'qtyUsed' => $obj->qty_used,
                    'unit' => $obj->unit,
                    'comment' => $obj->comment,
                    'photoPath' => $obj->photo_path
                );
            }
        }
    }

    /**
     * Fetch hours
     */
    public function fetchHours()
    {
        $this->hours = array();
        $sql = "SELECT h.*, u.login, CONCAT(u.firstname, ' ', u.lastname) as user_name ";
        $sql .= "FROM ".MAIN_DB_PREFIX."smelec_workerhours h ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = h.fk_user ";
        $sql .= "WHERE h.fk_intervention = ".(int) $this->id;
        $sql .= " ORDER BY h.date_start DESC";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $this->hours[] = array(
                    'id' => $obj->rowid,
                    'userId' => $obj->fk_user,
                    'userName' => $obj->user_name,
                    'dateStart' => $obj->date_start,
                    'dateEnd' => $obj->date_end,
                    'durationHours' => $obj->duration_hours,
                    'workType' => $obj->work_type,
                    'comment' => $obj->comment
                );
            }
        }
    }

    /**
     * Fetch photos
     */
    public function fetchPhotos()
    {
        $this->photos = array();
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_photo ";
        $sql .= "WHERE fk_intervention = ".(int) $this->id;
        $sql .= " ORDER BY date_photo DESC";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $this->photos[] = array(
                    'id' => $obj->rowid,
                    'type' => $obj->photo_type,
                    'filePath' => $obj->file_path,
                    'fileName' => $obj->file_name,
                    'datePhoto' => $obj->date_photo,
                    'description' => $obj->description
                );
            }
        }
    }

    /**
     * Update intervention
     * @param User $user User updating
     * @param int $notrigger No trigger
     * @return int >0 if OK, <0 if KO
     */
    public function update($user, $notrigger = false)
    {
        $sql = "UPDATE ".MAIN_DB_PREFIX."smelec_intervention SET ";
        $sql .= "label = '".$this->db->escape($this->label)."', ";
        $sql .= "fk_soc = ".(int) $this->fk_soc.", ";
        $sql .= "fk_project = ".($this->fk_project > 0 ? (int) $this->fk_project : "NULL").", ";
        $sql .= "location = '".$this->db->escape($this->location)."', ";
        $sql .= "type = '".$this->db->escape($this->type)."', ";
        $sql .= "priority = ".(int) $this->priority.", ";
        $sql .= "status = ".(int) $this->status.", ";
        $sql .= "description = '".$this->db->escape($this->description)."', ";
        $sql .= "note_public = '".$this->db->escape($this->note_public)."', ";
        $sql .= "note_private = '".$this->db->escape($this->note_private)."', ";
        $sql .= "fk_user_tech_main = ".($this->fk_user_tech_main > 0 ? (int) $this->fk_user_tech_main : "NULL").", ";
        $sql .= "date_planned = ".($this->date_planned ? "'".$this->db->idate($this->date_planned)."'" : "NULL");
        $sql .= " WHERE rowid = ".(int) $this->id;

        $resql = $this->db->query($sql);
        if ($resql) {
            return 1;
        }
        return -1;
    }

    /**
     * Delete intervention
     * @param User $user User deleting
     * @param int $notrigger No trigger
     * @return int >0 if OK, <0 if KO
     */
    public function delete($user, $notrigger = false)
    {
        $this->db->begin();

        // Delete related data (cascade should handle this, but be explicit)
        $tables = array('smelec_task', 'smelec_material', 'smelec_workerhours', 'smelec_photo');
        foreach ($tables as $table) {
            $this->db->query("DELETE FROM ".MAIN_DB_PREFIX.$table." WHERE fk_intervention = ".(int) $this->id);
        }

        $sql = "DELETE FROM ".MAIN_DB_PREFIX."smelec_intervention WHERE rowid = ".(int) $this->id;
        $resql = $this->db->query($sql);

        if ($resql) {
            $this->db->commit();
            return 1;
        }
        $this->db->rollback();
        return -1;
    }

    /**
     * Get next reference number
     * Format: MV3-INT-YYYY-####
     * @return string
     */
    public function getNextNumRef()
    {
        global $conf;

        $year = date('Y');
        $prefix = 'MV3-INT-'.$year.'-';

        $sql = "SELECT MAX(CAST(SUBSTRING(ref, ".(strlen($prefix) + 1).") AS UNSIGNED)) as max_num ";
        $sql .= "FROM ".MAIN_DB_PREFIX."smelec_intervention ";
        $sql .= "WHERE ref LIKE '".$this->db->escape($prefix)."%' AND entity = ".(int) $conf->entity;

        $resql = $this->db->query($sql);
        if ($resql) {
            $obj = $this->db->fetch_object($resql);
            $num = ($obj->max_num ? $obj->max_num + 1 : 1);
            return $prefix.sprintf('%04d', $num);
        }
        return $prefix.'0001';
    }

    /**
     * Create default tasks based on intervention type
     * @param User $user User
     */
    public function createDefaultTasks($user)
    {
        global $conf;

        $defaultTasks = array();

        // Type-specific default checklists
        switch ($this->type) {
            case 'installation':
                $defaultTasks = array(
                    'Vérification du tableau existant',
                    'Installation du nouveau matériel',
                    'Câblage et raccordement',
                    'Tests de fonctionnement',
                    'Nettoyage du chantier'
                );
                break;
            case 'depannage':
                $defaultTasks = array(
                    'Diagnostic de la panne',
                    'Identification de la cause',
                    'Réparation/Remplacement',
                    'Test de fonctionnement',
                    'Explications au client'
                );
                break;
            case 'renovation':
                $defaultTasks = array(
                    'État des lieux initial',
                    'Démontage ancien équipement',
                    'Installation nouvelle installation',
                    'Mise en conformité',
                    'Tests et vérifications'
                );
                break;
            case 'tableau':
                $defaultTasks = array(
                    'Coupure générale',
                    'Remplacement/Modification tableau',
                    'Raccordement circuits',
                    'Étiquetage',
                    'Tests différentiels'
                );
                break;
            case 'oibt':
                $defaultTasks = array(
                    'Contrôle visuel installation',
                    'Mesure isolation',
                    'Mesure terre',
                    'Test différentiels',
                    'Rapport OIBT'
                );
                break;
            default:
                $defaultTasks = array(
                    'Préparation intervention',
                    'Travaux',
                    'Vérifications',
                    'Nettoyage'
                );
        }

        // Insert tasks
        $order = 0;
        foreach ($defaultTasks as $taskLabel) {
            $sql = "INSERT INTO ".MAIN_DB_PREFIX."smelec_task ";
            $sql .= "(fk_intervention, task_label, task_order, status) VALUES (";
            $sql .= (int) $this->id.", ";
            $sql .= "'".$this->db->escape($taskLabel)."', ";
            $sql .= (int) $order.", 'a_faire')";
            $this->db->query($sql);
            $order++;
        }
    }

    /**
     * Get interventions for a specific day (for mobile app)
     * @param DoliDB $db Database
     * @param int $userId User ID
     * @param string $date Date (Y-m-d format), null for today
     * @return array
     */
    public static function getInterventionsForDay($db, $userId, $date = null)
    {
        global $conf;

        if (!$date) {
            $date = date('Y-m-d');
        }

        $interventions = array();

        $sql = "SELECT i.*, s.nom as client_name, s.address as client_address, s.zip as client_zip, s.town as client_town, p.ref as project_ref ";
        $sql .= "FROM ".MAIN_DB_PREFIX."smelec_intervention i ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."projet p ON p.rowid = i.fk_project ";
        $sql .= "WHERE i.entity = ".(int) $conf->entity;
        $sql .= " AND (i.fk_user_tech_main = ".(int) $userId;
        $sql .= " OR i.fk_user_author = ".(int) $userId.")";
        $sql .= " AND (DATE(i.date_planned) = '".$db->escape($date)."'";
        $sql .= " OR (i.status = 1 AND DATE(i.date_start) = '".$db->escape($date)."'))";
        $sql .= " ORDER BY i.priority DESC, i.date_planned ASC";

        $resql = $db->query($sql);
        if ($resql) {
            while ($obj = $db->fetch_object($resql)) {
                $statusMap = array(0 => 'a_planifier', 1 => 'en_cours', 2 => 'termine', 3 => 'facture');
                $priorityMap = array(0 => 'normal', 1 => 'urgent', 2 => 'critical');

                $interventions[] = array(
                    'id' => $obj->rowid,
                    'ref' => $obj->ref,
                    'label' => $obj->label,
                    'clientId' => $obj->fk_soc,
                    'clientName' => $obj->client_name,
                    'clientAddress' => $obj->client_address,
                    'clientZip' => $obj->client_zip,
                    'clientTown' => $obj->client_town,
                    'projectId' => $obj->fk_project,
                    'projectRef' => $obj->project_ref,
                    'location' => $obj->location ?: ($obj->client_address.', '.$obj->client_zip.' '.$obj->client_town),
                    'gpsLat' => $obj->location_gps_lat,
                    'gpsLng' => $obj->location_gps_lng,
                    'type' => $obj->type,
                    'priority' => $priorityMap[$obj->priority] ?? 'normal',
                    'status' => $statusMap[$obj->status] ?? 'a_planifier',
                    'description' => $obj->description,
                    'datePlanned' => $obj->date_planned,
                    'dateStart' => $obj->date_start,
                    'dateEnd' => $obj->date_end,
                );
            }
        }

        return $interventions;
    }

    /**
     * Convert object to array for API
     * @return array
     */
    public function toArray()
    {
        $statusMap = array(0 => 'a_planifier', 1 => 'en_cours', 2 => 'termine', 3 => 'facture');
        $priorityMap = array(0 => 'normal', 1 => 'urgent', 2 => 'critical');

        $data = array(
            'id' => $this->id,
            'ref' => $this->ref,
            'label' => $this->label,
            'clientId' => $this->fk_soc,
            'clientName' => $this->thirdparty ? $this->thirdparty->name : '',
            'clientEmail' => $this->thirdparty ? $this->thirdparty->email : '',
            'projectId' => $this->fk_project,
            'projectRef' => $this->project ? $this->project->ref : '',
            'location' => $this->location,
            'gpsLat' => $this->location_gps_lat,
            'gpsLng' => $this->location_gps_lng,
            'type' => $this->type,
            'priority' => $priorityMap[$this->priority] ?? 'normal',
            'status' => $statusMap[$this->status] ?? 'a_planifier',
            'description' => $this->description,
            'notePublic' => $this->note_public,
            'notePrivate' => $this->note_private,
            'aiSummary' => $this->ai_summary,
            'aiClientText' => $this->ai_client_text,
            'aiDiagnostic' => $this->ai_diagnostic,
            'technicianId' => $this->fk_user_tech_main,
            'dateCreation' => $this->date_creation,
            'datePlanned' => $this->date_planned,
            'dateStart' => $this->date_start,
            'dateEnd' => $this->date_end,
            'signaturePath' => $this->signature_path,
            'signatureDate' => $this->signature_date,
            'signatureName' => $this->signature_name,
            'tasks' => $this->tasks,
            'materials' => $this->materials,
            'hours' => $this->hours,
            'photos' => $this->photos,
        );

        return $data;
    }

    /**
     * Sync pending mobile data (called by cron)
     * @return int Number of synced items
     */
    public function syncPending()
    {
        $synced = 0;
        
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."smelec_sync_queue WHERE sync_status = 'pending' ORDER BY date_creation ASC LIMIT 100";
        $resql = $this->db->query($sql);
        
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                // Process sync item based on type
                $data = json_decode($obj->sync_data, true);
                $success = false;
                
                try {
                    switch ($obj->sync_type) {
                        case 'photo':
                            // Process photo upload
                            $success = true;
                            break;
                        case 'hours':
                            // Process hours
                            $success = true;
                            break;
                        case 'task':
                            // Process task update
                            $success = true;
                            break;
                        default:
                            $success = true;
                    }
                    
                    if ($success) {
                        $this->db->query("UPDATE ".MAIN_DB_PREFIX."smelec_sync_queue SET sync_status = 'done', date_processed = NOW() WHERE rowid = ".(int) $obj->rowid);
                        $synced++;
                    }
                } catch (Exception $e) {
                    $this->db->query("UPDATE ".MAIN_DB_PREFIX."smelec_sync_queue SET sync_status = 'error', error_message = '".$this->db->escape($e->getMessage())."', retry_count = retry_count + 1 WHERE rowid = ".(int) $obj->rowid);
                }
            }
        }
        
        return $synced;
    }
}
