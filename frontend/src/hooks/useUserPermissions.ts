import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { Hornet } from '../store/store';

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

  if (!auth.user) {
    return {
      isAuthenticated: false,
      userEmail: null,
      roles: [],
      isAdmin: false,
      canEditHornet: () => false,
      canAddHornet: () => false,
    };
  }

  const profile = auth.user.profile;
  const accessToken = auth.user.access_token;
  let decodedToken: JWTClaims | null = null;
  
  try {
    decodedToken = accessToken ? jwtDecode<JWTClaims>(accessToken) : null;
  } catch (error) {
    console.error('Error decoding JWT:', error);
  }
  
  const realmRoles = decodedToken?.realm_access?.roles || [];
  const roles = realmRoles.filter((role: string) => 
    role === 'volunteer' || 
    role === 'beekeeper' || 
    role === 'admin'
  );

  const isAdmin = roles.includes('admin');
  const userEmail = profile.email;

  // Fonction pour vérifier si l'utilisateur peut éditer un frelon
  const canEditHornet = (hornet: Hornet) => {
    if (!hornet || !userEmail) return false;
    
    // Admin peut toujours éditer
    if (isAdmin) return true;
    
    // Propriétaire peut éditer ses propres frelons
    // On suppose que created_by contient l'email de l'utilisateur
    return hornet.created_by === userEmail;
  };

  // Fonction pour vérifier si l'utilisateur peut ajouter des frelons
  const canAddHornet = () => {
    // Seuls les utilisateurs avec les rôles volunteer, beekeeper ou admin peuvent ajouter des frelons
    return roles.includes('volunteer') || roles.includes('beekeeper') || roles.includes('admin');
  };

  return {
    isAuthenticated: true,
    userEmail,
    roles,
    isAdmin,
    canEditHornet,
    canAddHornet,
    accessToken,
  };
};
