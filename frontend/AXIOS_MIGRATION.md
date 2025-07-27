# Migration vers Axios

## Résumé des changements

Ce document résume la migration de `fetch` vers **Axios** dans le frontend de l'application Hornet Finder.

## Fichiers modifiés

### 1. Configuration Axios (`src/utils/api.ts`)
- Configuration centralisée d'Axios avec :
  - Base URL `/api`
  - Timeout de 10 secondes
  - Headers par défaut
  - Intercepteurs pour l'authentification automatique
  - Gestion centralisée des erreurs (tokens expirés)

### 2. Types utilitaires (`src/utils/axiosTypes.ts`)
- Types TypeScript pour les erreurs Axios
- Fonction utilitaire `getAxiosErrorMessage()` pour extraire les messages d'erreur

### 3. Slices Redux modifiés
- **nestsSlice.ts** : Toutes les requêtes API converties vers Axios
- **hornetsSlice.ts** : Toutes les requêtes API converties vers Axios  
- **apiariesSlice.ts** : Toutes les requêtes API converties vers Axios

### 4. Composants modifiés
- **AddNestPopup.tsx** : Conversion du géocodage inverse vers Axios

## Avantages de la migration

### 1. Code plus lisible et concis
```javascript
// Avant (fetch)
const response = await fetch('/api/data', {
  headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) throw new Error('Request failed');
const data = await response.json();

// Après (Axios)
const response = await api.get('/data');
const data = response.data;
```

### 2. Gestion d'erreurs automatique
- Axios lance automatiquement une erreur pour les codes 4xx/5xx
- Plus besoin de vérifier `response.ok` manuellement

### 3. Intercepteurs intégrés
- Token d'authentification ajouté automatiquement
- Gestion centralisée des tokens expirés (401)
- Possibilité d'ajouter facilement d'autres intercepteurs (logging, etc.)

### 4. Transformation automatique
- JSON parsing automatique des réponses
- Stringify automatique des données envoyées

### 5. Configuration centralisée
- Base URL configurée une seule fois
- Headers par défaut appliqués partout
- Timeout global configuré

## Installation

```bash
npm install axios
```

## Impact sur le bundle
Axios ajoute environ 13KB gzippé au bundle, ce qui est négligeable comparé aux avantages apportés.

## Compatibilité
- Compatible avec toutes les fonctionnalités existantes
- Aucun changement breaking dans l'API des composants
- Les intercepteurs permettent une migration transparente

## Prochaines étapes possibles

1. **Retry automatique** : Ajouter des intercepteurs pour retry automatique
2. **Cache** : Implémenter un système de cache pour les requêtes GET
3. **Loading states** : Centraliser la gestion des états de chargement
4. **Request/Response logging** : Ajouter des logs pour le debugging
