<?php
/* Copyright (C) 2024 MV-3 PRO Électricien */

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

/**
 * Class Mv3elIntervention
 * Main class for electrical interventions
 */
class Mv3elIntervention extends CommonObject
{
    public $module = 'mv3_electricien';
    public $element = 'mv3el_intervention';
    public $table_element = 'mv3el_intervention';
    public $picto = 'fa-bolt';

    const STATUS_DRAFT = 'a_planifier';
    const STATUS_IN_PROGRESS = 'en_cours';
    const STATUS_DONE = 'termine';
    const STATUS_INVOICED = 'facture';

    // Fields
    public $id;
    public $ref;
    public $label;
    public $fk_soc;
    public $fk_project;
    public $fk_fichinter;
    public $address;
    public $zip;
    public $town;
    public $fk_country;
    public $gps_lat;
    public $gps_lng;
    public $intervention_type;
    public $priority;
    public $status;
    public $description;
    public $ai_summary;
    public $ai_client_text;
    public $ai_diagnostic;
    public $date_creation;
    public $date_start;
    public $date_end;
    public $date_planned;
    public $signature_path;
    public $signature_date;
    public $signature_name;
    public $fk_user_creat;
    public $fk_user_modif;
    public $entity;

    // Related objects (loaded separately)
    public $tasks = array();
    public $materials = array();
    public $hours = array();
    public $photos = array();
    public $oibt = null;

    // Linked Dolibarr objects
    public $thirdparty;
    public $project;

