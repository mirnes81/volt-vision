-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table des tâches/checklist d'intervention

CREATE TABLE llx_smelec_task (
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
