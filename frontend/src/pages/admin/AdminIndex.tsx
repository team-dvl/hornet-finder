import { Container } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';
import { useUserPermissions } from '../../hooks/useUserPermissions';

interface AdminSection {
  title: string;
  description: string;
  icon: string;
  to?: string;
  href?: string;
  badge?: string;
  /** Realm roles that see the card; the route itself is guarded by RequireRole */
  roles: string[];
}

const SECTIONS: AdminSection[] = [
  {
    title: 'Types de pièges',
    description: 'Ajoutez, illustrez ou retirez les modèles de pièges proposés aux utilisateurs.',
    icon: 'bi-bullseye',
    to: '/admin/trap-types',
    roles: ['admin'],
  },
  {
    title: 'Espèces',
    description: "Tenez à jour les espèces proposées lors d'un constat de capture, et leur photo.",
    icon: 'bi-bug',
    to: '/admin/species',
    roles: ['admin'],
  },
  {
    title: 'QR Codes',
    description: 'Imprimez des planches de QR Codes pour vos objets.',
    icon: 'bi-qr-code',
    to: '/admin/tags',
    roles: ['volunteer', 'beekeeper'],
  },
  {
    title: 'QR Codes',
    description: 'Imprimez des QR Codes, suivez-les avec leurs clefs de signature, et révoquez ceux qui sont perdus ou compromis.',
    icon: 'bi-qr-code',
    to: '/admin/tags',
    roles: ['admin'],
  },
  ...(import.meta.env.DEV
    ? [{
      title: 'Internal mail server',
      description: "Consultez tous les emails envoyés par l'environnement de développement (catch-all, rien n'est relayé).",
      icon: 'bi-envelope',
      href: '/mail/',
      badge: 'DEV',
      roles: ['admin'],
    }]
    : []),
];

/**
 * Administration home: the referentials an admin maintains, and the tools
 * other users get (printing QR Codes).
 */
export default function AdminIndex() {
  const { roles, isAdmin } = useUserPermissions();
  // An admin sees the admin variant of a card, never both
  const sections = SECTIONS.filter((section) =>
    isAdmin ? section.roles.includes('admin') : section.roles.some((role) => roles.includes(role))
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
