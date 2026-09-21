# Structure des composants Frontend

Cette documentation décrit l'organisation des composants React dans le projet Hornet Finder.

## Structure des dossiers

```
src/
├── components/
│   ├── forms/           # Composants de formulaires et sélecteurs
│   │   ├── AddItemSelector.tsx
│   │   └── index.ts
│   ├── home/            # Page de garde
│   │   ├── ModuleCard.tsx
│   │   └── index.ts
│   ├── layout/          # Composants de mise en page
│   │   ├── NavbarComponent.tsx
│   │   ├── PageLayout.tsx
│   │   └── index.ts
│   ├── map/             # Composants liés à la cartographie
│   │   ├── CompassCapture.tsx
│   │   ├── CompassMap.tsx
│   │   ├── HornetReturnZone.tsx
│   │   ├── InteractiveMap.tsx
│   │   └── index.ts
│   ├── map-controls/    # Contrôles de la carte
│   │   ├── LayerControlsButton.tsx
│   │   ├── LocateButton.tsx
│   │   ├── MapControlsContainer.tsx
│   │   ├── MapFeedback.tsx
│   │   ├── QuickCaptureButton.tsx
│   │   └── index.ts
│   ├── markers/         # Marqueurs de carte
│   │   ├── ApiaryMarker.tsx
│   │   ├── NestMarker.tsx
│   │   └── index.ts
│   ├── modals/          # Fenêtres modales
│   │   ├── UserInfoModal.tsx
│   │   └── index.ts
│   ├── popups/          # Popups d'informations et formulaires
│   │   ├── AddApiaryPopup.tsx
│   │   ├── AddHornetPopup.tsx
│   │   ├── AddNestPopup.tsx
│   │   ├── ApiaryInfoPopup.tsx
│   │   ├── HornetInfoPopup.tsx
│   │   ├── HornetReturnZoneInfoPopup.tsx
│   │   ├── NestInfoPopup.tsx
│   │   └── index.ts
│   └── index.ts         # Exports centralisés
├── hooks/               # Hooks personnalisés
├── store/               # État global Redux
├── utils/               # Utilitaires
├── App.tsx              # Composant principal
└── main.tsx             # Point d'entrée
```

## Description des dossiers

### `/components/forms/`
Contient les composants de formulaires et sélecteurs d'éléments :
- `AddItemSelector.tsx` : Sélecteur pour choisir le type d'élément à ajouter

### `/components/home/`
Composants de la page de garde (`pages/Home.tsx`) :
- `ModuleCard.tsx` : Tuile du menu des modules (définis dans `config/modules.ts`)

Les pages de documentation vivent dans `pages/docs/` : une page par module, enregistrée dans `pages/docs/registry.ts` (`DOC_PAGES`). Un module sans entrée affiche « Documentation à venir ».

### `/components/layout/`
Composants de mise en page de l'application :
- `NavbarComponent.tsx` : Barre de navigation principale (partagée par toutes les pages), avec fil d'Ariane dérivé de la route (`utils/breadcrumbs.ts`)
- `PageLayout.tsx` : Navbar + zone de contenu pour les pages qui défilent (accueil, pièges)

### `/components/map/`
Composants liés aux fonctionnalités de cartographie :
- `InteractiveMap.tsx` : Carte interactive principale
- `CompassMap.tsx` : Carte avec fonctionnalités de boussole
- `CompassCapture.tsx` : Capture de direction à la boussole
- `HornetReturnZone.tsx` : Zone de retour des frelons

### `/components/markers/`
Marqueurs affichés sur la carte :
- `ApiaryMarker.tsx` : Marqueur pour les ruchers
- `NestMarker.tsx` : Marqueur pour les nids

### `/components/modals/`
Fenêtres modales de l'application :
- `UserInfoModal.tsx` : Modal d'informations utilisateur

### `/components/popups/`
Popups d'informations et formulaires de création/édition :
- `AddApiaryPopup.tsx` : Formulaire d'ajout de rucher
- `AddHornetPopup.tsx` : Formulaire d'ajout de frelon
- `AddNestPopup.tsx` : Formulaire d'ajout de nid
- `ApiaryInfoPopup.tsx` : Informations sur un rucher
- `HornetInfoPopup.tsx` : Informations sur un frelon
- `NestInfoPopup.tsx` : Informations sur un nid
- `HornetReturnZoneInfoPopup.tsx` : Informations sur la zone de retour

### `/components/map-controls/`
Contrôles et boutons de la carte :
- `LayerControlsButton.tsx` : Contrôle des couches
- `LocateButton.tsx` : Bouton de géolocalisation
- `MapControlsContainer.tsx` : Conteneur des contrôles
- `MapFeedback.tsx` : Retours de la carte
- `QuickCaptureButton.tsx` : Bouton de capture rapide

## Imports

Chaque dossier contient un fichier `index.ts` qui exporte tous les composants du dossier. 
Le fichier `/components/index.ts` centralise tous les exports.

### Exemples d'utilisation

```typescript
// Import spécifique
import { InteractiveMap } from './components/map';
import { NavbarComponent } from './components/layout';

// Import groupé  
import { UserInfoModal, ConfirmationModal } from './components/modals';

// Import depuis l'index principal
import { 
  InteractiveMap, 
  NavbarComponent, 
  ModuleCard 
} from './components';
```

## Avantages de cette organisation

1. **Séparation des responsabilités** : Chaque dossier a une responsabilité claire
2. **Facilité de navigation** : Structure logique et intuitive
3. **Maintenabilité** : Plus facile de trouver et modifier des composants
4. **Réutilisabilité** : Composants bien organisés et facilement réutilisables
5. **Scalabilité** : Structure qui peut grandir avec le projet

## Migration

Tous les imports ont été mis à jour pour refléter la nouvelle structure. Les fonctionnalités restent identiques.
