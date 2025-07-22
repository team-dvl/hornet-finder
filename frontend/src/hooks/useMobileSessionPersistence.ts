import { useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';

/**
 * Hook personnalisé pour gérer la persistance de session sur mobile
 * Gère les problèmes liés au verrouillage d'écran et à la mise en veille
 */
export const useMobileSessionPersistence = () => {
  const auth = useAuth();

  // Sauvegarde l'état d'authentification dans localStorage
  const saveAuthState = useCallback(() => {
    if (auth.isAuthenticated && auth.user) {
      const authData = {
        timestamp: Date.now(),
        isAuthenticated: true,
        userProfile: auth.user.profile,
        // Sauvegarde sécurisée des tokens (chiffrés si nécessaire)
        hasValidSession: true
      };
      
      localStorage.setItem('hornet-auth-state', JSON.stringify(authData));
    }
  }, [auth.isAuthenticated, auth.user]);

  // Restaure l'état d'authentification depuis localStorage
  const restoreAuthState = useCallback(() => {
    try {
      const savedState = localStorage.getItem('hornet-auth-state');
      if (savedState) {
        const authData = JSON.parse(savedState);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures
        
        // Vérifier si les données sauvées ne sont pas trop anciennes
        if (authData.timestamp && (now - authData.timestamp) < maxAge) {
          return authData;
        } else {
          // Nettoyer les données expirées
          localStorage.removeItem('hornet-auth-state');
        }
      }
    } catch (error) {
      console.warn('Erreur lors de la restauration de l\'état d\'authentification:', error);
      localStorage.removeItem('hornet-auth-state');
    }
    return null;
  }, []);

  // Nettoie l'état sauvegardé lors de la déconnexion
  const clearAuthState = useCallback(() => {
    localStorage.removeItem('hornet-auth-state');
  }, []);

  // Gestion des événements de cycle de vie de l'application
  useEffect(() => {
    // Sauvegarder l'état quand l'utilisateur est authentifié
    if (auth.isAuthenticated) {
      saveAuthState();
    }

    // Gestionnaire pour la visibilité de la page (changement d'onglet, verrouillage écran)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page cachée - sauvegarder l'état
        saveAuthState();
      } else {
        // Page visible - vérifier si la session est toujours valide
        if (!auth.isAuthenticated && !auth.isLoading) {
          const savedState = restoreAuthState();
          if (savedState && savedState.hasValidSession) {
            // Tentative de renouvellement silencieux
            auth.signinSilent().catch((error) => {
              console.warn('Échec du renouvellement silencieux:', error);
            });
          }
        }
      }
    };

    // Gestionnaire pour la pause/reprise de l'application (mobile)
    const handleAppStateChange = () => {
      saveAuthState();
    };

    // Gestionnaire avant fermeture/rechargement de page
    const handleBeforeUnload = () => {
      saveAuthState();
    };

    // Ajouter les écouteurs d'événements
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleAppStateChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Nettoyer lors du unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleAppStateChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [auth.isAuthenticated, auth.isLoading, saveAuthState, restoreAuthState, auth]);

  // Nettoyer l'état lors de la déconnexion
  useEffect(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      clearAuthState();
    }
  }, [auth.isAuthenticated, auth.isLoading, clearAuthState]);

  // Fonction utilitaire pour vérifier si une session peut être restaurée
  const canRestoreSession = useCallback(() => {
    const savedState = restoreAuthState();
    return savedState && savedState.hasValidSession;
  }, [restoreAuthState]);

  return {
    saveAuthState,
    restoreAuthState,
    clearAuthState,
    canRestoreSession
  };
};
