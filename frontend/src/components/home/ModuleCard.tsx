import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';

interface ModuleCardProps {
  title: string;
  description: string;
  /** bootstrap-icons class name, e.g. `bi-geo-alt-fill` */
  icon: string;
  /** Internal route */
  to?: string;
  /** External URL (same tab) */
  href?: string;
  onClick?: () => void;
  badge?: string;
}

/**
 * Clickable tile of the landing page menu. Rendered as a router Link,
 * a plain anchor or a button depending on which of `to`/`href`/`onClick` is set.
 */
export default function ModuleCard({ title, description, icon, to, href, onClick, badge }: ModuleCardProps) {
  const className = 'h-100 shadow-sm text-decoration-none text-body module-card';

  const body = (
    <Card.Body className="text-center d-flex flex-column">
      <i className={`bi ${icon} fs-1 text-primary`} aria-hidden="true" />
      <Card.Title as="h5" className="mt-2">
        {title}
        {badge && (
          <Badge bg="secondary" className="ms-2 align-middle fw-normal">
            {badge}
          </Badge>
        )}
      </Card.Title>
      <Card.Text className="small text-muted mb-0">{description}</Card.Text>
    </Card.Body>
  );

  if (to) {
    return (
      <Card as={Link} to={to} className={className}>
        {body}
      </Card>
    );
  }
  if (href) {
    return (
      <Card as="a" href={href} className={className}>
        {body}
      </Card>
    );
  }
  return (
    <Card as="button" type="button" onClick={onClick} className={className}>
      {body}
    </Card>
  );
}
