# API Électricien PWA

## Base URL
`https://votre-dolibarr.com/api/index.php/electricien`

## Authentication
Utilisez le endpoint `/login` pour obtenir un token, puis incluez-le dans le header:
```
DOLAPIKEY: votre_token
```

## Endpoints

### POST /login
Authentification et obtention du token.

**Body:**
```json
{
  "login": "username",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "abc123...",
  "worker": {
    "id": 1,
    "login": "john",
    "name": "Doe",
    "firstName": "John"
  }
}
```

### GET /interventions/today
Liste des interventions du jour.

### GET /interventions/{id}
Détails d'une intervention.

### PUT /interventions/{id}
Mise à jour d'une intervention.

### POST /interventions/{id}/lines
Ajouter une ligne (heures) à une intervention.

### GET /products
Liste des produits/matériaux disponibles.

### GET /status
État de l'API.
