-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for voice notes

CREATE TABLE llx_mv3el_voicenote (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    file_path       VARCHAR(255) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    duration_sec    INTEGER DEFAULT NULL,
    transcription   TEXT DEFAULT NULL,          -- AI transcription if enabled
    fk_user_creat   INTEGER NOT NULL,
    date_creation   DATETIME NOT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_voicenote_intervention (fk_intervention),
    CONSTRAINT fk_mv3el_voicenote_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
