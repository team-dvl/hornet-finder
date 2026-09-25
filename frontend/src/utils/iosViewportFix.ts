// Correction pour le problème de zoom automatique sur iOS lors du changement d'orientation

export function initIOSViewportFix() {
  // Vérifier si on est sur iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!isIOS) return;

  const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!viewportMeta) return;
  // Keep the attributes of index.html (safe areas, keyboard behaviour): only
  // a temporary maximum-scale is added, then the original content is restored
  const original = viewportMeta.content;

  // Only on rotation: a resize also fires when the keyboard opens, and pinning
  // the scale then would block the user's own zoom
  window.addEventListener('orientationchange', () => {
    // Attendre que l'orientation change complètement
    setTimeout(() => {
      viewportMeta.content = `${original}, maximum-scale=1.0`;
      // Timeout court pour permettre au navigateur de s'ajuster
      setTimeout(() => {
        viewportMeta.content = original;
      }, 100);
    }, 500);
  });
}
