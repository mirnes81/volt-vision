-- Copyright (C) 2024 MV-3 PRO Électricien
-- Table for vehicle stock management

CREATE TABLE llx_mv3el_vehicle_stock (
    rowid           INTEGER AUTO_INCREMENT PRIMARY KEY,
    fk_user         INTEGER NOT NULL,           -- Worker/vehicle owner
    fk_product      INTEGER NOT NULL,           -- Link to llx_product
    qty_available   DECIMAL(10, 2) NOT NULL DEFAULT 0,
    qty_min         DECIMAL(10, 2) DEFAULT 5,   -- Low stock threshold
    last_refill     DATE DEFAULT NULL,
    tms             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_mv3el_vehicle_stock (fk_user, fk_product),
    INDEX idx_mv3el_vehicle_stock_user (fk_user),
    INDEX idx_mv3el_vehicle_stock_product (fk_product),
    CONSTRAINT fk_mv3el_vehicle_stock_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid),
    CONSTRAINT fk_mv3el_vehicle_stock_product FOREIGN KEY (fk_product) REFERENCES llx_product(rowid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
