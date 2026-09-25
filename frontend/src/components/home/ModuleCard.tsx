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
  // The description is hidden on a phone; it stays as a tooltip

  const body = (
    <Card.Body className="text-center d-flex flex-column p-2 p-sm-3">
      <i className={`bi ${icon} fs-1 text-primary`} aria-hidden="true" />
      <Card.Title as="h5" className="mt-1 mt-sm-2 mb-0 mb-sm-2 module-card-title">
        {title}
        {badge && (
          <Badge bg="secondary" className="ms-1 align-middle fw-normal">
            {badge}
          </Badge>
        )}
      </Card.Title>
      <Card.Text className="small text-muted mb-0 d-none d-sm-block">{description}</Card.Text>
    </Card.Body>
  );

  if (to) {
    return (
      <Card as={Link} to={to} className={className} title={description}>
        {body}
      </Card>
    );
  }
  if (href) {
    return (
      <Card as="a" href={href} className={className} title={description}>
        {body}
      </Card>
    );
  }
  return (
    <Card as="button" type="button" onClick={onClick} className={className} title={description}>
      {body}
    </Card>
  );
}
