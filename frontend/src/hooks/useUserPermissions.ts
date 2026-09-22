import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useCallback } from 'react';
import { Hornet } from '../store/store';
import { Nest } from '../store/slices/nestsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Trap } from '../store/slices/trapsSlice';

// Interface pour les claims JWT
interface JWTClaims {
  exp: number;
  realm_access?: {
    roles: string[];
  };
  /** Full Keycloak group paths, from the `membership` client scope */
  membership?: string[];
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
  const userGuid = profile?.sub;

  // Fonction utilitaire pour comparer created_by (objet)
  function isOwner(created_by: { guid: string; display_name: string }): boolean {
    if (!created_by || !userGuid) return false;
    return created_by.guid === userGuid;
  }

  // Fonction pour vérifier si l'utilisateur peut éditer un frelon
  const canEditHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userGuid || !auth.user) return false;
    if (isAdmin) return true;
    if (!hornet.created_by) return false;
    return isOwner(hornet.created_by);
  }, [isAdmin, userGuid, auth.user]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un frelon
  const canDeleteHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userGuid || !auth.user) return false;
    if (isAdmin) return true;
    if (!hornet.created_by) return false;
    return isOwner(hornet.created_by);
  }, [isAdmin, userGuid, auth.user]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un nid
  const canDeleteNest = useCallback((nest: Nest) => {
    if (!nest || !userGuid || !auth.user) return false;
    if (isAdmin) return true;
    if (!nest.created_by) return false;
    return isOwner(nest.created_by);
  }, [isAdmin, userGuid, auth.user]);

  // Seuls les admins peuvent archiver (contrairement à la suppression, pas d'exception pour le créateur)
  const canArchiveHornet = useCallback(() => isAdmin, [isAdmin]);
  const canArchiveNest = useCallback(() => isAdmin, [isAdmin]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un rucher
  const canDeleteApiary = useCallback((apiary: Apiary) => {
    if (!apiary || !userGuid || !auth.user) return false;
    if (isAdmin) return true;
    if (!apiary.created_by) return false;
    return isOwner(apiary.created_by);
  }, [isAdmin, userGuid, auth.user]);

  // Mémoriser si l'utilisateur peut ajouter des frelons
  const canAddHornet = useMemo(() => {
    if (!auth.user) return false;
    // Seuls les utilisateurs avec les rôles volunteer, beekeeper ou admin peuvent ajouter des frelons
    return roles.includes('volunteer') || roles.includes('beekeeper') || roles.includes('admin');
  }, [roles, auth.user]);

  // Chemins complets des groupes Keycloak de l'utilisateur (claim `membership`)
  const groups = useMemo(() => decodedToken?.membership || [], [decodedToken]);

  // Groupes administrés, déduits des appartenances `<groupe>/admin`.
  // Même convention que le backend (hornet/trap_permissions.py).
  const administeredGroups = useMemo(() => {
    const administered = new Set<string>();
    groups.forEach((path: string) => {
      const segments = path.split('/');
      const index = segments.indexOf('admin', 1);
      if (index > 0) {
        administered.add(segments.slice(0, index).join('/'));
      }
    });
    return Array.from(administered);
  }, [groups]);

  // Appartenance par préfixe : Keycloak ne liste que les groupes directs, donc
  // un membre de `/beekeepers/ena/admin` appartient aussi à `/beekeepers/ena`.
  const isMemberOfGroup = useCallback((groupPath?: string | null) => {
    if (!groupPath) return false;
    return groups.some((path: string) => path === groupPath || path.startsWith(`${groupPath}/`));
  }, [groups]);

  // Seuls les volontaires et apiculteurs possèdent des pièges : l'administrateur
  // administre, il ne fait pas de terrain.
  const canAddTrap = useMemo(
    () => Boolean(auth.user) && (roles.includes('volunteer') || roles.includes('beekeeper')),
    [roles, auth.user]
  );

  const isTrapOwner = useCallback(
    (trap: Trap) => Boolean(trap?.owner && userGuid && trap.owner.guid === userGuid),
    [userGuid]
  );

  // Modifier, déplacer ou supprimer un piège : propriétaire ou administrateur
  const canEditTrap = useCallback((trap: Trap) => {
    if (!trap || !auth.user) return false;
    return isAdmin || isTrapOwner(trap);
  }, [isAdmin, isTrapOwner, auth.user]);

  // Enregistrer une prise ou une action : propriétaire ou groupe délégataire
  const canActOnTrap = useCallback((trap: Trap) => {
    if (!trap || !auth.user) return false;
    return isTrapOwner(trap) || isMemberOfGroup(trap.group?.path);
  }, [isTrapOwner, isMemberOfGroup, auth.user]);

  // Désigner ou retirer le groupe délégataire. La liste exacte des groupes
  // autorisés est calculée par le backend (GET /traps/{id}/delegation/).
  const canSetTrapDelegation = useCallback((trap: Trap) => {
    if (!trap || !auth.user) return false;
    if (isAdmin || isTrapOwner(trap)) return true;
    return administeredGroups.length > 0;
  }, [isAdmin, isTrapOwner, administeredGroups, auth.user]);

  const canChangeTrapOwner = isAdmin;

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
      userGuid: undefined as string | undefined,
      roles: [] as string[],
      isAdmin: false,
      canEditHornet: () => false,
      canDeleteHornet: () => false,
      canDeleteNest: () => false,
      canDeleteApiary: () => false,
      canArchiveHornet: () => false,
      canArchiveNest: () => false,
      canAddHornet: false,
      canAddApiary: false,
      groups: [] as string[],
      administeredGroups: [] as string[],
      canAddTrap: false,
      canEditTrap: () => false,
      canActOnTrap: () => false,
      canSetTrapDelegation: () => false,
      canChangeTrapOwner: false,
    };
  }

  return {
    isAuthenticated: true,
    userEmail,
    userGuid,
    roles,
    isAdmin,
    canEditHornet,
    canDeleteHornet,
    canDeleteNest,
    canDeleteApiary,
    canArchiveHornet,
    canArchiveNest,
    canAddHornet,
    canAddApiary,
    groups,
    administeredGroups,
    canAddTrap,
    canEditTrap,
    canActOnTrap,
    canSetTrapDelegation,
    canChangeTrapOwner,
    accessToken,
  };
};
