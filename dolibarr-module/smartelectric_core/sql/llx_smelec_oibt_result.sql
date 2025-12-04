-- Copyright (C) 2024-2025 SmartElectric Suite
-- Table des résultats détaillés OIBT (points de contrôle)

CREATE TABLE llx_smelec_oibt_result (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_oibt         INTEGER NOT NULL,
    check_label     VARCHAR(255) NOT NULL,      -- Libellé du point de contrôle
    check_code      VARCHAR(50) DEFAULT NULL,   -- Code normalisé (ex: 4.1.1)
    result          ENUM('ok', 'nok', 'na') NOT NULL DEFAULT 'na',
    measure_value   VARCHAR(100) DEFAULT NULL,  -- Valeur mesurée
    comment         TEXT DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_smelec_oibt_result_fk_oibt (fk_oibt),
    INDEX idx_smelec_oibt_result_code (check_code),
    CONSTRAINT fk_smelec_oibt_result_oibt FOREIGN KEY (fk_oibt) REFERENCES llx_smelec_oibt(rowid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
