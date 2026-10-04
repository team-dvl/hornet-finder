import { APP_ROLES, BEEKEEPER, ADMIN } from '../utils/roles';

/**
 * Modules offered on the landing page.
 *
 * A module carrying `requiredRoles` is only listed for users holding one of
 * those realm roles (see `visibleModules` below); the route itself is guarded
 * by RequireRole.
 */
export type ModuleId = 'map' | 'nests' | 'traps' | 'apiaries' | 'stats' | 'docs' | 'admin' | 'account';

/**
 * Colour family of a module's icon: the field modules take the colour of what
 * they manage on the map, the platform ones (documentation, administration,
 * account) stay grey. See the `--tone-*` tokens in App.css.
 */
export type ModuleTone = 'map' | 'nest' | 'trap' | 'apiary' | 'stats' | 'plain';

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  /** Short label shown in the navbar next to the site name while the module is open */
  shortTitle: string;
  description: string;
  /** bootstrap-icons class name, e.g. `bi-geo-alt-fill` */
  icon: string;
  tone: ModuleTone;
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
    tone: 'map',
    path: '/map',
  },
  {
    id: 'nests',
    title: 'Recherche des nids',
    shortTitle: 'Nids',
    description: 'Cartographiez les observations de frelons, les nids et les ruchers.',
    icon: 'bi-geo-alt-fill',
    tone: 'nest',
    path: '/nests',
  },
  {
    id: 'traps',
    title: 'Gestion des pièges',
    shortTitle: 'Pièges',
    description: 'Gérez vos pièges et suivez les captures.',
    icon: 'bi-bullseye',
    tone: 'trap',
    path: '/traps',
  },
  {
    id: 'apiaries',
    title: 'Gestion des ruchers',
    shortTitle: 'Ruchers',
    description: 'Gérez vos ruchers et ceux que vos associations partagent avec vous.',
    icon: 'bi-hexagon-fill',
    tone: 'apiary',
    path: '/apiaries',
    requiredRoles: [BEEKEEPER, ADMIN],
  },
  {
    id: 'stats',
    title: 'Statistiques',
    shortTitle: 'Statistiques',
    description: 'Captures, efficacité des pièges et couverture du territoire.',
    icon: 'bi-bar-chart-line',
    tone: 'stats',
    path: '/stats',
    requiredRoles: APP_ROLES,
  },
  {
    id: 'docs',
    title: 'Documentation',
    shortTitle: 'Documentation',
    description: 'Comment utiliser chaque module de la plateforme.',
    icon: 'bi-book',
    tone: 'plain',
    path: '/docs',
  },
  {
    id: 'admin',
    title: 'Administration',
    shortTitle: 'Administration',
    description: 'Référentiels et outils de la plateforme.',
    icon: 'bi-sliders',
    tone: 'plain',
    path: '/admin',
    // Every role gets in (QR Codes, group rosters); each section filters further
    requiredRoles: APP_ROLES,
  },
  {
    id: 'account',
    title: 'Mon compte',
    shortTitle: 'Compte',
    description: 'Gérez votre profil et votre mot de passe.',
    icon: 'bi-person-circle',
    tone: 'plain',
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
