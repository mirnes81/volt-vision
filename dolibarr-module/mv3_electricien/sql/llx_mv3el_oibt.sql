-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for OIBT (Ordonnance sur les installations à basse tension) controls

CREATE TABLE llx_mv3el_oibt (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention     INTEGER NOT NULL,
    ref                 VARCHAR(128) NOT NULL,
    
    -- Installation info
    installation_type   VARCHAR(100) DEFAULT NULL,
    installation_year   INTEGER DEFAULT NULL,
    voltage             DECIMAL(6, 1) DEFAULT NULL,
    amperage            DECIMAL(6, 1) DEFAULT NULL,
    
    -- Measurements
    isolation_resistance DECIMAL(8, 2) DEFAULT NULL,      -- Mohm
    earth_resistance    DECIMAL(8, 2) DEFAULT NULL,       -- Ohm
    loop_impedance      DECIMAL(8, 2) DEFAULT NULL,       -- Ohm
    rcd_trip_time       DECIMAL(6, 2) DEFAULT NULL,       -- ms
    rcd_trip_current    DECIMAL(6, 2) DEFAULT NULL,       -- mA
    
    -- Additional measurements (JSON for flexibility)
    measurements_json   JSON DEFAULT NULL,
    
    -- Results
    global_result       ENUM('conforme', 'non_conforme', 'reserve') NOT NULL DEFAULT 'conforme',
    comments            TEXT DEFAULT NULL,
    defects_found       TEXT DEFAULT NULL,
    recommendations     TEXT DEFAULT NULL,
    
    -- PDF report
    report_path         VARCHAR(255) DEFAULT NULL,
    
    -- Control info
    control_date        DATE NOT NULL,
    next_control_date   DATE DEFAULT NULL,
    fk_user_control     INTEGER NOT NULL,
    
    -- Standard fields
    date_creation       DATETIME NOT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_oibt_intervention (fk_intervention),
    INDEX idx_mv3el_oibt_ref (ref),
    INDEX idx_mv3el_oibt_result (global_result),
    CONSTRAINT fk_mv3el_oibt_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
