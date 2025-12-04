-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table de file d'attente pour synchronisation offline

CREATE TABLE llx_smelec_sync_queue (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_user         INTEGER NOT NULL,
    sync_type       VARCHAR(50) NOT NULL,       -- hour, material, task, photo, signature
    sync_action     VARCHAR(20) NOT NULL,       -- create, update, delete
    sync_data       JSON NOT NULL,              -- Données à synchroniser
    sync_status     ENUM('pending', 'processing', 'done', 'error') NOT NULL DEFAULT 'pending',
    error_message   TEXT DEFAULT NULL,
    retry_count     INTEGER DEFAULT 0,
    date_creation   DATETIME NOT NULL,
    date_processed  DATETIME DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_smelec_sync_queue_status (sync_status),
    INDEX idx_smelec_sync_queue_intervention (fk_intervention),
    INDEX idx_smelec_sync_queue_user (fk_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
