-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table des rapports journaliers

CREATE TABLE llx_smelec_dailyreport (
    rowid               INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_project          INTEGER DEFAULT NULL,       -- Projet optionnel
    fk_user             INTEGER NOT NULL,           -- Ouvrier
    report_date         DATE NOT NULL,
    total_hours         DECIMAL(5, 2) DEFAULT 0,
    interventions_json  JSON DEFAULT NULL,          -- Liste des interventions du jour
    summary             TEXT DEFAULT NULL,
    pdf_path            VARCHAR(255) DEFAULT NULL,
    comment             TEXT DEFAULT NULL,
    date_creation       DATETIME NOT NULL,
    tms                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_smelec_dailyreport (fk_user, report_date),
    INDEX idx_smelec_dailyreport_project (fk_project),
    INDEX idx_smelec_dailyreport_date (report_date),
    CONSTRAINT fk_smelec_dailyreport_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid) ON DELETE SET NULL,
    CONSTRAINT fk_smelec_dailyreport_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
