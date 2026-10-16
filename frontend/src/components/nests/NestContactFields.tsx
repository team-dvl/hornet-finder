import { Form } from 'react-bootstrap';
import { HelpTip } from '../common';

interface NestContactFieldsProps {
  phone: string;
  onPhoneChange: (value: string) => void;
  privateComments: string;
  onPrivateCommentsChange: (value: string) => void;
  /** The reporter fills them in; a coordinator reads and corrects them */
  asCoordinator?: boolean;
  disabled?: boolean;
}

/**
 * What only the coordinators (and the reporter) read: a phone number to call
 * the reporter back, often enough to verify a nest without going there, and a
 * comment that never reaches the public map.
 */
export default function NestContactFields({
  phone, onPhoneChange, privateComments, onPrivateCommentsChange, asCoordinator = false, disabled,
}: NestContactFieldsProps) {
  return (
    <fieldset className="mb-0">
      <legend className="fs-6 fw-semibold d-flex align-items-center mb-2">
        <i className="bi bi-lock me-2" aria-hidden="true" />
        Pour les coordinateurs
        <HelpTip id="nest-contact-help" doc="nests#report" title="Pour les coordinateurs">
          Lus seulement par les coordinateurs des nids{asCoordinator ? ' et par la personne qui a signalé le nid' : ' et par vous'},
          jamais sur la carte publique. Le numéro sert à rappeler pour vérifier le nid sans passer sur place ; il est
          effacé à la fin de la saison, le 1<sup>er</sup> mars.
        </HelpTip>
      </legend>
      <Form.Group className="mb-3" controlId="nest-contact-phone">
        <Form.Label>
          {asCoordinator ? 'Téléphone du signaleur' : 'Téléphone pour vous rappeler'}
          {' '}<span className="text-muted fw-normal">facultatif</span>
        </Form.Label>
        <Form.Control
          type="tel"
          inputMode="tel"
          autoComplete={asCoordinator ? 'off' : 'tel'}
          maxLength={32}
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-0" controlId="nest-private-comments">
        <Form.Label>Commentaire pour les coordinateurs <span className="text-muted fw-normal">facultatif</span></Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={privateComments}
          placeholder={asCoordinator ? '' : 'Quand vous appeler, accès au terrain…'}
          onChange={(event) => onPrivateCommentsChange(event.target.value)}
          disabled={disabled}
        />
      </Form.Group>
    </fieldset>
  );
}
