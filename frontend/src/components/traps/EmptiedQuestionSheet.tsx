import { ListGroup } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';

interface EmptiedQuestionSheetProps {
  show: boolean;
  /** Back to the reading, as if nothing was chosen */
  onHide: () => void;
  onAnswer: (emptied: boolean) => void;
}

/**
 * Asked when the reading of a trap that accumulates is saved: was it emptied?
 * A question rather than a field of the form, so it cannot be skipped: the
 * answer sets what the next reading counts from.
 */
export default function EmptiedQuestionSheet({ show, onHide, onAnswer }: EmptiedQuestionSheetProps) {
  const choices = [
    { key: 'emptied', icon: 'arrow-counterclockwise', label: 'Vidé', detail: 'Compteurs remis à zéro', value: true },
    { key: 'left', icon: 'stack', label: 'Laissé en place', detail: 'Compteurs conservés', value: false },
  ];

  return (
    <BottomSheet
      show={show}
      onHide={onHide}
      title={(
        <span className="d-inline-flex align-items-center">
          Le piège a-t-il été vidé ?
          <HelpTip id="emptied-help" title="Piège vidé ou laissé en place">
            Les nouvelles prises sont déduites de ce que le piège contenait au relevé précédent.
            Un piège laissé en place garde ses insectes : ils ne sont pas comptés une seconde fois
            au relevé suivant.
          </HelpTip>
        </span>
      )}
    >
      <ListGroup variant="flush">
        {choices.map((choice) => (
          <ListGroup.Item
            key={choice.key}
            action
            onClick={() => onAnswer(choice.value)}
            className="d-flex align-items-center gap-3 px-1 py-2"
          >
            <i className={`bi bi-${choice.icon} fs-5 flex-shrink-0`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="d-block">{choice.label}</span>
              <span className="d-block small text-muted text-truncate">{choice.detail}</span>
            </span>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </BottomSheet>
  );
}
