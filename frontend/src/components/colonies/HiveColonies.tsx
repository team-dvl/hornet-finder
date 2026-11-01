import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import { ORIGIN_LABELS, colonyLabel, countLabel, daysBetween } from '../../utils/coloniesApi';
import { today, type ColonySummary, type Hive } from '../../utils/hivesApi';
import BroodBreak from './BroodBreak';

interface HiveColoniesProps {
  hive: Hive;
  /** The user tends the hive */
  canEdit: boolean;
  onOpen: (colony: ColonySummary) => void;
  onInstall: (compartment: 1 | 2) => void;
}

/** The colonies living in a hive, compartment by compartment, in its sheet. */
export default function HiveColonies({ hive, canEdit, onOpen, onInstall }: HiveColoniesProps) {
  const divided = hive.max_colonies > 1 && Boolean(hive.divider_bar);
  const compartments: (1 | 2)[] = divided ? [1, 2] : [1];
  const count = countLabel(hive.bar_family);
  const inService = hive.status === 'active';
  if (!inService && hive.colonies.length === 0) return null;

  return (
    <section className="mt-3" aria-label="Colonies de la ruche">
      <div className="text-muted small mb-1">
        Colonies
        {divided && ` · cloison à la barrette ${hive.divider_bar}`}
      </div>
      <div className="list-group">
        {compartments.map((compartment) => {
          const colony = hive.colonies.find((item) => item.compartment === compartment);
          const where = divided ? `Compartiment ${compartment}` : null;
          if (!colony) {
            return (
              <div key={compartment} className="list-group-item d-flex align-items-center gap-2 py-2 px-2">
                <span className="flex-grow-1 text-muted small">{where ? `${where} : libre` : 'Aucune colonie'}</span>
                {canEdit && inService && (
                  <IconButton
                    variant="outline-secondary"
                    icon={ACTION_ICONS.add}
                    label="Installer une colonie"
                    onClick={() => onInstall(compartment)}
                  />
                )}
              </div>
            );
          }
          return (
            <button
              key={compartment}
              type="button"
              className="list-group-item list-group-item-action d-flex gap-2 align-items-start py-2 px-2"
              onClick={() => onOpen(colony)}
              aria-label={`Fiche de la colonie ${colonyLabel(colony)}`}
            >
              <i className="bi bi-bug hive-icon fs-5 flex-shrink-0" aria-hidden="true" />
              <span className="d-block min-w-0 flex-grow-1">
                <strong className="d-block text-truncate">{colonyLabel(colony)}</strong>
                <span className="d-block small text-muted text-truncate">
                  {[where, ORIGIN_LABELS[colony.origin],
                    count && colony.bars !== null ? `${colony.bars} ${count.toLowerCase()}` : null]
                    .filter(Boolean).join(' · ')}
                </span>
                {hive.portable && colony.in_hive_since && (
                  <span className="d-block small text-truncate">
                    En nucleus depuis le {formatDate(colony.in_hive_since)} (J+{daysBetween(colony.in_hive_since, today())})
                  </span>
                )}
                {colony.requeening_since && (
                  <span className="d-block small text-truncate"><BroodBreak colony={colony} compact /></span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
