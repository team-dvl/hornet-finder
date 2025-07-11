// Utilitaire pour nettoyer les paramètres OAuth2/OIDC de l'URL après authentification
import { useEffect } from 'react';

export interface UrlCleanerOptions {
  preserveParams?: string[]; // Paramètres à conserver
  delayMs?: number; // Délai avant nettoyage
}

const OAUTH_PARAMS = [
  'code',
  'state', 
  'session_state',
  'iss',
  'id_token',
  'access_token',
  'token_type',
  'expires_in',
  'scope',
  'error',
  'error_description',
  'error_uri'
];

export function cleanOAuthParamsFromUrl(options: UrlCleanerOptions = {}): void {
  const { preserveParams = [], delayMs = 0 } = options;
  
  const cleanUrl = () => {
    try {
      const url = new URL(window.location.href);
      const urlParams = new URLSearchParams(url.search);
      let hasOAuthParams = false;

      // Vérifier si des paramètres OAuth sont présents
      OAUTH_PARAMS.forEach(param => {
        if (urlParams.has(param) && !preserveParams.includes(param)) {
          urlParams.delete(param);
          hasOAuthParams = true;
        }
      });

      // Ne modifier l'URL que si des paramètres OAuth étaient présents
      if (hasOAuthParams) {
        const newSearch = urlParams.toString();
        const newUrl = newSearch 
          ? `${url.pathname}?${newSearch}${url.hash}`
          : `${url.pathname}${url.hash}`;
        
        // Utiliser replaceState pour ne pas affecter l'historique
        window.history.replaceState({}, document.title, newUrl);
        
        console.log('🔧 URL nettoyée - paramètres OAuth supprimés');
      }
    } catch (error) {
      console.warn('Erreur lors du nettoyage de l\'URL:', error);
    }
  };

  if (delayMs > 0) {
    setTimeout(cleanUrl, delayMs);
  } else {
    cleanUrl();
  }
}

export function hasOAuthParamsInUrl(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return OAUTH_PARAMS.some(param => urlParams.has(param));
}

// Hook React pour nettoyer automatiquement l'URL
export function useUrlCleaner(isAuthenticated: boolean): void {
  useEffect(() => {
    if (isAuthenticated && hasOAuthParamsInUrl()) {
      // Nettoyer immédiatement
      cleanOAuthParamsFromUrl({ delayMs: 0 });
      
      // Nettoyer aussi après un délai de sécurité
      cleanOAuthParamsFromUrl({ delayMs: 1000 });
    }
  }, [isAuthenticated]);
}
