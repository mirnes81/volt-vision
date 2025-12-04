-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table des matériaux utilisés dans les interventions

CREATE TABLE llx_smelec_material (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_intervention INTEGER NOT NULL,
    fk_product      INTEGER NOT NULL,           -- Lien vers llx_product
    qty_used        DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit            VARCHAR(10) DEFAULT 'pce',
    fk_user         INTEGER NOT NULL,           -- Utilisateur qui a ajouté
    date_use        DATETIME NOT NULL,
    photo_path      VARCHAR(255) DEFAULT NULL,
    comment         TEXT DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_smelec_material_intervention (fk_intervention),
    INDEX idx_smelec_material_product (fk_product),
    CONSTRAINT fk_smelec_material_intervention FOREIGN KEY (fk_intervention) REFERENCES llx_smelec_intervention(rowid) ON DELETE CASCADE,
    CONSTRAINT fk_smelec_material_product FOREIGN KEY (fk_product) REFERENCES llx_product(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
