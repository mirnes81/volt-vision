# Installation SmartElectric Core / MV-3 PRO

## Module Dolibarr

### Prérequis
- Dolibarr v21 ou v22
- PHP 7.4+
- MySQL/MariaDB

### Installation

1. **Copier le module**
```bash
cp -r smartelectric_core /var/www/dolibarr/htdocs/custom/
```

2. **Installer les tables SQL**
```bash
mysql -u dolibarr -p dolibarr < /var/www/dolibarr/htdocs/custom/smartelectric_core/sql/install.sql
```

3. **Activer le module**
- Aller dans: Configuration > Modules
- Chercher "SmartElectric"
- Activer le module

4. **Configurer les permissions**
- Aller dans: Utilisateurs > Permissions
- Attribuer les droits SmartElectric aux techniciens

5. **Configurer l'IA (optionnel)**
- Aller dans: SmartElectric > Admin
- Activer l'IA et entrer l'URL/clé API OpenAI

### Endpoints API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /login | Authentification |
| GET | /interventions | Liste interventions |
| POST | /interventions | Créer intervention |
| GET | /interventions/{id} | Détail intervention |
| POST | /interventions/{id}/photos | Upload photo |
| POST | /interventions/{id}/signature | Sauver signature |
| POST | /interventions/{id}/pdf | Générer PDF |
| POST | /interventions/{id}/send-email | Envoyer par email |

### Structure des fichiers
```
/documents/smartelectric/
├── interventions/{REF}/
│   ├── photos/
│   └── {REF}_YYYYMMDD.pdf
├── oibt/
└── signatures/
```

## PWA (Application Web)

Configurer l'URL Dolibarr dans les paramètres de l'app.
