/**
 * Utilitaires pour calculer la lisibilité du texte sur des arrière-plans colorés
 */

/**
 * Convertit une couleur hex en valeurs RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Enlever le # si présent
  hex = hex.replace('#', '');
  
  // Gérer les formats courts (ex: #fff)
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calcule la luminance relative d'une couleur selon WCAG
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const normalize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 
      ? normalized / 12.92 
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

/**
 * Calcule le ratio de contraste entre deux couleurs
 */
function getContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Détermine si utiliser du texte blanc ou noir sur un arrière-plan donné
 * @param backgroundColor Couleur d'arrière-plan en format hex (ex: '#ff0000')
 * @returns 'white' ou 'black' selon le meilleur contraste
 */
export function getBestTextColor(backgroundColor: string): 'white' | 'black' {
  // Cas spéciaux
  if (backgroundColor === 'transparent' || backgroundColor === '') {
    return 'black';
  }

  const rgb = hexToRgb(backgroundColor);
  if (!rgb) {
    return 'black'; // Fallback
  }

  const backgroundLuminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  
  // Luminance du blanc et du noir
  const whiteLuminance = 1;
  const blackLuminance = 0;
  
  // Calculer les ratios de contraste
  const whiteContrast = getContrastRatio(backgroundLuminance, whiteLuminance);
  const blackContrast = getContrastRatio(backgroundLuminance, blackLuminance);
  
  // Retourner la couleur avec le meilleur contraste
  return whiteContrast > blackContrast ? 'white' : 'black';
}

/**
 * Retourne la couleur CSS appropriée pour le texte
 */
export function getTextColorCSS(backgroundColor: string): string {
  return getBestTextColor(backgroundColor) === 'white' ? '#ffffff' : '#000000';
}
