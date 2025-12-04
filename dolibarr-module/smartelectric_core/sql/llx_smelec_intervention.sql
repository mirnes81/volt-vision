-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table principale des interventions électriques

CREATE TABLE llx_smelec_intervention (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    entity              INTEGER DEFAULT 1 NOT NULL,
    ref                 VARCHAR(128) NOT NULL,
    label               VARCHAR(255) NOT NULL,
    
    -- Relations
    fk_soc              INTEGER NOT NULL,           -- Client (llx_societe)
    fk_project          INTEGER DEFAULT NULL,       -- Projet (llx_projet)
    
    -- Localisation
    location            VARCHAR(255) DEFAULT NULL,
    location_gps_lat    DECIMAL(10, 8) DEFAULT NULL,
    location_gps_lng    DECIMAL(11, 8) DEFAULT NULL,
    
    -- Type et priorité
    type                ENUM('installation', 'depannage', 'renovation', 'tableau', 'cuisine', 'oibt', 'autre') NOT NULL DEFAULT 'depannage',
    priority            SMALLINT NOT NULL DEFAULT 0, -- 0=normal, 1=urgent, 2=critique
    
    -- Statut
    status              SMALLINT NOT NULL DEFAULT 0, -- 0=a_planifier, 1=en_cours, 2=termine, 3=facture
    
    -- Description et contenu
    description         TEXT DEFAULT NULL,
    note_public         TEXT DEFAULT NULL,
    note_private        TEXT DEFAULT NULL,
    
    -- Champs IA
    ai_summary          TEXT DEFAULT NULL,
    ai_client_text      TEXT DEFAULT NULL,
    ai_diagnostic       TEXT DEFAULT NULL,
    
    -- Utilisateurs
    fk_user_author      INTEGER NOT NULL,           -- Créateur
    fk_user_tech_main   INTEGER DEFAULT NULL,       -- Technicien principal assigné
    
    -- Dates
    date_creation       DATETIME NOT NULL,
    date_planned        DATETIME DEFAULT NULL,
    date_start          DATETIME DEFAULT NULL,
    date_end            DATETIME DEFAULT NULL,
    
    -- Signature client
    signature_path      VARCHAR(255) DEFAULT NULL,
    signature_date      DATETIME DEFAULT NULL,
    signature_name      VARCHAR(128) DEFAULT NULL,
    
    -- Standard Dolibarr
    import_key          VARCHAR(14) DEFAULT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE KEY uk_smelec_intervention_ref (ref, entity),
    INDEX idx_smelec_intervention_fk_soc (fk_soc),
    INDEX idx_smelec_intervention_fk_project (fk_project),
    INDEX idx_smelec_intervention_status (status),
    INDEX idx_smelec_intervention_date_planned (date_planned),
    INDEX idx_smelec_intervention_fk_user_tech (fk_user_tech_main),
    
    -- Foreign keys
    CONSTRAINT fk_smelec_intervention_fk_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid),
    CONSTRAINT fk_smelec_intervention_fk_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
