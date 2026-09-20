/**
 * Modules offered on the landing page.
 *
 * All modules are currently open to everyone; `requiredRoles` is reserved for
 * role-based filtering later (see hooks/useUserPermissions.ts).
 */
export type ModuleId = 'nests' | 'traps' | 'account';

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
    description: 'Gérez vos pièges et suivez les prises.',
    icon: 'bi-bullseye',
    path: '/traps',
    badge: 'Bientôt disponible',
  },
  {
    id: 'account',
    title: 'Mon compte',
    shortTitle: 'Compte',
    description: 'Gérez votre profil et votre mot de passe.',
    icon: 'bi-person-circle',
  },
];
