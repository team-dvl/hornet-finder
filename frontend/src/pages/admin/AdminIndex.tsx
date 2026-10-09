import { Container } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { isBeekeeperGroup } from '../../utils/groups';
import { ADMIN, BEEKEEPER, TRAPPER } from '../../utils/roles';

interface AdminSection {
  title: string;
  description: string;
  icon: string;
  to?: string;
  href?: string;
  badge?: string;
  /** Realm roles that see the card; the route itself is guarded by RequireRole */
  roles: string[];
  /** Outside platform admins, only for administrators of a beekeeper group */
  beekeeperGroupAdmins?: boolean;
  /** Outside platform admins, only for the coordinators of the trappers (`/trappers/admin`) */
  trappersAdmins?: boolean;
}

const SECTIONS: AdminSection[] = [
  {
    title: 'Types de pièges',
    description: 'Ajoutez, illustrez ou retirez les modèles de pièges proposés aux utilisateurs.',
    icon: 'bi-bullseye',
    to: '/admin/trap-types',
    roles: [ADMIN],
  },
  {
    title: 'Espèces',
    description: "Tenez à jour les espèces proposées lors d'un constat de capture, et leur photo.",
    icon: 'bi-bug',
    to: '/admin/species',
    roles: [ADMIN],
  },
  {
    title: 'Archivage',
    description: "Archivez les données d'une année écoulée.",
    icon: 'bi-archive',
    to: '/admin/archiving',
    roles: [ADMIN],
  },
  {
    title: 'Groupes',
    description: "Gérez les membres et les invitations des associations d'apiculteurs, et la liste des piégeurs.",
    icon: 'bi-people',
    to: '/admin/group',
    roles: [ADMIN],
  },
  {
    title: 'Mon groupe',
    description: 'Gérez les membres et les invitations de votre association.',
    icon: 'bi-people',
    to: '/admin/group',
    roles: [BEEKEEPER],
    beekeeperGroupAdmins: true,
  },
  {
    title: 'Piégeurs',
    description: 'Consultez la liste des piégeurs que vous coordonnez.',
    icon: 'bi-people',
    to: '/admin/group',
    roles: [TRAPPER],
    trappersAdmins: true,
  },
  {
    title: 'QR Codes',
    description: 'Imprimez des planches de QR Codes pour vos objets.',
    icon: 'bi-qr-code',
    to: '/admin/tags',
    roles: [TRAPPER, BEEKEEPER],
  },
  {
    title: 'QR Codes',
    description: 'Imprimez des QR Codes, suivez-les avec leurs clefs de signature, et révoquez ceux qui sont perdus ou compromis.',
    icon: 'bi-qr-code',
    to: '/admin/tags',
    roles: [ADMIN],
  },
  {
    title: "Journal d'audit",
    description: 'Retrouvez qui a fait quoi, quand, sur chaque objet.',
    icon: 'bi-clock-history',
    to: '/admin/audit',
    roles: [ADMIN],
  },
  ...(import.meta.env.DEV
    ? [{
      title: 'Internal mail server',
      description: "Consultez tous les emails envoyés par l'environnement de développement (catch-all, rien n'est relayé).",
      icon: 'bi-envelope',
      href: '/mail/',
      badge: 'DEV',
      roles: [ADMIN],
    }]
    : []),
];

/**
 * Administration home: the referentials an admin maintains, and the tools
 * other users get (printing QR Codes).
 */
export default function AdminIndex() {
  const { roles, isAdmin, administeredGroups, administersTrappers } = useUserPermissions();
  const administersBeekeeperGroup = administeredGroups.some(isBeekeeperGroup);
  // An admin sees the admin variant of a card, never both
  const sections = SECTIONS.filter((section) =>
    isAdmin
      ? section.roles.includes(ADMIN)
      : section.roles.some((role) => roles.includes(role))
        && (!section.beekeeperGroupAdmins || administersBeekeeperGroup)
        && (!section.trappersAdmins || administersTrappers)
  );

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader
          title="Administration"
          help={isAdmin ? 'Référentiels et paramètres de la plateforme.' : 'Outils mis à votre disposition.'}
        />

        <div className="tile-grid">
          {sections.map((section) => (
              <ModuleCard
                key={`${section.title}-${section.roles.join()}`}
                title={section.title}
                description={section.description}
                icon={section.icon}
                to={section.to}
                href={section.href}
                badge={section.badge}
              />
          ))}
        </div>
      </Container>
    </PageLayout>
  );
}
