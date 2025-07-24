# Système de détection de chevauchement d'objets sur la carte

## Vue d'ensemble

Ce système résout le problème où plusieurs objets (frelons, ruchers, nids) se superposent sur la carte, rendant certains objets inaccessibles au clic.

## Fonctionnalités

### 1. Détection automatique de chevauchement
- Détecte quand 2 ou plus objets se trouvent dans un rayon de 50 pixels du point cliqué
- Fonctionne pour tous les types d'objets : frelons, ruchers et nids

### 2. Zoom automatique intelligent
- Si les objets peuvent être séparés en zoomant plus (zoom < 18), le système zoome automatiquement
- Centrée sur la position des objets superposés

### 3. Dialogue de sélection
- Si le zoom ne peut pas séparer les objets, affiche un dialogue avec la liste des objets
- Chaque objet affiche :
  - Son symbole (🐝 pour frelon, 🍯 pour rucher, 🏴/💀 pour nid)
  - Son ID
  - Ses informations spécifiques (direction pour frelon, niveau d'infestation pour rucher, statut pour nid)
  - Les couleurs de marquage pour les frelons

## Architecture technique

### Composants principaux

#### `OverlapDialog.tsx`
- Interface modale pour sélectionner parmi les objets superposés
- Affiche les informations détaillées de chaque objet
- Gère la sélection et fermeture

#### `useOverlapDetection.ts`
- Hook principal pour détecter les chevauchements
- Calcule les distances en pixels entre les objets et le point de clic
- Détermine si un zoom peut séparer les objets

#### `useSmartClickHandlers.ts`
- Gestionnaires de clic intelligents qui vérifient les chevauchements
- Intègre la logique de zoom automatique et d'affichage du dialogue

#### `SmartMapClickHandler.tsx`
- Composant qui gère les clics sur les zones vides de la carte
- Utilise useMapClickHandler pour la logique de détection

#### `MapRefHandler.tsx`
- Utilitaire pour récupérer la référence de la carte Leaflet
- Nécessaire pour les calculs de distance en pixels

### Types

#### `MapObject`
```typescript
interface MapObject {
  id: number | string;
  type: MapObjectType;
  latitude: number;
  longitude: number;
  data: Hornet | Apiary | Nest;
  symbol: string;
  title: string;
  subtitle?: string;
  colors?: string[];
}
```

#### `MapObjectType`
```typescript
enum MapObjectType {
  HORNET = 'hornet',
  APIARY = 'apiary', 
  NEST = 'nest'
}
```

## Configuration

### Constantes ajustables

- `OVERLAP_THRESHOLD_PIXELS = 50` : Distance en pixels pour considérer un chevauchement
- `MIN_ZOOM_TO_SEPARATE = 18` : Zoom minimum pour tenter de séparer les objets

## Intégration

Le système est automatiquement intégré dans `InteractiveMap.tsx` et remplace les gestionnaires de clic existants par des versions intelligentes qui :

1. Vérifient s'il y a chevauchement au point cliqué
2. Zooment automatiquement si possible
3. Affichent le dialogue de sélection sinon
4. Ouvrent directement l'objet s'il n'y a pas de chevauchement

## Utilisation

Le système fonctionne de manière transparente pour l'utilisateur :

1. **Clic normal** : Si un seul objet est présent, s'ouvre normalement
2. **Zoom automatique** : Si plusieurs objets se chevauchent mais peuvent être séparés en zoomant, zoom automatique
3. **Dialogue de sélection** : Si les objets ne peuvent pas être séparés, affiche la liste pour sélection manuelle

## Améliorations futures possibles

1. Réglage dynamique du seuil de chevauchement selon le niveau de zoom
2. Indicateur visuel sur la carte pour montrer qu'il y a plusieurs objets
3. Groupement automatique d'objets très proches
4. Prévisualisation des objets au survol dans le dialogue
