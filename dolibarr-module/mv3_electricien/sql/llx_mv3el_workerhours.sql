-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for worker hours tracking

CREATE TABLE llx_mv3el_workerhours (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_user         INTEGER NOT NULL,           -- Link to llx_user (worker)
    date_start      DATETIME NOT NULL,
    date_end        DATETIME DEFAULT NULL,
    duration_hours  DECIMAL(5, 2) DEFAULT NULL, -- Calculated or manual
    work_type       ENUM('travail', 'deplacement', 'pause') NOT NULL DEFAULT 'travail',
    comment         TEXT DEFAULT NULL,
    is_manual       TINYINT(1) DEFAULT 0,       -- 1 if manually entered
    gps_lat_start   DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_start   DECIMAL(11, 8) DEFAULT NULL,
    gps_lat_end     DECIMAL(10, 8) DEFAULT NULL,
    gps_lng_end     DECIMAL(11, 8) DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_workerhours_intervention (fk_intervention),
    INDEX idx_mv3el_workerhours_user (fk_user),
    INDEX idx_mv3el_workerhours_date (date_start),
    CONSTRAINT fk_mv3el_workerhours_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE,
    CONSTRAINT fk_mv3el_workerhours_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
