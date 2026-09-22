import { Button, Modal } from 'react-bootstrap';

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
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Adresse du piège</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>La nouvelle position correspond à une autre adresse que celle enregistrée.</p>
        <dl className="mb-3">
          <dt className="small text-muted">Adresse enregistrée</dt>
          <dd>{currentAddress}</dd>
          <dt className="small text-muted">Adresse de la nouvelle position</dt>
          <dd className="mb-0">{foundAddress}</dd>
        </dl>
        <p className="small text-muted mb-0">
          La position GPS est enregistrée dans les deux cas : elle seule situe le piège.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onKeep} disabled={saving}>
          Conserver l'adresse
        </Button>
        <Button variant="primary" onClick={onReplace} disabled={saving}>
          Mettre à jour l'adresse
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
