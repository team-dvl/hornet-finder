import { Link } from 'react-router-dom';
import { FieldRow } from '../ui';

/**
 * Notifications row of the profile dialog: a way to the Notifications module,
 * where this device and the kinds of notifications are set.
 */
export default function PushSettings({ onNavigate }: { onNavigate: () => void }) {
  return (
    <FieldRow label="Notifications">
      <Link to="/notifications" onClick={onNavigate} className="text-decoration-none">
        Réglages<i className="bi bi-chevron-right ms-1" aria-hidden="true" />
      </Link>
    </FieldRow>
  );
}
