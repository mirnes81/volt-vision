# SmartElectric Core - Module Dolibarr

## Description
Module Dolibarr pour la gestion des interventions électriques avec support PWA mobile.

## Installation

1. Copier le dossier `smartelectric_core` dans `/htdocs/custom/`
2. Activer le module dans Configuration > Modules
3. Configurer les paramètres IA dans l'administration du module

## Structure

```
smartelectric_core/
├── admin/
│   └── smartelectric_core.php    # Page de configuration
├── class/
│   ├── smelec_intervention.class.php  # Classe principale
│   ├── smelec_aiclient.class.php      # Client IA
│   └── api_smartelectric.class.php    # API REST
├── core/
│   └── modules/
│       └── modSmartelectric_core.class.php  # Descripteur module
├── sql/
│   ├── llx_smelec_intervention.sql
│   ├── llx_smelec_task.sql
│   ├── llx_smelec_material.sql
│   ├── llx_smelec_workerhours.sql
│   ├── llx_smelec_photo.sql
│   ├── llx_smelec_oibt.sql
│   ├── llx_smelec_oibt_result.sql
│   ├── llx_smelec_dailyreport.sql
│   └── llx_smelec_sync_queue.sql
└── langs/
    └── fr_FR/
        └── smartelectric_core.lang
```

## API REST

Base URL: `/api/index.php/smartelectric`

### Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /login | Authentification |
| GET | /worker/interventions | Liste interventions du jour |
| GET | /intervention/{id} | Détails intervention |
| POST | /intervention/{id}/hours | Gestion heures |
| POST | /intervention/{id}/material | Ajout matériel |
| POST | /intervention/{id}/task/{taskId} | Mise à jour tâche |
| POST | /intervention/{id}/photo | Upload photo |
| POST | /intervention/{id}/sign | Signature client |
| POST | /intervention/{id}/ai-summary | Génération résumé IA |
| POST | /intervention/{id}/ai-diagnostic | Génération diagnostic IA |
| GET | /products | Liste produits |

## Version
1.0.0

## Compatibilité
Dolibarr 18.x à 21.x
