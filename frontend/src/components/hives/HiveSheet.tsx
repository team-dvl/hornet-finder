import { useEffect, useState } from 'react';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { ConfirmationModal } from '../modals';
import { AppModal, FieldRow, IconButton, SheetActions } from '../ui';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import {
  HIVE_STATUS_LABELS, apiaryLabel, deleteHive, fetchHive, hiveErrorOf, hiveLabel, type Hive,
} from '../../utils/hivesApi';
import HiveFormModal from './HiveFormModal';
import HiveKeeperModal from './HiveKeeperModal';
import HivePlaceModal, { type PlaceMode } from './HivePlaceModal';

interface HiveSheetProps {
  /** The hive as listed; its detail (history) is loaded on opening */
  hive: Hive;
  onHide: () => void;
  /** After a change; `null` once deleted */
  onChanged: (hive: Hive | null) => void;
}

/** Dialog shown in place of the sheet (one dialog at a time) */
type SubDialog = 'edit' | 'keeper' | 'delete' | PlaceMode;

const period = (from: string, to: string | null) =>
  to ? `${formatDate(from)} → ${formatDate(to)}` : `depuis le ${formatDate(from)}`;

/** Sheet of a hive: what it is, where it stands, who keeps it, and their history. */
export default function HiveSheet({ hive: listed, onHide, onChanged }: HiveSheetProps) {
  const navigate = useNavigate();
  const historyAction = useHistoryAction();
  const [hive, setHive] = useState<Hive>(listed);
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHive(listed.id)
      .then((found) => { if (!cancelled) setHive(found); })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listed.id]);

  const changed = (saved: Hive) => {
    setHive(saved);
    setSub(null);
    onChanged(saved);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteHive(hive.id);
      onChanged(null);
      onHide();
    } catch (deleteError) {
      setError(hiveErrorOf(deleteError));
      setDeleting(false);
    }
  };

  const can = hive.permissions ?? { edit: false, move: false, manage: false };
  const history = historyAction(`hive:${hive.id}`, `Ruche ${hiveLabel(hive)}`);
  const pastPlacements = hive.placements?.filter((stay) => stay.ended_on) ?? [];
  const pastCustodies = hive.custodies?.filter((custody) => custody.ended_on) ?? [];

  return (
    <>
      <AppModal
        show={sub === null}
        onHide={onHide}
        icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
        title={hiveLabel(hive)}
        badges={hive.status !== 'active' && (
          <Badge bg={hive.status === 'retired' ? 'secondary' : 'warning'} text={hive.status === 'retired' ? undefined : 'dark'}>
            {HIVE_STATUS_LABELS[hive.status]}
          </Badge>
        )}
      >
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <FieldRow label="Type">{hive.hive_type_name}</FieldRow>
        <FieldRow label="Rucher">
          {hive.apiary ? (
            <button
              type="button"
              className="btn btn-link p-0 text-end text-break"
              onClick={() => navigate(`/apiaries?apiary=${hive.apiary!.id}`)}
            >
              {apiaryLabel(hive.apiary)}
            </button>
          ) : '—'}
        </FieldRow>
        {hive.owner && (
          <FieldRow label="Propriétaire">
            {hive.owner.kind === 'group' ? hive.owner.name : hive.owner.display_name}
          </FieldRow>
        )}
        {hive.keeper && <FieldRow label="Confiée à">{hive.keeper.display_name}</FieldRow>}
        {hive.commissioned_on && <FieldRow label="Mise en service">{formatDate(hive.commissioned_on)}</FieldRow>}
        {hive.comments && <p className="small mt-2 mb-0">{hive.comments}</p>}

        {(can.edit || can.manage || history) && (
          <SheetActions
            className="mt-3"
            more={[
              can.edit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub('edit') },
              can.move && hive.status === 'active' && {
                icon: ACTION_ICONS.shelve, label: 'Remiser', onClick: () => setSub('store'),
              },
              can.manage && { icon: 'person-check', label: 'Confier', onClick: () => setSub('keeper') },
              can.manage && hive.status !== 'retired' && {
                icon: 'x-octagon', label: 'Réformer', tone: 'warning', onClick: () => setSub('retire'),
              },
              history,
              can.manage && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub('delete') },
            ]}
          >
            {can.move && (
              <IconButton
                variant="outline-primary"
                icon={ACTION_ICONS.move}
                label={hive.status === 'active' ? 'Déplacer' : 'Installer'}
                onClick={() => setSub('move')}
              />
            )}
          </SheetActions>
        )}

        {loading && <div className="mt-3"><Spinner animation="border" size="sm" /></div>}
        {(pastPlacements.length > 0 || pastCustodies.length > 0) && (
          <details className="mt-3">
            <summary className="small text-muted py-1">Historique</summary>
            {hive.placements?.map((stay, index) => (
              <FieldRow key={`p-${index}`} label={period(stay.started_on, stay.ended_on)}>
                {stay.apiary ? apiaryLabel(stay.apiary) : (stay.apiary_label || 'Rucher supprimé')}
              </FieldRow>
            ))}
            {hive.custodies?.map((custody, index) => (
              <FieldRow key={`c-${index}`} label={period(custody.started_on, custody.ended_on)}>
                <i className="bi bi-person me-1" aria-hidden="true" />
                {custody.keeper?.display_name ?? 'Compte supprimé'}
              </FieldRow>
            ))}
          </details>
        )}
      </AppModal>

      {sub === 'edit' && <HiveFormModal hive={hive} onHide={() => setSub(null)} onSaved={changed} />}
      {(sub === 'move' || sub === 'store' || sub === 'retire') && (
        <HivePlaceModal mode={sub} hive={hive} onHide={() => setSub(null)} onDone={changed} />
      )}
      {sub === 'keeper' && <HiveKeeperModal hive={hive} onHide={() => setSub(null)} onDone={changed} />}
      <ConfirmationModal
        show={sub === 'delete'}
        onHide={() => { setSub(null); setError(null); }}
        onConfirm={handleDelete}
        itemName={`la ruche « ${hiveLabel(hive)} »`}
        isDeleting={deleting}
        deleteError={error}
      />
    </>
  );
}
