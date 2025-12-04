-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table des contrôles OIBT (Ordonnance sur les installations à basse tension)

CREATE TABLE llx_smelec_oibt (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention     INTEGER NOT NULL,
    fk_soc              INTEGER NOT NULL,           -- Client
    fk_project          INTEGER DEFAULT NULL,       -- Projet optionnel
    
    -- Informations contrôle
    ref                 VARCHAR(128) NOT NULL,
    date_control        DATE NOT NULL,
    fk_user_control     INTEGER NOT NULL,           -- Contrôleur
    
    -- Informations installation
    installation_type   VARCHAR(100) DEFAULT NULL,
    installation_year   INTEGER DEFAULT NULL,
    voltage             DECIMAL(6, 1) DEFAULT NULL, -- Volt
    amperage            DECIMAL(6, 1) DEFAULT NULL, -- Ampère
    
    -- Mesures principales
    isolation_resistance DECIMAL(8, 2) DEFAULT NULL,      -- Mohm
    earth_resistance    DECIMAL(8, 2) DEFAULT NULL,       -- Ohm
    loop_impedance      DECIMAL(8, 2) DEFAULT NULL,       -- Ohm
    rcd_trip_time       DECIMAL(6, 2) DEFAULT NULL,       -- ms
    rcd_trip_current    DECIMAL(6, 2) DEFAULT NULL,       -- mA
    
    -- Résultat global
    global_result       ENUM('conforme', 'non_conforme', 'reserve') NOT NULL DEFAULT 'conforme',
    comment_general     TEXT DEFAULT NULL,
    defects_found       TEXT DEFAULT NULL,
    recommendations     TEXT DEFAULT NULL,
    
    -- Rapport PDF
    pdf_path            VARCHAR(255) DEFAULT NULL,
    
    -- Prochaine date
    next_control_date   DATE DEFAULT NULL,
    
    -- Standard
    date_creation       DATETIME NOT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_smelec_oibt_intervention (fk_intervention),
    INDEX idx_smelec_oibt_soc (fk_soc),
    INDEX idx_smelec_oibt_ref (ref),
    INDEX idx_smelec_oibt_result (global_result),
    CONSTRAINT fk_smelec_oibt_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE,
    CONSTRAINT fk_smelec_oibt_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
