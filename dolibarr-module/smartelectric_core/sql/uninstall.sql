-- SmartElectric Core - Désinstallation SQL
-- Copyright (C) 2024-2025 SmartElectric Suite

-- ATTENTION: La désinstallation supprime TOUTES les données SmartElectric !

-- Supprimer les contraintes de clés étrangères d'abord
ALTER TABLE llx_smelec_task DROP FOREIGN KEY IF EXISTS fk_smelec_task_intervention;
ALTER TABLE llx_smelec_material DROP FOREIGN KEY IF EXISTS fk_smelec_material_intervention;
ALTER TABLE llx_smelec_workerhours DROP FOREIGN KEY IF EXISTS fk_smelec_workerhours_intervention;
ALTER TABLE llx_smelec_photo DROP FOREIGN KEY IF EXISTS fk_smelec_photo_intervention;
ALTER TABLE llx_smelec_oibt DROP FOREIGN KEY IF EXISTS fk_smelec_oibt_intervention;
ALTER TABLE llx_smelec_oibt_result DROP FOREIGN KEY IF EXISTS fk_smelec_oibt_result_oibt;

-- Supprimer les tables dans l'ordre inverse de création
DROP TABLE IF EXISTS llx_smelec_sync_queue;
DROP TABLE IF EXISTS llx_smelec_dailyreport;
DROP TABLE IF EXISTS llx_smelec_oibt_result;
DROP TABLE IF EXISTS llx_smelec_oibt;
DROP TABLE IF EXISTS llx_smelec_photo;
DROP TABLE IF EXISTS llx_smelec_workerhours;
DROP TABLE IF EXISTS llx_smelec_material;
DROP TABLE IF EXISTS llx_smelec_task;
DROP TABLE IF EXISTS llx_smelec_intervention;

-- Supprimer les constantes du module
DELETE FROM llx_const WHERE name LIKE 'SMELEC_%';
DELETE FROM llx_const WHERE name LIKE 'SMARTELECTRIC_%';

-- Supprimer les extrafields liés
DELETE FROM llx_extrafields WHERE elementtype = 'smelec_intervention';

-- Supprimer les droits
DELETE FROM llx_rights_def WHERE module = 'smartelectric_core';
DELETE FROM llx_user_rights WHERE fk_id IN (SELECT id FROM llx_rights_def WHERE module = 'smartelectric_core');
