import { Badge } from 'react-bootstrap';
import type { NestStatus } from '../../store/store';
import { nestStatusInfo } from '../../utils/nestStatus';

/** The status of a nest, in its colour. */
export default function NestStatusBadge({ status }: { status?: NestStatus }) {
  const info = nestStatusInfo(status);
  return (
    <Badge bg={info.tone} text={info.tone === 'light' || info.tone === 'warning' ? 'dark' : undefined}
      className={`fw-normal nest-status-badge${info.tone === 'light' ? ' border' : ''}`}
    >
      {info.label}
    </Badge>
  );
}
