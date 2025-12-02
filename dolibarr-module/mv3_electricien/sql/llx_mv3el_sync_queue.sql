-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for offline sync queue (data from PWA waiting to sync)

CREATE TABLE llx_mv3el_sync_queue (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_user         INTEGER NOT NULL,
    sync_type       ENUM('hour', 'material', 'task', 'photo', 'signature', 'voicenote', 'oibt') NOT NULL,
    fk_intervention INTEGER NOT NULL,
    data_json       JSON NOT NULL,              -- Serialized data from PWA
    status          ENUM('pending', 'processing', 'done', 'error') NOT NULL DEFAULT 'pending',
    error_message   TEXT DEFAULT NULL,
    retry_count     INTEGER DEFAULT 0,
    date_creation   DATETIME NOT NULL,
    date_processed  DATETIME DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_sync_queue_status (status),
    INDEX idx_mv3el_sync_queue_user (fk_user),
    INDEX idx_mv3el_sync_queue_intervention (fk_intervention)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
