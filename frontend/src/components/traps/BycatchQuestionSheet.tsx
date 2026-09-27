import { ListGroup } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';

interface BycatchQuestionSheetProps {
  show: boolean;
  /** Back to the reading, as if nothing was chosen */
  onHide: () => void;
  /** `true`: nothing else in the trap; `false`: other insects left uncounted */
  onAnswer: (bycatchCounted: boolean) => void;
  /** Back to the reading, to add species */
  onCount: () => void;
}

/**
 * Asked when a reading holds only the Asian hornet: were the other insects
 * counted? The share of the other species measures how selective a trap is,
 * which is only right when they are all counted.
 */
export default function BycatchQuestionSheet({ show, onHide, onAnswer, onCount }: BycatchQuestionSheetProps) {
  const choices = [
    { key: 'none', icon: 'check2-circle', label: 'Aucun autre insecte', onClick: () => onAnswer(true) },
    { key: 'uncounted', icon: 'dash-circle', label: 'Présents, non comptés', onClick: () => onAnswer(false) },
    { key: 'count', icon: 'plus-circle', label: 'Les compter', onClick: onCount },
  ];

  return (
    <BottomSheet
      show={show}
      onHide={onHide}
      title={(
        <span className="d-inline-flex align-items-center">
          Et les autres insectes ?
          <HelpTip id="bycatch-help" title="Autres insectes">
            La part des autres espèces mesure la sélectivité du piège : elle sert à comparer les
            modèles de pièges et à limiter leur impact sur les autres insectes. Elle n'est juste que
            si tout ce que contient le piège est compté.
          </HelpTip>
        </span>
      )}
    >
      <ListGroup variant="flush">
        {choices.map((choice) => (
          <ListGroup.Item
            key={choice.key}
            action
            onClick={choice.onClick}
            className="d-flex align-items-center gap-3 px-1 py-2"
          >
            <i className={`bi bi-${choice.icon} fs-5 flex-shrink-0`} aria-hidden="true" />
            {choice.label}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </BottomSheet>
  );
}
