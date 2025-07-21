import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useCallback } from 'react';
import { Hornet } from '../store/store';
import { Nest } from '../store/slices/nestsSlice';
import { Apiary } from '../store/slices/apiariesSlice';

// Interface pour les claims JWT
interface JWTClaims {
  exp: number;
  realm_access?: {
    roles: string[];
  };
  name?: string;
  preferred_username?: string;
  email?: string;
  sub?: string;
}

// Hook personnalisé pour vérifier les permissions utilisateur
export const useUserPermissions = () => {
  const auth = useAuth();

  const profile = auth.user?.profile;
  const accessToken = auth.user?.access_token;
  
  const decodedToken = useMemo(() => {
    if (!accessToken) return null;
    try {
      return jwtDecode<JWTClaims>(accessToken);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }, [accessToken]);
  
  const realmRoles = useMemo(() => decodedToken?.realm_access?.roles || [], [decodedToken]);
  const roles = useMemo(() => 
    realmRoles.filter((role: string) => 
      role === 'volunteer' || 
      role === 'beekeeper' || 
      role === 'admin'
    ) as string[],
    [realmRoles]
  );

  const isAdmin = useMemo(() => roles.includes('admin'), [roles]);
  const userEmail = profile?.email;

  // Fonction pour vérifier si l'utilisateur peut éditer un frelon
  const canEditHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userEmail || !auth.user) return false;
    
    // Admin peut toujours éditer
    if (isAdmin) return true;
    
    // Propriétaire peut éditer ses propres frelons
    // On suppose que created_by contient l'email de l'utilisateur
    return hornet.created_by === userEmail;
  }, [isAdmin, userEmail, auth.user]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un frelon
  const canDeleteHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userEmail || !auth.user) return false;
    
    // Admin peut toujours supprimer
    if (isAdmin) return true;
    
    // Propriétaire peut supprimer ses propres frelons
    return hornet.created_by === userEmail;
  }, [isAdmin, userEmail, auth.user]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un nid
  const canDeleteNest = useCallback((nest: Nest) => {
    if (!nest || !userEmail || !auth.user) return false;
    
    // Admin peut toujours supprimer
    if (isAdmin) return true;
    
    // Propriétaire peut supprimer ses propres nids
    return nest.created_by === userEmail;
  }, [isAdmin, userEmail, auth.user]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un rucher
  const canDeleteApiary = useCallback((apiary: Apiary) => {
    if (!apiary || !userEmail || !auth.user) return false;
    
    // Admin peut toujours supprimer
    if (isAdmin) return true;
    
    // Propriétaire peut supprimer ses propres ruchers
    return apiary.created_by === userEmail;
  }, [isAdmin, userEmail, auth.user]);

  // Mémoriser si l'utilisateur peut ajouter des frelons
  const canAddHornet = useMemo(() => {
    if (!auth.user) return false;
    // Seuls les utilisateurs avec les rôles volunteer, beekeeper ou admin peuvent ajouter des frelons
    return roles.includes('volunteer') || roles.includes('beekeeper') || roles.includes('admin');
  }, [roles, auth.user]);

  // Mémoriser si l'utilisateur peut ajouter des ruchers
  const canAddApiary = useMemo(() => {
    if (!auth.user) return false;
    // Seuls les apiculteurs peuvent ajouter des ruchers
    return roles.includes('beekeeper');
  }, [roles, auth.user]);

  if (!auth.user) {
    return {
      isAuthenticated: false,
      userEmail: null,
      roles: [],
      isAdmin: false,
      canEditHornet: () => false,
      canDeleteHornet: () => false,
      canDeleteNest: () => false,
      canDeleteApiary: () => false,
      canAddHornet: false,
      canAddApiary: false,
    };
  }

  return {
    isAuthenticated: true,
    userEmail,
    roles,
    isAdmin,
    canEditHornet,
    canDeleteHornet,
    canDeleteNest,
    canDeleteApiary,
    canAddHornet,
    canAddApiary,
    accessToken,
  };
};
