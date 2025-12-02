# API REST MV3 Électricien

Documentation de l'API REST pour l'application mobile PWA.

## Base URL

```
https://votre-dolibarr.com/api/index.php/mv3electricien
```

## Authentification

Toutes les requêtes (sauf `/login`) nécessitent un token d'authentification dans le header:

```
DOLAPIKEY: votre_token_ici
```

---

## Endpoints

### 1. Authentification

#### POST /login

Connecte un ouvrier et retourne un token.

**Body:**
```json
{
  "login": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "abc123...",
  "worker": {
    "id": 1,
    "login": "jdupont",
    "name": "Dupont",
    "firstName": "Jean",
    "email": "jean@example.com",
    "phone": "+41791234567"
  }
}
```

---

### 2. Interventions

#### GET /worker/interventions

Récupère les interventions du jour pour l'ouvrier connecté.

**Response:**
```json
[
  {
    "id": 1,
    "ref": "MV3EL-000001",
    "label": "Installation tableau",
    "clientId": 5,
    "clientName": "SA Exemple",
    "projectId": 2,
    "projectRef": "PROJ-001",
    "location": "Rue du Lac 15, 1000 Lausanne",
    "type": "installation",
    "priority": "normal",
    "status": "a_planifier",
    "description": "Installation d'un nouveau tableau électrique",
    "datePlanned": "2024-01-15",
    "tasks": [...],
    "materials": [...],
    "hours": [...],
    "photos": [...]
  }
]
```

#### GET /intervention/{id}

Récupère les détails complets d'une intervention.

**Response:** Même format que ci-dessus avec toutes les données liées.

---

### 3. Heures de travail

#### POST /intervention/{id}/hours

Démarre, arrête ou ajoute manuellement des heures.

**Body (démarrer):**
```json
{
  "action": "start",
  "data": {
    "workType": "travail"
  }
}
```

**Body (arrêter):**
```json
{
  "action": "stop",
  "data": {
    "hourId": 123,
    "comment": "Travaux terminés"
  }
}
```

**Body (manuel):**
```json
{
  "action": "manual",
  "data": {
    "dateStart": "2024-01-15T08:00:00",
    "dateEnd": "2024-01-15T12:00:00",
    "durationHours": 4,
    "workType": "travail",
    "comment": "Matin"
  }
}
```

---

### 4. Matériaux

#### POST /intervention/{id}/material

Ajoute un matériau utilisé.

**Body:**
```json
{
  "productId": 45,
  "qtyUsed": 2.5,
  "unit": "m",
  "comment": "Câble 2.5mm²"
}
```

#### GET /products?search=cable

Recherche dans le catalogue produits Dolibarr.

---

### 5. Tâches

#### POST /intervention/{id}/task/{taskId}

Met à jour le statut d'une tâche.

**Body:**
```json
{
  "status": "fait",
  "comment": "Terminé sans problème"
}
```

---

### 6. Photos

#### POST /intervention/{id}/photo

Upload une photo (multipart/form-data).

**Form fields:**
- `photo`: Fichier image
- `type`: avant | pendant | apres | oibt | defaut

---

### 7. Signature

#### POST /intervention/{id}/sign

Enregistre la signature du client.

**Body:**
```json
{
  "signatureData": "data:image/png;base64,...",
  "signerName": "M. Client"
}
```

---

### 8. OIBT

#### POST /intervention/{id}/oibt

Enregistre un contrôle OIBT.

**Body:**
```json
{
  "voltage": 230,
  "amperage": 25,
  "isolationResistance": 150,
  "earthResistance": 2.5,
  "loopImpedance": 0.8,
  "rcdTripTime": 25,
  "rcdTripCurrent": 28,
  "globalResult": "conforme",
  "comments": "Installation conforme",
  "controlDate": "2024-01-15"
}
```

---

### 9. IA

#### POST /intervention/{id}/ai-summary

Génère un résumé et texte client via IA.

**Response:**
```json
{
  "summary": "Résumé généré...",
  "clientText": "Texte pour le client..."
}
```

#### POST /intervention/{id}/ai-diagnostic

Génère un diagnostic.

**Body:**
```json
{
  "symptoms": "Disjoncteur saute régulièrement"
}
```

---

### 10. Stock véhicule

#### GET /vehicle-stock

Récupère le stock du véhicule de l'ouvrier.

**Response:**
```json
[
  {
    "productId": 45,
    "productRef": "CABLE-25",
    "productLabel": "Câble 2.5mm²",
    "qtyAvailable": 50,
    "qtyMin": 10,
    "isLowStock": false
  }
]
```

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## Synchronisation hors-ligne

La PWA stocke les données localement et synchronise via POST /sync quand le réseau revient. Le format est géré automatiquement côté serveur.
