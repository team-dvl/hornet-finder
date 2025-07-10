// Correction pour le problème de zoom automatique sur iOS lors du changement d'orientation

export function initIOSViewportFix() {
  // Vérifier si on est sur iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (!isIOS) return;

  // Fonction pour corriger le viewport
  const fixViewport = () => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      // Forcer la re-application du viewport
      viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0';
      
      // Timeout court pour permettre au navigateur de s'ajuster
      setTimeout(() => {
        viewportMeta.content = 'width=device-width, initial-scale=1.0';
      }, 100);
    }
  };

  // Écouter les changements d'orientation
  window.addEventListener('orientationchange', () => {
    // Attendre que l'orientation change complètement
    setTimeout(fixViewport, 500);
  });

  // Écouter les changements de taille de fenêtre (fallback)
  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(fixViewport, 300) as unknown as number;
  });
}
