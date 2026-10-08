import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useCallback } from 'react';
import { Hornet } from '../store/store';
import { Trap } from '../store/slices/trapsSlice';
import { ADMIN, BEEKEEPER, HUNTER, TRAPPER, appRoles } from '../utils/roles';
import { TRAPPERS_ROOT, isBeekeeperGroup, memberGroups } from '../utils/groups';

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

  // `auth.user` survives an expired session (and this app persists it across
  // reloads), so the mere presence of a user object says nothing. The library
  // computes isAuthenticated as `!user.expired`: that is the signal to trust,
  // otherwise a stale token keeps granting its roles after the session ended.
  const isSignedIn = auth.isAuthenticated && Boolean(auth.user);

  const profile = auth.user?.profile;
  const accessToken = isSignedIn ? auth.user?.access_token : undefined;
  
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
  // Application roles only, legacy names mapped (see utils/roles.ts)
  const roles = useMemo(() => appRoles(realmRoles) as string[], [realmRoles]);

  const isAdmin = useMemo(() => roles.includes(ADMIN), [roles]);
  const userEmail = profile?.email;
  const userGuid = profile?.sub;

  // Fonction utilitaire pour comparer created_by (objet)
  function isOwner(created_by: { guid: string; display_name: string }): boolean {
    if (!created_by || !userGuid) return false;
    return created_by.guid === userGuid;
  }

  // Fonction pour vérifier si l'utilisateur peut éditer un frelon
  const canEditHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userGuid || !isSignedIn) return false;
    if (isAdmin) return true;
    if (!hornet.created_by) return false;
    return isOwner(hornet.created_by);
  }, [isAdmin, userGuid, isSignedIn]);

  // Fonction pour vérifier si l'utilisateur peut supprimer un frelon
  const canDeleteHornet = useCallback((hornet: Hornet) => {
    if (!hornet || !userGuid || !isSignedIn) return false;
    if (isAdmin) return true;
    if (!hornet.created_by) return false;
    return isOwner(hornet.created_by);
  }, [isAdmin, userGuid, isSignedIn]);

  // Les droits sur un nid (modifier, photos, supprimer) viennent du backend : `nest.permissions`

  // Seuls les admins peuvent archiver (contrairement à la suppression, pas d'exception pour le créateur)
  const canArchiveHornet = useCallback(() => isAdmin, [isAdmin]);
  const canArchiveNest = useCallback(() => isAdmin, [isAdmin]);

  // Observations et lâchers de frelons : chasseurs de nids, apiculteurs (au rucher), admins
  const canAddHornet = useMemo(
    () => isSignedIn && [HUNTER, BEEKEEPER, ADMIN].some((role) => roles.includes(role)),
    [roles, isSignedIn]
  );

  // Tout rôle peut signaler un nid
  const canAddNest = useMemo(() => isSignedIn && roles.length > 0, [roles, isSignedIn]);

  // Tous les nids, avec leur auteur ; un piégeur ne voit que les nids détruits et les siens
  const canSeeAllNests = useMemo(
    () => isSignedIn && [HUNTER, BEEKEEPER, ADMIN].some((role) => roles.includes(role)),
    [roles, isSignedIn]
  );

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

  // Seuls les piégeurs et apiculteurs possèdent des pièges : l'administrateur
  // administre, il ne fait pas de terrain.
  const canAddTrap = useMemo(
    () => isSignedIn && (roles.includes(TRAPPER) || roles.includes(BEEKEEPER)),
    [roles, isSignedIn]
  );

  // Coordinateur des piégeurs (membre de `/trappers/admin`)
  const administersTrappers = administeredGroups.includes(TRAPPERS_ROOT);

  const isTrapOwner = useCallback(
    (trap: Trap) => Boolean(trap?.owner && userGuid && trap.owner.guid === userGuid),
    [userGuid]
  );

  // Modifier, déplacer ou supprimer un piège : propriétaire ou administrateur
  const canEditTrap = useCallback((trap: Trap) => {
    if (!trap || !isSignedIn) return false;
    return isAdmin || isTrapOwner(trap);
  }, [isAdmin, isTrapOwner, isSignedIn]);

  // Enregistrer une prise ou une action : propriétaire ou groupe délégataire
  const canActOnTrap = useCallback((trap: Trap) => {
    if (!trap || !isSignedIn) return false;
    return isTrapOwner(trap) || isMemberOfGroup(trap.group?.path);
  }, [isTrapOwner, isMemberOfGroup, isSignedIn]);

  // Désigner ou retirer le groupe délégataire : seulement vers une association
  // d'apiculteurs. La liste exacte des groupes autorisés est calculée par le
  // backend (GET /traps/{id}/delegation/).
  const canSetTrapDelegation = useCallback((trap: Trap) => {
    if (!trap || !isSignedIn) return false;
    if (isAdmin) return true;
    if (isTrapOwner(trap)) return memberGroups(groups).some(isBeekeeperGroup);
    return administeredGroups.some(isBeekeeperGroup);
  }, [isAdmin, isTrapOwner, groups, administeredGroups, isSignedIn]);

  const canChangeTrapOwner = isAdmin;

  // Mémoriser si l'utilisateur peut ajouter des ruchers
  const canAddApiary = useMemo(() => {
    if (!isSignedIn) return false;
    // Seuls les apiculteurs peuvent ajouter des ruchers
    return roles.includes(BEEKEEPER);
  }, [roles, isSignedIn]);

  if (!isSignedIn) {
    return {
      isAuthenticated: false,
      userEmail: null,
      userGuid: undefined as string | undefined,
      roles: [] as string[],
      isAdmin: false,
      canEditHornet: () => false,
      canDeleteHornet: () => false,
      canArchiveHornet: () => false,
      canArchiveNest: () => false,
      canAddHornet: false,
      canAddNest: false,
      canSeeAllNests: false,
      canAddApiary: false,
      groups: [] as string[],
      administeredGroups: [] as string[],
      administersTrappers: false,
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
    canArchiveHornet,
    canArchiveNest,
    canAddHornet,
    canAddNest,
    canSeeAllNests,
    canAddApiary,
    groups,
    administeredGroups,
    administersTrappers,
    canAddTrap,
    canEditTrap,
    canActOnTrap,
    canSetTrapDelegation,
    canChangeTrapOwner,
    accessToken,
  };
};
