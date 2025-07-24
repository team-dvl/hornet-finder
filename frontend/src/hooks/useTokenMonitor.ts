import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';

interface TokenInfo {
  exp: number;
  iat: number;
  timeUntilExpiry: number;
  isExpiringSoon: boolean;
}

/**
 * Hook pour surveiller l'état des tokens et le renouvellement automatique
 */
export const useTokenMonitor = () => {
  const auth = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [renewalAttempts, setRenewalAttempts] = useState(0);
  const [lastRenewalAttempt, setLastRenewalAttempt] = useState(0);

  useEffect(() => {
    if (!auth.user?.access_token) {
      setTokenInfo(null);
      return;
    }

    const updateTokenInfo = () => {
      try {
        const decoded = jwtDecode<{ exp: number; iat: number }>(auth.user!.access_token!);
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = decoded.exp - now;
        const isExpiringSoon = timeUntilExpiry < 90; // Moins de 90 secondes

        setTokenInfo({
          exp: decoded.exp,
          iat: decoded.iat,
          timeUntilExpiry,
          isExpiringSoon
        });

        // Log si le token expire bientôt
        if (isExpiringSoon && timeUntilExpiry > 0) {
          const now = Date.now();
          // Éviter de spammer les logs - seulement toutes les 30 secondes
          if (now - lastRenewalAttempt > 30000) {
            console.warn(`⚠️ Token expires in ${Math.floor(timeUntilExpiry / 60)} minutes`);
            setLastRenewalAttempt(now);
          }
        }
      } catch (error) {
        console.error('Erreur lors du décodage du token:', error);
        setTokenInfo(null);
      }
    };

    // Mise à jour initiale
    updateTokenInfo();

    // Mise à jour toutes les 30 secondes
    const interval = setInterval(updateTokenInfo, 30000);

    return () => clearInterval(interval);
  }, [auth.user, lastRenewalAttempt]);

  // Surveiller les tentatives de renouvellement
  useEffect(() => {
    const handleSilentRenewError = (error: Error) => {
      console.error('🔄 Erreur de renouvellement silencieux:', error);
      setRenewalAttempts(prev => prev + 1);
    };

    const handleUserLoaded = () => {
      console.log('✅ Token renouvelé avec succès');
      setRenewalAttempts(0);
    };

    // Écouter les événements de react-oidc-context
    if (auth.events) {
      auth.events.addSilentRenewError(handleSilentRenewError);
      auth.events.addUserLoaded(handleUserLoaded);
    }

    return () => {
      if (auth.events) {
        auth.events.removeSilentRenewError(handleSilentRenewError);
        auth.events.removeUserLoaded(handleUserLoaded);
      }
    };
  }, [auth.events]);

  const formatExpiryTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('fr-FR');
  };

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return 'Expiré';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  return {
    tokenInfo,
    renewalAttempts,
    formatExpiryTime,
    formatTimeLeft,
    isTokenValid: tokenInfo && tokenInfo.timeUntilExpiry > 0,
    willExpireSoon: tokenInfo?.isExpiringSoon || false
  };
};