    /**
     * Constructor
     *
     * @param DoliDB $db Database handler
     */
    public function __construct($db)
    {
        global $conf, $langs;

        $this->db = $db;

        $this->fields = array(
            'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'visible' => 0, 'notnull' => 1, 'position' => 1, 'index' => 1),
            'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'visible' => 1, 'notnull' => 1, 'showoncombobox' => 1, 'position' => 10, 'searchall' => 1),
            'label' => array('type' => 'varchar(255)', 'label' => 'Label', 'enabled' => 1, 'visible' => 1, 'notnull' => 1, 'position' => 20, 'searchall' => 1),
            'fk_soc' => array('type' => 'integer:Societe:societe/class/societe.class.php', 'label' => 'ThirdParty', 'enabled' => 1, 'visible' => 1, 'notnull' => 1, 'position' => 30),
            'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php', 'label' => 'Project', 'enabled' => 1, 'visible' => 1, 'position' => 40),
            'intervention_type' => array('type' => 'varchar(50)', 'label' => 'Type', 'enabled' => 1, 'visible' => 1, 'notnull' => 1, 'position' => 50),
            'priority' => array('type' => 'varchar(20)', 'label' => 'Priority', 'enabled' => 1, 'visible' => 1, 'position' => 60),
            'status' => array('type' => 'varchar(20)', 'label' => 'Status', 'enabled' => 1, 'visible' => 1, 'notnull' => 1, 'position' => 70),
            'description' => array('type' => 'text', 'label' => 'Description', 'enabled' => 1, 'visible' => 3, 'position' => 80),
            'date_planned' => array('type' => 'date', 'label' => 'DatePlanned', 'enabled' => 1, 'visible' => 1, 'position' => 90),
            'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'visible' => 0, 'notnull' => 1, 'position' => 500),
            'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserCreat', 'enabled' => 1, 'visible' => 0, 'notnull' => 1, 'position' => 510),
            'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'visible' => 0, 'default' => 1, 'notnull' => 1, 'position' => 600),
        );
    }

    /**
     * Create intervention
     *
     * @param User $user User creating
     * @param bool $notrigger Disable triggers
     * @return int <0 if KO, >0 if OK (id)
     */
    public function create($user, $notrigger = false)
    {
        global $conf;

        $this->ref = $this->getNextNumRef();
        $this->date_creation = dol_now();
        $this->fk_user_creat = $user->id;
        $this->entity = $conf->entity;

        if (empty($this->status)) {
            $this->status = self::STATUS_DRAFT;
        }

        $sql = "INSERT INTO ".MAIN_DB_PREFIX.$this->table_element." (";
        $sql .= "ref, label, fk_soc, fk_project, fk_fichinter, ";
        $sql .= "address, zip, town, fk_country, gps_lat, gps_lng, ";
        $sql .= "intervention_type, priority, status, description, ";
        $sql .= "date_creation, date_planned, fk_user_creat, entity";
        $sql .= ") VALUES (";
        $sql .= "'".$this->db->escape($this->ref)."', ";
        $sql .= "'".$this->db->escape($this->label)."', ";
        $sql .= ((int) $this->fk_soc).", ";
        $sql .= ($this->fk_project > 0 ? (int) $this->fk_project : "NULL").", ";
        $sql .= ($this->fk_fichinter > 0 ? (int) $this->fk_fichinter : "NULL").", ";
        $sql .= "'".$this->db->escape($this->address)."', ";
        $sql .= "'".$this->db->escape($this->zip)."', ";
        $sql .= "'".$this->db->escape($this->town)."', ";
        $sql .= ($this->fk_country > 0 ? (int) $this->fk_country : "NULL").", ";
        $sql .= ($this->gps_lat ? $this->gps_lat : "NULL").", ";
        $sql .= ($this->gps_lng ? $this->gps_lng : "NULL").", ";
        $sql .= "'".$this->db->escape($this->intervention_type)."', ";
        $sql .= "'".$this->db->escape($this->priority ?: 'normal')."', ";
        $sql .= "'".$this->db->escape($this->status)."', ";
        $sql .= "'".$this->db->escape($this->description)."', ";
        $sql .= "'".$this->db->idate($this->date_creation)."', ";
        $sql .= ($this->date_planned ? "'".$this->db->idate($this->date_planned)."'" : "NULL").", ";
        $sql .= ((int) $this->fk_user_creat).", ";
        $sql .= ((int) $this->entity);
        $sql .= ")";

        $this->db->begin();

        $resql = $this->db->query($sql);
        if (!$resql) {
            $this->error = $this->db->lasterror();
            $this->db->rollback();
            return -1;
        }

        $this->id = $this->db->last_insert_id(MAIN_DB_PREFIX.$this->table_element);

        if (!$notrigger) {
            $result = $this->call_trigger('MV3EL_INTERVENTION_CREATE', $user);
            if ($result < 0) {
                $this->db->rollback();
                return -1;
            }
        }

        $this->db->commit();
        return $this->id;
    }

    /**
     * Load intervention by ID
     *
     * @param int $id ID
     * @param string $ref Ref
     * @return int <0 if KO, >0 if OK
     */
    public function fetch($id, $ref = '')
    {
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX.$this->table_element;
        if ($id > 0) {
            $sql .= " WHERE rowid = ".(int) $id;
        } else {
            $sql .= " WHERE ref = '".$this->db->escape($ref)."'";
        }

        $resql = $this->db->query($sql);
        if (!$resql) {
            $this->error = $this->db->lasterror();
            return -1;
        }

        if ($this->db->num_rows($resql) == 0) {
            return 0;
        }

        $obj = $this->db->fetch_object($resql);

        $this->id = $obj->rowid;
        $this->ref = $obj->ref;
        $this->label = $obj->label;
        $this->fk_soc = $obj->fk_soc;
        $this->fk_project = $obj->fk_project;
        $this->fk_fichinter = $obj->fk_fichinter;
        $this->address = $obj->address;
        $this->zip = $obj->zip;
        $this->town = $obj->town;
        $this->fk_country = $obj->fk_country;
        $this->gps_lat = $obj->gps_lat;
        $this->gps_lng = $obj->gps_lng;
        $this->intervention_type = $obj->intervention_type;
        $this->priority = $obj->priority;
        $this->status = $obj->status;
        $this->description = $obj->description;
        $this->ai_summary = $obj->ai_summary;
        $this->ai_client_text = $obj->ai_client_text;
        $this->ai_diagnostic = $obj->ai_diagnostic;
        $this->date_creation = $this->db->jdate($obj->date_creation);
        $this->date_start = $this->db->jdate($obj->date_start);
        $this->date_end = $this->db->jdate($obj->date_end);
        $this->date_planned = $this->db->jdate($obj->date_planned);
        $this->signature_path = $obj->signature_path;
        $this->signature_date = $this->db->jdate($obj->signature_date);
        $this->signature_name = $obj->signature_name;
        $this->fk_user_creat = $obj->fk_user_creat;
        $this->fk_user_modif = $obj->fk_user_modif;
        $this->entity = $obj->entity;

        return 1;
    }

    /**
     * Load related data (tasks, materials, hours, photos)
     *
     * @return int <0 if KO, >0 if OK
     */
    public function fetchLines()
    {
        $this->tasks = $this->fetchTasks();
        $this->materials = $this->fetchMaterials();
        $this->hours = $this->fetchHours();
        $this->photos = $this->fetchPhotos();
        return 1;
    }

    /**
     * Fetch tasks for this intervention
     *
     * @return array Array of tasks
     */
    public function fetchTasks()
    {
        $tasks = array();
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."mv3el_task WHERE fk_intervention = ".(int) $this->id." ORDER BY task_order";
        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $tasks[] = array(
                    'id' => $obj->rowid,
                    'label' => $obj->label,
                    'order' => $obj->task_order,
                    'status' => $obj->status,
                    'dateDone' => $obj->date_done,
                    'comment' => $obj->comment,
                );
            }
        }
        return $tasks;
    }

    /**
     * Fetch materials for this intervention
     *
     * @return array Array of materials
     */
    public function fetchMaterials()
    {
        $materials = array();
        $sql = "SELECT m.*, p.ref as product_ref, p.label as product_label ";
        $sql .= "FROM ".MAIN_DB_PREFIX."mv3el_material m ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."product p ON p.rowid = m.fk_product ";
        $sql .= "WHERE m.fk_intervention = ".(int) $this->id;

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $materials[] = array(
                    'id' => $obj->rowid,
                    'productId' => $obj->fk_product,
                    'productRef' => $obj->product_ref,
                    'productName' => $obj->product_label,
                    'qtyUsed' => $obj->qty_used,
                    'unit' => $obj->unit,
                    'comment' => $obj->comment,
                    'photoPath' => $obj->photo_path,
                );
            }
        }
        return $materials;
    }

    /**
     * Fetch hours for this intervention
     *
     * @return array Array of hours
     */
    public function fetchHours()
    {
        $hours = array();
        $sql = "SELECT h.*, u.login, CONCAT(u.firstname, ' ', u.lastname) as user_name ";
        $sql .= "FROM ".MAIN_DB_PREFIX."mv3el_workerhours h ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = h.fk_user ";
        $sql .= "WHERE h.fk_intervention = ".(int) $this->id." ORDER BY h.date_start";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $hours[] = array(
                    'id' => $obj->rowid,
                    'userId' => $obj->fk_user,
                    'userName' => $obj->user_name,
                    'dateStart' => $obj->date_start,
                    'dateEnd' => $obj->date_end,
                    'durationHours' => $obj->duration_hours,
                    'workType' => $obj->work_type,
                    'comment' => $obj->comment,
                );
            }
        }
        return $hours;
    }

    /**
     * Fetch photos for this intervention
     *
     * @return array Array of photos
     */
    public function fetchPhotos()
    {
        $photos = array();
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."mv3el_photo WHERE fk_intervention = ".(int) $this->id." ORDER BY date_photo";

        $resql = $this->db->query($sql);
        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $photos[] = array(
                    'id' => $obj->rowid,
                    'type' => $obj->photo_type,
                    'filePath' => $obj->file_path,
                    'datePhoto' => $obj->date_photo,
                );
            }
        }
        return $photos;
    }

    /**
     * Update intervention
     *
     * @param User $user User updating
     * @param bool $notrigger Disable triggers
     * @return int <0 if KO, >0 if OK
     */
    public function update($user, $notrigger = false)
    {
        $this->fk_user_modif = $user->id;

        $sql = "UPDATE ".MAIN_DB_PREFIX.$this->table_element." SET ";
        $sql .= "label = '".$this->db->escape($this->label)."', ";
        $sql .= "fk_soc = ".(int) $this->fk_soc.", ";
        $sql .= "fk_project = ".($this->fk_project > 0 ? (int) $this->fk_project : "NULL").", ";
        $sql .= "address = '".$this->db->escape($this->address)."', ";
        $sql .= "zip = '".$this->db->escape($this->zip)."', ";
        $sql .= "town = '".$this->db->escape($this->town)."', ";
        $sql .= "intervention_type = '".$this->db->escape($this->intervention_type)."', ";
        $sql .= "priority = '".$this->db->escape($this->priority)."', ";
        $sql .= "status = '".$this->db->escape($this->status)."', ";
        $sql .= "description = '".$this->db->escape($this->description)."', ";
        $sql .= "date_planned = ".($this->date_planned ? "'".$this->db->idate($this->date_planned)."'" : "NULL").", ";
        $sql .= "fk_user_modif = ".(int) $this->fk_user_modif;
        $sql .= " WHERE rowid = ".(int) $this->id;

        $this->db->begin();

        $resql = $this->db->query($sql);
        if (!$resql) {
            $this->error = $this->db->lasterror();
            $this->db->rollback();
            return -1;
        }

        if (!$notrigger) {
            $result = $this->call_trigger('MV3EL_INTERVENTION_MODIFY', $user);
            if ($result < 0) {
                $this->db->rollback();
                return -1;
            }
        }

        $this->db->commit();
        return 1;
    }

    /**
     * Delete intervention
     *
     * @param User $user User deleting
     * @param bool $notrigger Disable triggers
     * @return int <0 if KO, >0 if OK
     */
    public function delete($user, $notrigger = false)
    {
        $this->db->begin();

        if (!$notrigger) {
            $result = $this->call_trigger('MV3EL_INTERVENTION_DELETE', $user);
            if ($result < 0) {
                $this->db->rollback();
                return -1;
            }
        }

        // Delete related data (cascade in DB should handle this, but let's be explicit)
        $tables = array('mv3el_task', 'mv3el_material', 'mv3el_workerhours', 'mv3el_photo', 'mv3el_voicenote', 'mv3el_oibt');
        foreach ($tables as $table) {
            $sql = "DELETE FROM ".MAIN_DB_PREFIX.$table." WHERE fk_intervention = ".(int) $this->id;
            $this->db->query($sql);
        }

        $sql = "DELETE FROM ".MAIN_DB_PREFIX.$this->table_element." WHERE rowid = ".(int) $this->id;
        $resql = $this->db->query($sql);
        if (!$resql) {
            $this->error = $this->db->lasterror();
            $this->db->rollback();
            return -1;
        }

        $this->db->commit();
        return 1;
    }

    /**
     * Get next reference number
     *
     * @return string Next ref
     */
    public function getNextNumRef()
    {
        global $conf;

        $sql = "SELECT MAX(CAST(SUBSTRING(ref, 8) AS UNSIGNED)) as max_num ";
        $sql .= "FROM ".MAIN_DB_PREFIX.$this->table_element;
        $sql .= " WHERE ref LIKE 'MV3EL-%'";

        $resql = $this->db->query($sql);
        if ($resql) {
            $obj = $this->db->fetch_object($resql);
            $num = ($obj->max_num ?: 0) + 1;
        } else {
            $num = 1;
        }

        return 'MV3EL-'.sprintf('%06d', $num);
    }

    /**
     * Get interventions for a specific day (for PWA)
     *
     * @param int $userId Worker user ID
     * @param string $date Date (Y-m-d)
     * @return array Array of interventions
     */
    public static function getInterventionsForDay($db, $userId, $date = null)
    {
        if (!$date) {
            $date = date('Y-m-d');
        }

        $interventions = array();
        $sql = "SELECT i.*, s.nom as client_name, p.ref as project_ref ";
        $sql .= "FROM ".MAIN_DB_PREFIX."mv3el_intervention i ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."societe s ON s.rowid = i.fk_soc ";
        $sql .= "LEFT JOIN ".MAIN_DB_PREFIX."projet p ON p.rowid = i.fk_project ";
        $sql .= "WHERE i.status != 'facture' ";
        $sql .= "AND (i.date_planned = '".$db->escape($date)."' OR i.status = 'en_cours')";
        $sql .= " ORDER BY i.priority DESC, i.date_planned";

        $resql = $db->query($sql);
        if ($resql) {
            while ($obj = $db->fetch_object($resql)) {
                $intervention = new self($db);
                $intervention->fetch($obj->rowid);
                $intervention->fetchLines();
                $interventions[] = $intervention->toArray();
            }
        }
        return $interventions;
    }

    /**
     * Convert to array for API response
     *
     * @return array
     */
    public function toArray()
    {
        return array(
            'id' => $this->id,
            'ref' => $this->ref,
            'label' => $this->label,
            'clientId' => $this->fk_soc,
            'clientName' => $this->thirdparty ? $this->thirdparty->name : '',
            'projectId' => $this->fk_project,
            'projectRef' => $this->project ? $this->project->ref : '',
            'location' => trim($this->address.', '.$this->zip.' '.$this->town),
            'type' => $this->intervention_type,
            'priority' => $this->priority,
            'status' => $this->status,
            'description' => $this->description,
            'aiSummary' => $this->ai_summary,
            'aiClientText' => $this->ai_client_text,
            'aiDiagnostic' => $this->ai_diagnostic,
            'dateCreation' => $this->date_creation ? date('c', $this->date_creation) : null,
            'dateStart' => $this->date_start ? date('c', $this->date_start) : null,
            'dateEnd' => $this->date_end ? date('c', $this->date_end) : null,
            'datePlanned' => $this->date_planned ? date('Y-m-d', $this->date_planned) : null,
            'signaturePath' => $this->signature_path,
            'tasks' => $this->tasks,
            'materials' => $this->materials,
            'hours' => $this->hours,
            'photos' => $this->photos,
        );
    }

    /**
     * Sync pending changes from PWA
     *
     * @return int Number of synced items
     */
    public function syncPending()
    {
        global $user;

        $synced = 0;
        $sql = "SELECT * FROM ".MAIN_DB_PREFIX."mv3el_sync_queue WHERE status = 'pending' ORDER BY date_creation LIMIT 100";
        $resql = $this->db->query($sql);

        if ($resql) {
            while ($obj = $this->db->fetch_object($resql)) {
                $data = json_decode($obj->data_json, true);
                $success = false;

                try {
                    switch ($obj->sync_type) {
                        case 'hour':
                            $success = $this->syncHour($obj->fk_intervention, $data);
                            break;
                        case 'material':
                            $success = $this->syncMaterial($obj->fk_intervention, $data);
                            break;
                        case 'task':
                            $success = $this->syncTask($obj->fk_intervention, $data);
                            break;
                        case 'photo':
                            $success = $this->syncPhoto($obj->fk_intervention, $data);
                            break;
                        case 'signature':
                            $success = $this->syncSignature($obj->fk_intervention, $data);
                            break;
                    }

                    if ($success) {
                        $this->db->query("UPDATE ".MAIN_DB_PREFIX."mv3el_sync_queue SET status = 'done', date_processed = NOW() WHERE rowid = ".$obj->rowid);
                        $synced++;
                    } else {
                        $this->db->query("UPDATE ".MAIN_DB_PREFIX."mv3el_sync_queue SET retry_count = retry_count + 1 WHERE rowid = ".$obj->rowid);
                    }
                } catch (Exception $e) {
                    $this->db->query("UPDATE ".MAIN_DB_PREFIX."mv3el_sync_queue SET status = 'error', error_message = '".$this->db->escape($e->getMessage())."' WHERE rowid = ".$obj->rowid);
                }
            }
        }

        return $synced;
    }

    // Sync helper methods
    private function syncHour($interventionId, $data)
    {
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_workerhours ";
        $sql .= "(fk_intervention, fk_user, date_start, date_end, duration_hours, work_type, comment, is_manual) VALUES (";
        $sql .= (int) $interventionId.", ";
        $sql .= (int) $data['userId'].", ";
        $sql .= "'".$this->db->escape($data['dateStart'])."', ";
        $sql .= ($data['dateEnd'] ? "'".$this->db->escape($data['dateEnd'])."'" : "NULL").", ";
        $sql .= ($data['durationHours'] ? (float) $data['durationHours'] : "NULL").", ";
        $sql .= "'".$this->db->escape($data['workType'] ?: 'travail')."', ";
        $sql .= "'".$this->db->escape($data['comment'] ?: '')."', ";
        $sql .= ($data['isManual'] ? 1 : 0);
        $sql .= ")";
        return $this->db->query($sql);
    }

    private function syncMaterial($interventionId, $data)
    {
        global $user;
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_material ";
        $sql .= "(fk_intervention, fk_product, qty_used, unit, comment, fk_user_creat, date_creation) VALUES (";
        $sql .= (int) $interventionId.", ";
        $sql .= (int) $data['productId'].", ";
        $sql .= (float) $data['qtyUsed'].", ";
        $sql .= "'".$this->db->escape($data['unit'] ?: 'pce')."', ";
        $sql .= "'".$this->db->escape($data['comment'] ?: '')."', ";
        $sql .= (int) $user->id.", ";
        $sql .= "NOW()";
        $sql .= ")";
        return $this->db->query($sql);
    }

    private function syncTask($interventionId, $data)
    {
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_task SET ";
        $sql .= "status = '".$this->db->escape($data['status'])."', ";
        $sql .= "date_done = ".($data['status'] == 'fait' ? "NOW()" : "NULL").", ";
        $sql .= "comment = '".$this->db->escape($data['comment'] ?: '')."' ";
        $sql .= "WHERE rowid = ".(int) $data['taskId']." AND fk_intervention = ".(int) $interventionId;
        return $this->db->query($sql);
    }

    private function syncPhoto($interventionId, $data)
    {
        global $user;
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."mv3el_photo ";
        $sql .= "(fk_intervention, photo_type, file_path, file_name, fk_user_creat, date_photo) VALUES (";
        $sql .= (int) $interventionId.", ";
        $sql .= "'".$this->db->escape($data['type'])."', ";
        $sql .= "'".$this->db->escape($data['filePath'])."', ";
        $sql .= "'".$this->db->escape($data['fileName'])."', ";
        $sql .= (int) $user->id.", ";
        $sql .= "NOW()";
        $sql .= ")";
        return $this->db->query($sql);
    }

    private function syncSignature($interventionId, $data)
    {
        $sql = "UPDATE ".MAIN_DB_PREFIX."mv3el_intervention SET ";
        $sql .= "signature_path = '".$this->db->escape($data['signaturePath'])."', ";
        $sql .= "signature_date = NOW(), ";
        $sql .= "signature_name = '".$this->db->escape($data['signatureName'] ?: '')."' ";
        $sql .= "WHERE rowid = ".(int) $interventionId;
        return $this->db->query($sql);
    }
}
