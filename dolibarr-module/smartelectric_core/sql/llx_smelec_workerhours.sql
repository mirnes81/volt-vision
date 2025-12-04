-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table du suivi des heures ouvriers

CREATE TABLE llx_smelec_workerhours (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_user         INTEGER NOT NULL,           -- Lien vers llx_user (ouvrier)
    date_start      DATETIME NOT NULL,
    date_end        DATETIME DEFAULT NULL,
    duration_hours  DECIMAL(5, 2) DEFAULT NULL, -- Calculé ou manuel
    work_type       ENUM('travail', 'deplacement', 'pause', 'autre') NOT NULL DEFAULT 'travail',
    comment         TEXT DEFAULT NULL,
    is_manual       TINYINT(1) DEFAULT 0,       -- 1 si saisi manuellement
    gps_lat_start   DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_start   DECIMAL(11, 8) DEFAULT NULL,
    gps_lat_end     DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_end     DECIMAL(11, 8) DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_smelec_workerhours_intervention (fk_intervention),
    INDEX idx_smelec_workerhours_user (fk_user),
    INDEX idx_smelec_workerhours_date (date_start),
    CONSTRAINT fk_smelec_workerhours_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE,
    CONSTRAINT fk_smelec_workerhours_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
