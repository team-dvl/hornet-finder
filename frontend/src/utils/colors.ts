// Constantes pour les couleurs de marquage
export const COLOR_OPTIONS = [
  { value: '', label: 'Aucune couleur', color: 'transparent' },
  { value: 'white', label: 'Blanc', color: '#ffffff' },
  { value: 'blue', label: 'Bleu', color: '#0000ff' },
  { value: 'cyan', label: 'Cyan', color: '#00ffff' },
  { value: 'gray', label: 'Gris', color: '#808080' },
  { value: 'yellow', label: 'Jaune', color: '#ffff00' },
  { value: 'magenta', label: 'Magenta', color: '#ff00ff' },
  { value: 'brown', label: 'Marron', color: '#a52a2a' },
  { value: 'black', label: 'Noir', color: '#000000' },
  { value: 'orange', label: 'Orange', color: '#ffa500' },
  { value: 'pink', label: 'Rose', color: '#ffc0cb' },
  { value: 'red', label: 'Rouge', color: '#ff0000' },
  { value: 'green', label: 'Vert', color: '#008000' },
  { value: 'lime', label: 'Vert citron', color: '#00ff00' },
  { value: 'purple', label: 'Violet', color: '#800080' },
] as const;

// Fonction pour obtenir le nom d'affichage d'une couleur
export const getColorLabel = (colorValue: string): string => {
  const color = COLOR_OPTIONS.find(c => c.value === colorValue);
  return color ? color.label : 'Couleur inconnue';
};

// Fonction pour obtenir la couleur hex d'une couleur
export const getColorHex = (colorValue: string): string => {
  const color = COLOR_OPTIONS.find(c => c.value === colorValue);
  return color ? color.color : '#000000';
};
