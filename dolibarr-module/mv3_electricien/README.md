# Module MV3 Électricien pour Dolibarr

Module de gestion des interventions électriques avec support application mobile PWA.

## Prérequis

- Dolibarr 21.x
- PHP 7.4+
- MySQL 5.7+ / MariaDB 10.3+
- Modules Dolibarr requis:
  - Tiers/Sociétés
  - Produits
  - Projets
  - Ficheinter (Interventions)

## Installation

1. Copier le dossier `mv3_electricien` dans `/custom/` de votre Dolibarr:
   ```bash
   cp -r mv3_electricien /var/www/dolibarr/htdocs/custom/
   ```

2. Définir les permissions:
   ```bash
   chown -R www-data:www-data /var/www/dolibarr/htdocs/custom/mv3_electricien
   chmod -R 755 /var/www/dolibarr/htdocs/custom/mv3_electricien
   ```

3. Activer le module dans Dolibarr:
   - Aller dans **Configuration > Modules/Applications**
   - Chercher "MV3 Électricien"
   - Cliquer sur "Activer"

4. Configurer le module:
   - Aller dans **Configuration > MV3 Électricien**
   - Configurer les options IA si nécessaire
   - Configurer les contrôles OIBT

## Structure des tables

Le module crée les tables suivantes (préfixe `llx_mv3el_`):

| Table | Description |
|-------|-------------|
| `intervention` | Interventions principales |
| `task` | Tâches/checklist |
| `material` | Matériaux utilisés |
| `workerhours` | Heures de travail |
| `photo` | Photos |
| `oibt` | Contrôles OIBT |
| `voicenote` | Notes vocales |
| `vehicle_stock` | Stock véhicule |
| `sync_queue` | Queue de synchronisation |

## API REST

L'API est accessible via:
```
https://votre-dolibarr.com/api/index.php/mv3electricien
```

Voir `/doc/api.md` pour la documentation complète.

## Application mobile (PWA)

L'application mobile communique avec ce module via l'API REST. Elle permet aux ouvriers de:

- Voir leurs interventions du jour
- Démarrer/arrêter le chronomètre de travail
- Ajouter des matériaux avec scan QR
- Compléter la checklist
- Prendre des photos
- Effectuer des contrôles OIBT
- Faire signer le client
- Générer des résumés IA

## Configuration IA

Pour activer les fonctions IA:

1. Obtenir une clé API (OpenAI ou compatible)
2. Dans Configuration > MV3 Électricien:
   - Activer les fonctions IA
   - Entrer l'URL de l'API
   - Entrer la clé API

## Permissions

| Permission | Description |
|------------|-------------|
| intervention / read | Voir les interventions |
| intervention / write | Créer/modifier les interventions |
| intervention / delete | Supprimer les interventions |
| admin | Administrer le module |

## Support

Contact: support@mv3-electricien.ch

## Licence

GNU General Public License v3.0
