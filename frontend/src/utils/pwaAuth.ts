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

// Variables globales pour éviter les renouvellements multiples
let isRenewing = false;
let lastRenewalTime = 0;
const RENEWAL_COOLDOWN = 30 * 1000; // 30 secondes entre renouvellements

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
      } else if (event.data && event.data.type === 'TOKEN_EXPIRING') {
        console.log('⏰ Service Worker signale que le token va expirer');
        // Déclencher un renouvellement proactif
        window.dispatchEvent(new CustomEvent('token-expiring', { 
          detail: event.data.payload 
        }));
      } else if (event.data && event.data.type === 'TOKEN_RENEWED') {
        console.log('✅ Service Worker confirme le renouvellement du token');
      }
    });

    // Envoyer l'état d'authentification au service worker
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage({
          type: 'AUTH_STATUS_UPDATE',
          payload: {
            isAuthenticated: !!localStorage.getItem('oidc.user:https://auth.velutina.ovh/realms/hornet-finder:hornet-app'),
            timestamp: Date.now()
          }
        });
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

// Nouvelle fonction pour surveiller les tokens en arrière-plan
export function setupTokenMonitoring(): void {
  // Vérifier périodiquement l'état des tokens
  const checkTokens = () => {
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('oidc.user:') || key.includes('token')
    );

    authKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const data = JSON.parse(value);
          
          // Vérifier si le token va expirer dans les 90 secondes (1.5 minutes)
          if (data.expires_at) {
            const expiresAt = new Date(data.expires_at * 1000);
            const now = new Date();
            const timeUntilExpiry = expiresAt.getTime() - now.getTime();
            const warningThreshold = 90 * 1000; // 90 secondes

            if (timeUntilExpiry > 0 && timeUntilExpiry < warningThreshold) {
              // Vérifier si un renouvellement n'est pas déjà en cours
              const now = Date.now();
              if (isRenewing || (now - lastRenewalTime) < RENEWAL_COOLDOWN) {
                return; // Éviter les renouvellements multiples
              }

              isRenewing = true;
              lastRenewalTime = now;
              
              console.log('⚠️ Token expire bientôt, notification au service worker');
              
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                  if (registration.active) {
                    registration.active.postMessage({
                      type: 'TOKEN_EXPIRING_SOON',
                      payload: {
                        key,
                        expiresAt: data.expires_at,
                        timeUntilExpiry
                      }
                    });
                  }
                });
              }

              // Réinitialiser le flag après un délai
              setTimeout(() => {
                isRenewing = false;
              }, 5000); // 5 secondes
            }
          }
        }
      } catch (error) {
        console.warn(`Erreur lors de la vérification du token ${key}:`, error);
      }
    });
  };

  // Vérifier toutes les 2 minutes
  const intervalId = setInterval(checkTokens, 2 * 60 * 1000);
  
  // Vérification immédiate
  checkTokens();

  // Nettoyer l'intervalle si la page se ferme
  window.addEventListener('beforeunload', () => {
    clearInterval(intervalId);
  });

  // Écouter les événements personnalisés de renouvellement
  window.addEventListener('token-expiring', () => {
    console.log('🔄 Déclenchement du renouvellement proactif de token');
    // Ici on pourrait déclencher une action spécifique de renouvellement
    // Pour l'instant, on fait confiance au système OIDC automatique
  });
}

// Fonction pour synchroniser l'état avec le service worker
export function syncAuthStateWithServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        // Récupérer l'état actuel d'authentification
        const authData = localStorage.getItem('oidc.user:https://auth.velutina.ovh/realms/hornet-finder:hornet-app') ||
                        localStorage.getItem('oidc.user:https://auth.velutina.ovh/realms/hornet-finder:hornet-app-dev');
        
        let authState = null;
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            authState = {
              isAuthenticated: true,
              expiresAt: parsed.expires_at,
              profile: parsed.profile || {}
            };
          } catch (error) {
            console.warn('Erreur lors du parsing des données auth:', error);
          }
        }

        registration.active.postMessage({
          type: 'SYNC_AUTH_STATE',
          payload: {
            authState,
            timestamp: Date.now(),
            origin: window.location.origin
          }
        });
      }
    });
  }
}
