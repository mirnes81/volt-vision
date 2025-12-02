-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for intervention tasks (checklist)

CREATE TABLE llx_mv3el_task (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    label           VARCHAR(255) NOT NULL,
    task_order      INTEGER NOT NULL DEFAULT 0,
    status          ENUM('a_faire', 'fait') NOT NULL DEFAULT 'a_faire',
    date_done       DATETIME DEFAULT NULL,
    comment         TEXT DEFAULT NULL,
    fk_user_done    INTEGER DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_task_intervention (fk_intervention),
    CONSTRAINT fk_mv3el_task_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
