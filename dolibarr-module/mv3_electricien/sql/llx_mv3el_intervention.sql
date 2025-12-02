-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for electrical interventions

CREATE TABLE llx_mv3el_intervention (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    ref             VARCHAR(128) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    fk_soc          INTEGER NOT NULL,          -- Link to llx_societe (client)
    fk_project      INTEGER DEFAULT NULL,       -- Link to llx_projet
    fk_fichinter    INTEGER DEFAULT NULL,       -- Link to llx_fichinter (Dolibarr intervention)
    
    -- Location
    address         TEXT,
    zip             VARCHAR(25),
    town            VARCHAR(255),
    fk_country      INTEGER DEFAULT NULL,
    gps_lat         DECIMAL(10, 8) DEFAULT NULL,
    gps_lng         DECIMAL(11, 8) DEFAULT NULL,
    
    -- Classification
    intervention_type ENUM('installation', 'depannage', 'renovation', 'tableau', 'cuisine', 'oibt') NOT NULL DEFAULT 'depannage',
    priority        ENUM('normal', 'urgent') NOT NULL DEFAULT 'normal',
    status          ENUM('a_planifier', 'en_cours', 'termine', 'facture') NOT NULL DEFAULT 'a_planifier',
    
    -- Description & AI
    description     TEXT,
    ai_summary      TEXT DEFAULT NULL,
    ai_client_text  TEXT DEFAULT NULL,
    ai_diagnostic   TEXT DEFAULT NULL,
    
    -- Dates
    date_creation   DATETIME NOT NULL,
    date_start      DATETIME DEFAULT NULL,
    date_end        DATETIME DEFAULT NULL,
    date_planned    DATE DEFAULT NULL,
    
    -- Signature
    signature_path  VARCHAR(255) DEFAULT NULL,
    signature_date  DATETIME DEFAULT NULL,
    signature_name  VARCHAR(255) DEFAULT NULL,
    
    -- Dolibarr standard fields
    fk_user_creat   INTEGER NOT NULL,
    fk_user_modif   INTEGER DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    import_key      VARCHAR(14) DEFAULT NULL,
    entity          INTEGER DEFAULT 1 NOT NULL,
    
    INDEX idx_mv3el_intervention_ref (ref),
    INDEX idx_mv3el_intervention_fk_soc (fk_soc),
    INDEX idx_mv3el_intervention_fk_project (fk_project),
    INDEX idx_mv3el_intervention_status (status),
    INDEX idx_mv3el_intervention_date_planned (date_planned),
    CONSTRAINT fk_mv3el_intervention_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid),
    CONSTRAINT fk_mv3el_intervention_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
