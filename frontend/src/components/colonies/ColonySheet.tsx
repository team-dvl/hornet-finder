import { useEffect, useState } from 'react';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { ConfirmationModal } from '../modals';
import { AppModal, FieldRow, IconButton, SheetActions } from '../ui';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import {
  END_LABELS, ORIGIN_LABELS, colonyLabel, countLabel, daysBetween, deleteColony, fetchColony, type Colony,
} from '../../utils/coloniesApi';
import { apiaryLabel, hiveErrorOf, hiveLabel, today, type ColonySummary } from '../../utils/hivesApi';
import { ColonyVisits } from '../visits';
import BroodBreak from './BroodBreak';
import ColonyEventModal, { type ColonyEventMode } from './ColonyEventModal';
import ColonyFormModal from './ColonyFormModal';

interface ColonySheetProps {
  colonyId: string;
  onHide: () => void;
  /** After a change (the hive's colonies may have changed too) */
  onChanged: () => void;
}

type SubDialog = 'edit' | 'delete' | ColonyEventMode;

const period = (from: string, to: string | null) =>
  to ? `${formatDate(from)} → ${formatDate(to)}` : `depuis le ${formatDate(from)}`;

/**
 * Sheet of a colony: where it lives, how it was born, its queen, its lineage
 * and the hives it lived in. Its parent and its descendants open in place.
 */
