// Utilitaires pour améliorer l'expérience PWA avec l'authentification

// Extension de Navigator pour Safari iOS
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

export interface PWAAuthState {
  hasStaleParams: boolean;
  isPWA: boolean;
  needsRefresh: boolean;
}

export function detectPWAAuthState(): PWAAuthState {
  // Détecter si l'app est lancée en mode PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as NavigatorStandalone).standalone === true ||
                document.referrer.includes('android-app://');

  // Détecter les paramètres OAuth périmés
  const urlParams = new URLSearchParams(window.location.search);
  const hasStaleParams = urlParams.has('code') || urlParams.has('state');

  // Déterminer si un refresh est nécessaire
  const needsRefresh = isPWA && hasStaleParams;

  return {
    hasStaleParams,
    isPWA,
    needsRefresh
  };
}

export function handlePWAAuthError(): void {
  const state = detectPWAAuthState();
  
  if (state.needsRefresh) {
    console.log('🔄 PWA: Nettoyage des paramètres d\'authentification périmés');
    
    // Nettoyer l'URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Nettoyer le localStorage si nécessaire
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('oidc') || key.includes('auth') || key.includes('token')
    );
    
    authKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value && value.includes('expired')) {
          localStorage.removeItem(key);
          console.log(`🗑️ Suppression de la clé expirée: ${key}`);
        }
      } catch (error) {
        console.warn(`Erreur lors du nettoyage de ${key}:`, error);
      }
    });
  }
}

export function setupPWAAuthMonitoring(): void {
  // Surveiller les changements de mode d'affichage (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'AUTH_ERROR') {
        console.log('🔧 Service Worker signale une erreur d\'authentification');
        handlePWAAuthError();
      }
    });
  }

  // Surveiller les erreurs de réseau qui pourraient affecter l'auth
  window.addEventListener('online', () => {
    console.log('🌐 Connexion restaurée - vérification de l\'état d\'authentification');
    // Délai pour laisser le temps à l'authentification de se rétablir
    setTimeout(() => {
      const state = detectPWAAuthState();
      if (state.hasStaleParams) {
        handlePWAAuthError();
      }
    }, 1000);
  });

  // Surveiller les changements de visibilité de la page
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // La page redevient visible, vérifier l'état
      const state = detectPWAAuthState();
      if (state.needsRefresh) {
        console.log('👁️ Page visible avec paramètres périmés - nettoyage');
        handlePWAAuthError();
      }
    }
  });
}

export function createPWAFriendlyRedirectUri(): string {
  // Pour PWA, utiliser une URL plus stable
  const baseUrl = window.location.origin;
  const path = window.location.pathname;
  
  // Si on est dans une PWA, utiliser l'URL de base
  const state = detectPWAAuthState();
  if (state.isPWA) {
    return baseUrl;
  }
  
  // Sinon, utiliser l'URL complète
  return `${baseUrl}${path}`;
}
