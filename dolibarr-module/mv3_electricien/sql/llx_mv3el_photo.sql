-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for intervention photos

CREATE TABLE llx_mv3el_photo (
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
    fk_user_creat   INTEGER NOT NULL,
    date_photo      DATETIME NOT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_photo_intervention (fk_intervention),
    INDEX idx_mv3el_photo_type (photo_type),
    CONSTRAINT fk_mv3el_photo_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
