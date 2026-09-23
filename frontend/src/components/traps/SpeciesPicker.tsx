import { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import type { Species } from '../../store/store';
import { SpeciesImage } from './SpeciesCard';
import { SPECIES_GRID_STYLE } from './speciesGrid';

interface SpeciesPickerProps {
  species: Species[];
  /** Slugs already on the catch, left out of the choice */
  excluded: string[];
  onPick: (slug: string) => void;
  onCancel: () => void;
}

/** Case- and accent-insensitive form of a label, for the search. */
const normalise = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Choose a species to add to a catch, by its picture or by searching its
 * common or scientific name. Shown in place of the cards, inside the same
 * dialog: a second modal on top of the first does not behave on a phone.
 */
export default function SpeciesPicker({ species, excluded, onPick, onCancel }: SpeciesPickerProps) {
  const [search, setSearch] = useState('');

  const choices = useMemo(() => {
    const query = normalise(search.trim());
    return species.filter((item) => !excluded.includes(item.slug)
      && (!query || normalise(`${item.name} ${item.scientific_name}`).includes(query)));
  }, [species, excluded, search]);

  return (
    <div>
      <div className="d-flex gap-2 mb-2">
        <Form.Control
          type="search"
          placeholder="Rechercher une espèce…"
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            // Enter picks the only match rather than submitting the form
            if (event.key === 'Enter') {
              event.preventDefault();
              if (choices.length === 1) onPick(choices[0].slug);
            }
          }}
        />
        <Button variant="outline-secondary" onClick={onCancel}>Retour</Button>
      </div>

      {choices.length === 0 ? (
        <p className="text-muted small mb-0">Aucune espèce ne correspond.</p>
      ) : (
        <div style={{ ...SPECIES_GRID_STYLE, maxHeight: '50vh', overflowY: 'auto' }}>
          {choices.map((item) => (
            <button
              key={item.slug}
              type="button"
              className="card overflow-hidden p-0 text-start"
              onClick={() => onPick(item.slug)}
            >
              <SpeciesImage src={item.photo_thumbnail_url} name={item.name} credit={item.photo_credit} />
              <span className="px-1 pt-1 small text-truncate w-100 d-block">{item.name}</span>
              <span
                className="px-1 pb-1 text-muted fst-italic text-truncate w-100 d-block"
                style={{ fontSize: '0.7rem' }}
              >
                {item.scientific_name || ' '}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
