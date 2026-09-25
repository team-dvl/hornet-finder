/**
 * Modules offered on the landing page.
 *
 * A module carrying `requiredRoles` is only listed for users holding one of
 * those realm roles (see `visibleModules` below); the route itself is guarded
 * by RequireRole.
 */
export type ModuleId = 'map' | 'nests' | 'traps' | 'apiaries' | 'docs' | 'admin' | 'account';

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  /** Short label shown in the navbar next to the site name while the module is open */
  shortTitle: string;
  description: string;
  /** bootstrap-icons class name, e.g. `bi-geo-alt-fill` */
  icon: string;
  /** Internal route. Absent for modules resolved at runtime (account console). */
  path?: string;
  badge?: string;
  requiredRoles?: string[];
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'map',
    title: 'Carte',
    shortTitle: 'Carte',
    description: 'Accédez directement à la carte des pièges, des nids et des ruchers.',
    icon: 'bi-map',
    path: '/map',
  },
  {
    id: 'nests',
    title: 'Recherche des nids',
    shortTitle: 'Nids',
    description: 'Cartographiez les observations de frelons, les nids et les ruchers.',
    icon: 'bi-geo-alt-fill',
    path: '/nests',
  },
  {
    id: 'traps',
    title: 'Gestion des pièges',
    shortTitle: 'Pièges',
    description: 'Gérez vos pièges et suivez les captures.',
    icon: 'bi-bullseye',
    path: '/traps',
  },
  {
    id: 'apiaries',
    title: 'Gestion des ruchers',
    shortTitle: 'Ruchers',
    description: 'Gérez vos ruchers et ceux que vos associations partagent avec vous.',
    icon: 'bi-hexagon-fill',
    path: '/apiaries',
    requiredRoles: ['beekeeper', 'admin'],
  },
  {
    id: 'docs',
    title: 'Documentation',
    shortTitle: 'Documentation',
    description: 'Comment utiliser chaque module de la plateforme.',
    icon: 'bi-book',
    path: '/docs',
  },
  {
    id: 'admin',
    title: 'Administration',
    shortTitle: 'Administration',
    description: 'Référentiels et outils de la plateforme.',
    icon: 'bi-sliders',
    path: '/admin',
    // Every role gets in for the QR Codes printing; each section filters further
    requiredRoles: ['admin', 'volunteer', 'beekeeper'],
  },
  {
    id: 'account',
    title: 'Mon compte',
    shortTitle: 'Compte',
    description: 'Gérez votre profil et votre mot de passe.',
    icon: 'bi-person-circle',
  },
];

/** Modules the given roles give access to. */
export function visibleModules(roles: string[]): ModuleDefinition[] {
  return MODULES.filter(
    (module) => !module.requiredRoles || module.requiredRoles.some((role) => roles.includes(role))
  );
}

/**
 * Modules that get a page under /docs: the user-facing ones the given roles
 * open, which leaves out the documentation module itself, the account
 * console and the map shortcut (its layers are documented with the nest and
 * trap modules). A module nobody but an admin can use is not named to others.
 */
export function documentedModules(roles: string[]): ModuleDefinition[] {
  return visibleModules(roles).filter((m) => m.id !== 'docs' && m.id !== 'account' && m.id !== 'map');
}

export function findModule(id: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}
