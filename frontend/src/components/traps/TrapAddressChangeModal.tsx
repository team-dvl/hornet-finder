import { Button } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';

interface TrapAddressChangeModalProps {
  /** Address currently stored on the trap */
  currentAddress: string;
  /** Address found at the new position */
  foundAddress: string;
  saving?: boolean;
  /** Save the move and replace the address */
  onReplace: () => void;
  /** Save the move and keep the stored address */
  onKeep: () => void;
  /** Close without saving anything: the move stays pending */
  onHide: () => void;
}

/**
 * Asked when a trap is moved to a position whose address differs from the one
 * it carries. The address may have been chosen by hand, or describe the place
 * rather than the point, so it is never replaced without a word.
 */
export default function TrapAddressChangeModal({
  currentAddress, foundAddress, saving = false, onReplace, onKeep, onHide,
}: TrapAddressChangeModalProps) {
  return (
    <AppModal
      show
      onHide={onHide}
      compact
      title="Changer l'adresse ?"
      footer={(
        <>
          <Button variant="outline-secondary" onClick={onKeep} disabled={saving}>Conserver</Button>
          <Button variant="primary" onClick={onReplace} disabled={saving}>Mettre à jour</Button>
        </>
      )}
    >
      <dl className="mb-0">
        <dt className="small text-muted fw-normal">Adresse enregistrée</dt>
        <dd>{currentAddress}</dd>
        <dt className="small text-muted fw-normal d-flex align-items-center">
          Adresse de la nouvelle position
          <HelpTip id="trap-address-help" title="Position et adresse">
            La position GPS est enregistrée dans les deux cas : elle seule situe le piège.
          </HelpTip>
        </dt>
        <dd className="mb-0">{foundAddress}</dd>
      </dl>
    </AppModal>
  );
}
