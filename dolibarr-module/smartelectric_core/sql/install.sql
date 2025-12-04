-- SmartElectric Core - Installation SQL
-- Copyright (C) 2024-2025 SmartElectric Suite

-- Table des interventions
CREATE TABLE IF NOT EXISTS llx_smelec_intervention (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    entity              INTEGER DEFAULT 1 NOT NULL,
    ref                 VARCHAR(128) NOT NULL,
    label               VARCHAR(255) NOT NULL,
    fk_soc              INTEGER NOT NULL,
    fk_project          INTEGER DEFAULT NULL,
    location            VARCHAR(255) DEFAULT NULL,
    location_gps_lat    DECIMAL(10, 8) DEFAULT NULL,
    location_gps_lng    DECIMAL(11, 8) DEFAULT NULL,
    type                ENUM('installation', 'depannage', 'renovation', 'tableau', 'cuisine', 'oibt', 'autre') NOT NULL DEFAULT 'depannage',
    priority            SMALLINT NOT NULL DEFAULT 0,
    status              SMALLINT NOT NULL DEFAULT 0,
    description         TEXT DEFAULT NULL,
    note_public         TEXT DEFAULT NULL,
    note_private        TEXT DEFAULT NULL,
    ai_summary          TEXT DEFAULT NULL,
    ai_client_text      TEXT DEFAULT NULL,
    ai_diagnostic       TEXT DEFAULT NULL,
    fk_user_author      INTEGER NOT NULL,
    fk_user_tech_main   INTEGER DEFAULT NULL,
    date_creation       DATETIME NOT NULL,
    date_planned        DATETIME DEFAULT NULL,
    date_start          DATETIME DEFAULT NULL,
    date_end            DATETIME DEFAULT NULL,
    signature_path      VARCHAR(255) DEFAULT NULL,
    signature_date      DATETIME DEFAULT NULL,
    signature_name      VARCHAR(128) DEFAULT NULL,
    import_key          VARCHAR(14) DEFAULT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_smelec_intervention_ref (ref, entity),
    INDEX idx_smelec_intervention_fk_soc (fk_soc),
    INDEX idx_smelec_intervention_status (status),
    INDEX idx_smelec_intervention_date_planned (date_planned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des tâches/checklist
CREATE TABLE IF NOT EXISTS llx_smelec_task (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    task_label      VARCHAR(255) NOT NULL,
    task_order      INTEGER NOT NULL DEFAULT 0,
    status          ENUM('a_faire', 'fait', 'na') NOT NULL DEFAULT 'a_faire',
    date_done       DATETIME DEFAULT NULL,
    fk_user_done    INTEGER DEFAULT NULL,
    comment         TEXT DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_task_intervention (fk_intervention),
    CONSTRAINT fk_smelec_task_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des matériaux
CREATE TABLE IF NOT EXISTS llx_smelec_material (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_product      INTEGER NOT NULL,
    qty_used        DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit            VARCHAR(10) DEFAULT 'pce',
    fk_user         INTEGER NOT NULL,
    date_use        DATETIME NOT NULL,
    photo_path      VARCHAR(255) DEFAULT NULL,
    comment         TEXT DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_material_intervention (fk_intervention),
    INDEX idx_smelec_material_product (fk_product),
    CONSTRAINT fk_smelec_material_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des heures ouvriers
CREATE TABLE IF NOT EXISTS llx_smelec_workerhours (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_user         INTEGER NOT NULL,
    date_start      DATETIME NOT NULL,
    date_end        DATETIME DEFAULT NULL,
    duration_hours  DECIMAL(5, 2) DEFAULT NULL,
    work_type       ENUM('travail', 'deplacement', 'pause', 'autre') NOT NULL DEFAULT 'travail',
    comment         TEXT DEFAULT NULL,
    is_manual       TINYINT(1) DEFAULT 0,
    gps_lat_start   DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_start   DECIMAL(11, 8) DEFAULT NULL,
    gps_lat_end     DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_end     DECIMAL(11, 8) DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_workerhours_intervention (fk_intervention),
    INDEX idx_smelec_workerhours_user (fk_user),
    INDEX idx_smelec_workerhours_date (date_start),
    CONSTRAINT fk_smelec_workerhours_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des photos
CREATE TABLE IF NOT EXISTS llx_smelec_photo (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    photo_type      ENUM('avant', 'pendant', 'apres', 'oibt', 'defaut') NOT NULL DEFAULT 'pendant',
    file_path       VARCHAR(255) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_size       INTEGER DEFAULT NULL,
    mime_type       VARCHAR(50) DEFAULT 'image/jpeg',
    description     TEXT DEFAULT NULL,
    gps_lat         DECIMAL(10, 8) DEFAULT NULL,
    gps_lng         DECIMAL(11, 8) DEFAULT NULL,
    fk_user         INTEGER NOT NULL,
    date_photo      DATETIME NOT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_photo_intervention (fk_intervention),
    INDEX idx_smelec_photo_type (photo_type),
    CONSTRAINT fk_smelec_photo_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des contrôles OIBT
CREATE TABLE IF NOT EXISTS llx_smelec_oibt (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention     INTEGER NOT NULL,
    fk_soc              INTEGER NOT NULL,
    fk_project          INTEGER DEFAULT NULL,
    ref                 VARCHAR(128) NOT NULL,
    date_control        DATE NOT NULL,
    fk_user_control     INTEGER NOT NULL,
    installation_type   VARCHAR(100) DEFAULT NULL,
    installation_year   INTEGER DEFAULT NULL,
    voltage             DECIMAL(6, 1) DEFAULT NULL,
    amperage            DECIMAL(6, 1) DEFAULT NULL,
    isolation_resistance DECIMAL(8, 2) DEFAULT NULL,
    earth_resistance    DECIMAL(8, 2) DEFAULT NULL,
    loop_impedance      DECIMAL(8, 2) DEFAULT NULL,
    rcd_trip_time       DECIMAL(6, 2) DEFAULT NULL,
    rcd_trip_current    DECIMAL(6, 2) DEFAULT NULL,
    global_result       ENUM('conforme', 'non_conforme', 'reserve') NOT NULL DEFAULT 'conforme',
    comment_general     TEXT DEFAULT NULL,
    defects_found       TEXT DEFAULT NULL,
    recommendations     TEXT DEFAULT NULL,
    pdf_path            VARCHAR(255) DEFAULT NULL,
    next_control_date   DATE DEFAULT NULL,
    date_creation       DATETIME NOT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_oibt_intervention (fk_intervention),
    INDEX idx_smelec_oibt_soc (fk_soc),
    INDEX idx_smelec_oibt_ref (ref),
    CONSTRAINT fk_smelec_oibt_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des résultats OIBT
CREATE TABLE IF NOT EXISTS llx_smelec_oibt_result (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_oibt         INTEGER NOT NULL,
    check_label     VARCHAR(255) NOT NULL,
    check_code      VARCHAR(50) DEFAULT NULL,
    result          ENUM('ok', 'nok', 'na') NOT NULL DEFAULT 'na',
    measure_value   VARCHAR(100) DEFAULT NULL,
    comment         TEXT DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_oibt_result_fk_oibt (fk_oibt),
    CONSTRAINT fk_smelec_oibt_result_oibt FOREIGN KEY (fk_oibt) REFERENCES llx_smelec_oibt(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des rapports journaliers
CREATE TABLE IF NOT EXISTS llx_smelec_dailyreport (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_project          INTEGER DEFAULT NULL,
    fk_user             INTEGER NOT NULL,
    report_date         DATE NOT NULL,
    total_hours         DECIMAL(5, 2) DEFAULT 0,
    interventions_json  JSON DEFAULT NULL,
    summary             TEXT DEFAULT NULL,
    pdf_path            VARCHAR(255) DEFAULT NULL,
    comment             TEXT DEFAULT NULL,
    date_creation       DATETIME NOT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_smelec_dailyreport (fk_user, report_date),
    INDEX idx_smelec_dailyreport_date (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table de synchronisation offline
CREATE TABLE IF NOT EXISTS llx_smelec_sync_queue (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_user         INTEGER NOT NULL,
    sync_type       VARCHAR(50) NOT NULL,
    sync_action     VARCHAR(20) NOT NULL,
    sync_data       JSON NOT NULL,
    sync_status     ENUM('pending', 'processing', 'done', 'error') NOT NULL DEFAULT 'pending',
    error_message   TEXT DEFAULT NULL,
    retry_count     INTEGER DEFAULT 0,
    date_creation   DATETIME NOT NULL,
    date_processed  DATETIME DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_smelec_sync_queue_status (sync_status),
    INDEX idx_smelec_sync_queue_intervention (fk_intervention)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
