-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for materials used in interventions

CREATE TABLE llx_mv3el_material (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_product      INTEGER NOT NULL,           -- Link to llx_product
    qty_used        DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit            VARCHAR(10) DEFAULT 'pce',
    comment         TEXT DEFAULT NULL,
    photo_path      VARCHAR(255) DEFAULT NULL,
    fk_user_creat   INTEGER NOT NULL,
    date_creation   DATETIME NOT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mv3el_material_intervention (fk_intervention),
    INDEX idx_mv3el_material_product (fk_product),
    CONSTRAINT fk_mv3el_material_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_mv3el_intervention(rowid) ON DELETE CASCADE,
    CONSTRAINT fk_mv3el_material_product FOREIGN KEY (fk_product) REFERENCES llx_product(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