export default function ColonySheet({ colonyId, onHide, onChanged }: ColonySheetProps) {
  const historyAction = useHistoryAction();
  const [currentId, setCurrentId] = useState(colonyId);
  const [colony, setColony] = useState<Colony | null>(null);
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchColony(currentId)
      .then((found) => { if (!cancelled) { setColony(found); setError(null); } })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [currentId]);

  const open = (other: ColonySummary) => { setColony(null); setCurrentId(other.id); };

  const done = (next: Colony) => {
    setSub(null);
    setColony(next);
    setCurrentId(next.id);
    onChanged();
  };

  const handleDelete = async () => {
    if (!colony) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteColony(colony.id);
      onChanged();
      onHide();
    } catch (deleteError) {
      setError(hiveErrorOf(deleteError));
      setDeleting(false);
    }
  };

  const can = colony?.permissions ?? { edit: false, manage: false };
  const alive = Boolean(colony && !colony.ended_on);
  const count = colony ? countLabel(colony.hive.bar_family) : null;
  const history = colony && historyAction(`colony:${colony.id}`, `Colonie ${colonyLabel(colony)}`);
  const lineageRow = (other: ColonySummary) => (
    <button
      key={other.id}
      type="button"
      className="list-group-item list-group-item-action py-2 px-2 text-start"
      onClick={() => open(other)}
    >
      <span className="d-block text-truncate">{colonyLabel(other)}</span>
      <span className="d-block small text-muted text-truncate">
        {ORIGIN_LABELS[other.origin]} · {period(other.started_on, other.ended_on)}
      </span>
    </button>
  );

  return (
    <>
      <AppModal
        show={sub === null}
        onHide={onHide}
        icon={<i className="bi bi-bug hive-icon" aria-hidden="true" />}
        title={colony ? colonyLabel(colony) : 'Colonie'}
        badges={colony?.ended_on && colony.end_cause && (
          <Badge bg="secondary">{END_LABELS[colony.end_cause]}</Badge>
        )}
      >
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        {!colony && !error && <Spinner animation="border" size="sm" />}

        {colony && (
          <>
            <FieldRow label="Origine">{ORIGIN_LABELS[colony.origin]}</FieldRow>
            <FieldRow label="Ruche">
              {hiveLabel(colony.hive)}
              {colony.hive.status === 'active' && colony.compartment === 2 ? ' · compartiment 2' : ''}
            </FieldRow>
            {alive && colony.hive.portable && colony.in_hive_since && (
              <FieldRow label="En nucleus depuis">
                {formatDate(colony.in_hive_since)} (J+{daysBetween(colony.in_hive_since, today())})
              </FieldRow>
            )}
            {colony.hive.apiary && <FieldRow label="Rucher">{apiaryLabel(colony.hive.apiary)}</FieldRow>}
            {count && colony.bars !== null && <FieldRow label={count}>{colony.bars}</FieldRow>}
            <FieldRow label="Depuis le">{formatDate(colony.started_on)}</FieldRow>
            {colony.ended_on && <FieldRow label="Jusqu'au">{formatDate(colony.ended_on)}</FieldRow>}
            {colony.merged_into && (
              <FieldRow label="Réunie à">
                <button type="button" className="btn btn-link p-0 text-end text-break" onClick={() => open(colony.merged_into!)}>
                  {colonyLabel(colony.merged_into)}
                </button>
              </FieldRow>
            )}
            {colony.requeening_since && <FieldRow label="Reine"><BroodBreak colony={colony} /></FieldRow>}
            {colony.comments && <p className="small mt-2 mb-0">{colony.comments}</p>}

            {(can.edit || history) && (
              <SheetActions
                className="mt-3"
                more={[
                  can.edit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub('edit') },
                  can.edit && alive && { icon: 'wind', label: 'Essaimage', onClick: () => setSub('swarm') },
                  can.edit && alive && { icon: ACTION_ICONS.transfer, label: 'Transvaser', onClick: () => setSub('transfer') },
                  can.edit && alive && Boolean(colony.requeening_since) && !colony.laying_since && {
                    icon: 'egg', label: 'Ponte constatée', onClick: () => setSub('laying'),
                  },
                  can.edit && alive && { icon: 'x-octagon', label: 'Fin de la colonie', tone: 'warning', onClick: () => setSub('end') },
                  history,
                  can.manage && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub('delete') },
                ]}
              >
                {can.edit && alive && (
                  <IconButton variant="outline-primary" icon="diagram-2" label="Diviser" onClick={() => setSub('split')} />
                )}
              </SheetActions>
            )}

            {(colony.parent || (colony.children?.length ?? 0) > 0) && (
              <section className="mt-3" aria-label="Lignée">
                {colony.parent && (
                  <>
                    <div className="text-muted small mb-1">Issue de</div>
                    <div className="list-group mb-2">{lineageRow(colony.parent)}</div>
                  </>
                )}
                {(colony.children?.length ?? 0) > 0 && (
                  <>
                    <div className="text-muted small mb-1">Descendance</div>
                    <div className="list-group">{colony.children!.map(lineageRow)}</div>
                  </>
                )}
              </section>
            )}

            <ColonyVisits colonyId={colony.id} />

            {(colony.occupancies?.length ?? 0) > 1 && (
              <details className="mt-3">
                <summary className="small text-muted py-1">Ruches successives</summary>
                {colony.occupancies!.map((stay, index) => (
                  <FieldRow key={`o-${index}`} label={period(stay.started_on, stay.ended_on)}>
                    {hiveLabel(stay.hive)}{stay.compartment === 2 ? ' · comp. 2' : ''}
                  </FieldRow>
                ))}
              </details>
            )}
          </>
        )}
      </AppModal>

      {colony && sub === 'edit' && (
        <ColonyFormModal colony={colony} onHide={() => setSub(null)} onSaved={done} />
      )}
      {colony && (sub === 'split' || sub === 'swarm' || sub === 'transfer' || sub === 'end' || sub === 'laying') && (
        <ColonyEventModal mode={sub} colony={colony} onHide={() => setSub(null)} onDone={done} />
      )}
      <ConfirmationModal
        show={sub === 'delete'}
        onHide={() => { setSub(null); setError(null); }}
        onConfirm={handleDelete}
        itemName={colony ? `la colonie « ${colonyLabel(colony)} »` : ''}
        isDeleting={deleting}
        deleteError={error}
      />
    </>
  );
}
