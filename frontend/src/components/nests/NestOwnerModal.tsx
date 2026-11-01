import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { fetchNestOwnerChoices, transferNest, type Nest, type NestOwnerChoices } from '../../store/store';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';

/** Trappers listed at once; the search narrows the others down */
const SHOWN = 20;

interface NestOwnerModalProps {
  /** Mounted only while open, so every opening starts afresh */
  onHide: () => void;
  nest: Nest & { id: number };
  /** Whether the requester still sees the nest once handed over (they see every nest) */
  keepsSight: boolean;
  /** Called with the nest once handed over */
  onTransferred: (nest: Nest) => void;
}

/** Lower case without accents, to match « zoe » with « Zoé » */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Hand the follow-up of a nest over to a trapper: whoever reported it for
 * someone else passes it on. The owner manages and follows the nest; it is not
 * a legal owner. People are named by first and last name, never by email.
 */
export default function NestOwnerModal({ onHide, nest, keepsSight, onTransferred }: NestOwnerModalProps) {
  const dispatch = useAppDispatch();
  const [choices, setChoices] = useState<NestOwnerChoices | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch(fetchNestOwnerChoices(nest.id)).unwrap()
      .then((found) => { if (!cancelled) setChoices(found); })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, nest.id]);

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return (choices?.members ?? []).filter((member) => {
      const name = fold(member.name ?? '');
      return words.every((word) => name.includes(word));
    });
  }, [choices, query]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const { nest: updated } = await dispatch(transferNest({ id: nest.id, ownerGuid: selected, keep: keepsSight })).unwrap();
      onTransferred(updated);
    } catch (transferError) {
      setError(transferError as string);
      setSaving(false);
    }
  };

  const shown = matches.slice(0, SHOWN);
  const currentOwner = choices?.owner_guid ?? null;

  return (
    <AppModal
      show
      onHide={onHide}
      icon={OBJECT_ICONS.nest}
      title="Transférer le nid"
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving || !selected}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-arrow-left-right me-2" aria-hidden="true" />}
          Transférer
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {!choices && !error && <Spinner animation="border" size="sm" />}

      {choices && (
        <>
          <Form.Control
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom ou prénom"
            aria-label="Rechercher un piégeur"
            className="mb-2"
          />
          <div className="small mb-1 d-flex align-items-center">
            Suivi par
            <HelpTip id="nest-owner-help" doc="nests#follow" title="Transférer le nid">
              La personne choisie suit le nid : elle le voit, reçoit les notifications de son suivi et peut
              signaler sa neutralisation. Celle qui l&apos;a signalé reste indiquée comme telle.
            </HelpTip>
          </div>
          {matches.length === 0 && <p className="text-muted mb-0">Aucun piégeur.</p>}
          {shown.map((member) => {
            const isCurrent = member.guid === currentOwner;
            return (
              <Form.Check
                key={member.guid}
                type="radio"
                name="nest-new-owner"
                id={`nest-${nest.id}-owner-${member.guid}`}
                className="py-2 border-bottom"
                label={`${member.name ?? 'Sans nom'}${isCurrent ? ' (suit le nid)' : ''}`}
                checked={selected === member.guid}
                disabled={isCurrent || saving}
                onChange={() => setSelected(member.guid)}
              />
            );
          })}
          {matches.length > SHOWN && (
            <p className="text-muted small mt-2 mb-0">{matches.length - SHOWN} autres : précisez la recherche.</p>
          )}
          {!keepsSight && (
            <p className="text-warning-emphasis small mt-3 mb-0 d-flex gap-2">
              <i className="bi bi-exclamation-triangle flex-shrink-0" aria-hidden="true" />
              Vous ne verrez plus ce nid ensuite.
            </p>
          )}
        </>
      )}
    </AppModal>
  );
}
