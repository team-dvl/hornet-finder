import { useId, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import { AuthImage } from '../common';
import { OBJECT_ICONS } from '../../utils/icons';
import { apiaryLabel, type ApiaryChoice } from '../../utils/hivesApi';

/** Above this many apiaries, the list gets a search field. */
const SEARCH_FROM = 8;

interface ApiaryPickerProps {
  /** `id` of the button, for a `<Form.Label htmlFor>` */
  id: string;
  /** `null` while loading */
  options: ApiaryChoice[] | null;
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  /** Offers "no apiary" first, with this wording (e.g. "Aucun : remisée") */
  noneLabel?: string;
}

function ApiaryRow({ apiary }: { apiary: ApiaryChoice }) {
  return (
    <>
      <span className="manager-list-thumb flex-shrink-0 rounded">
        {apiary.thumbnail_url
          ? <AuthImage src={apiary.thumbnail_url} className="rounded" />
          : <span aria-hidden="true">{OBJECT_ICONS.apiary}</span>}
      </span>
      <span className="d-block min-w-0 flex-grow-1">
        <span className="apiary-picker-label fw-semibold">{apiaryLabel(apiary)}</span>
        {apiary.name && apiary.address && (
          <span className="d-block small text-muted text-truncate">{apiary.address}</span>
        )}
      </span>
    </>
  );
}

/**
 * Choice of an apiary by its name, its address in grey below and its photo:
 * a native select shows neither two lines nor a picture. The list opens
 * inline, in the dialog that holds it (never a second dialog).
 */
export default function ApiaryPicker({ id, options, value, onChange, disabled = false, noneLabel }: ApiaryPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const current = value === null ? null
    : options?.find((option) => option.id === value) ?? { id: value, name: '', address: '', thumbnail_url: null };
  const needle = search.trim().toLocaleLowerCase('fr');
  const shown = (options ?? []).filter((option) => !needle
    || `${option.name} ${option.address} #${option.id}`.toLocaleLowerCase('fr').includes(needle));

  const choose = (next: number | null) => {
    onChange(next);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="apiary-picker">
      <button
        id={id}
        type="button"
        className="apiary-picker-current list-group-item list-group-item-action d-flex align-items-center gap-2 rounded border"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || options === null}
        onClick={() => setOpen((was) => !was)}
      >
        {options === null ? (
          <span className="d-flex align-items-center gap-2 flex-grow-1 text-muted">
            <Spinner animation="border" size="sm" /> Chargement…
          </span>
        ) : current ? (
          <ApiaryRow apiary={current} />
        ) : (
          <span className="flex-grow-1 text-muted">{noneLabel ?? 'Choisir…'}</span>
        )}
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} flex-shrink-0`} aria-hidden="true" />
      </button>

      {open && options !== null && (
        <div id={listId} className="mt-2">
          {options.length > SEARCH_FROM && (
            <Form.Control
              type="search"
              className="mb-2"
              placeholder="Nom, adresse ou numéro"
              aria-label="Chercher un rucher"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          <div className="list-group" role="listbox" aria-label="Ruchers">
            {noneLabel && !needle && (
              <button type="button" role="option" aria-selected={value === null}
                className="list-group-item list-group-item-action d-flex align-items-center gap-2 apiary-picker-option"
                onClick={() => choose(null)}>
                <span className="flex-grow-1">{noneLabel}</span>
                {value === null && <i className="bi bi-check-lg flex-shrink-0 text-primary" aria-hidden="true" />}
              </button>
            )}
            {shown.map((option) => (
              <button key={option.id} type="button" role="option" aria-selected={option.id === value}
                className="list-group-item list-group-item-action d-flex align-items-center gap-2 apiary-picker-option"
                onClick={() => choose(option.id)}>
                <ApiaryRow apiary={option} />
                {option.id === value && <i className="bi bi-check-lg flex-shrink-0 text-primary" aria-hidden="true" />}
              </button>
            ))}
            {shown.length === 0 && (
              <div className="list-group-item text-muted">{options.length ? 'Aucun rucher trouvé.' : 'Aucun rucher.'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
