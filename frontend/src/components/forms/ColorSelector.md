# ColorSelector Component

Le composant `ColorSelector` est un composant unifié pour l'affichage et la sélection des couleurs de marquage dans l'application Hornet Finder.

## Fonctionnalités

- **Mode read-only** : Affiche un badge coloré avec le texte approprié (calculé automatiquement pour la lisibilité)
- **Mode read-write** : Affiche un dropdown pour sélectionner une couleur
- **Gestion automatique du contraste** : Le texte est automatiquement blanc ou noir selon la couleur d'arrière-plan
- **Tailles multiples** : `sm`, `md` (défaut), `lg`
- **Support des couleurs vides** : Gère correctement les valeurs vides ou null

## Utilisation

### Mode read-only (Badge)

```tsx
import { ColorSelector } from '../components/forms';

// Affichage simple d'une couleur
<ColorSelector value="red" readOnly />

// Avec taille personnalisée
<ColorSelector value="blue" readOnly size="sm" />

// Ne s'affiche pas si pas de couleur
<ColorSelector value="" readOnly /> // Ne rend rien
```

### Mode read-write (Dropdown)

```tsx
import { ColorSelector } from '../components/forms';

const [selectedColor, setSelectedColor] = useState('');

// Sélecteur de couleur complet
<ColorSelector
  value={selectedColor}
  onChange={setSelectedColor}
  label="Couleur de marquage"
  size="sm"
/>

// Sélecteur désactivé
<ColorSelector
  value={selectedColor}
  onChange={setSelectedColor}
  label="Couleur"
  disabled
/>
```

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `value` | `string \| undefined` | `''` | Valeur actuelle de la couleur |
| `onChange` | `(value: string) => void` | - | Fonction appelée lors du changement (mode read-write) |
| `readOnly` | `boolean` | `false` | Si true, affiche un badge au lieu d'un dropdown |
| `disabled` | `boolean` | `false` | Si true, désactive le composant |
| `label` | `string` | - | Label affiché au-dessus (mode read-write uniquement) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille du composant |
| `className` | `string` | `''` | Classes CSS supplémentaires |
| `style` | `React.CSSProperties` | `{}` | Styles inline supplémentaires |

## Couleurs supportées

Le composant supporte toutes les couleurs définies dans `COLOR_OPTIONS` :

- `''` - Aucune couleur (transparent)
- `'red'` - Rouge
- `'blue'` - Bleu
- `'yellow'` - Jaune
- `'green'` - Vert
- `'orange'` - Orange
- `'purple'` - Violet
- `'pink'` - Rose
- `'brown'` - Marron
- `'white'` - Blanc
- `'black'` - Noir
- `'gray'` - Gris
- `'cyan'` - Cyan
- `'magenta'` - Magenta
- `'lime'` - Vert citron

## Calcul automatique du contraste

Le composant utilise l'algorithme WCAG pour calculer automatiquement la couleur de texte optimale (blanc ou noir) selon la couleur d'arrière-plan, garantissant une lisibilité maximale.

## Exemples d'utilisation dans l'application

### Formulaire d'ajout de frelon

```tsx
<Row className="mb-3">
  <Col md={6}>
    <ColorSelector
      value={markColor1}
      onChange={setMarkColor1}
      label="Couleur de marquage 1 (facultatif)"
      size="sm"
    />
  </Col>
  <Col md={6}>
    <ColorSelector
      value={markColor2}
      onChange={setMarkColor2}
      label="Couleur de marquage 2 (facultatif)"
      size="sm"
    />
  </Col>
</Row>
```

### Affichage des informations d'un frelon

```tsx
<div className="d-flex gap-2 align-items-center">
  <ColorSelector value={hornet.mark_color_1} readOnly size="sm" />
  <ColorSelector value={hornet.mark_color_2} readOnly size="sm" />
  
  {!hornet.mark_color_1 && !hornet.mark_color_2 && (
    <span className="text-muted">Aucun marquage</span>
  )}
</div>
```

## Migration depuis les anciens composants

Ce composant remplace les anciens `ColorDropdown` qui étaient dupliqués dans plusieurs fichiers. Tous les anciens usages ont été mis à jour pour utiliser le nouveau composant unifié.

## Cohérence avec le backend

Les couleurs sont parfaitement synchronisées avec le modèle Django `Hornet.COLOR_CHOICES`, garantissant une cohérence complète entre le frontend et le backend.
