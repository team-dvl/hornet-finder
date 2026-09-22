import { useEffect, useRef, useState } from 'react';
import { Form, ListGroup, Spinner } from 'react-bootstrap';
import { searchAddress, type AddressSuggestion } from '../../utils/geocoding';

interface AddressSearchProps {
  label?: string;
  /** Called when a suggestion is picked */
  onSelect: (suggestion: AddressSuggestion) => void;
}

const DEBOUNCE_MS = 600; // Nominatim asks for a low request rate

/** Free-form address search, used to place a trap without touching the map. */
export default function AddressSearch({ label = 'Rechercher une adresse', onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 3) return;
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      setSuggestions(await searchAddress(query));
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [query]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelect(suggestion);
    setQuery(suggestion.displayName);
    setSuggestions([]);
  };

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <div className="position-relative">
        <Form.Control
          type="text"
          value={query}
          placeholder="rue, numéro, commune…"
          onChange={(event) => {
            setQuery(event.target.value);
            // Stale suggestions must not survive a new query
            if (suggestions.length > 0) setSuggestions([]);
          }}
        />
        {searching && (
          <Spinner
            animation="border"
            size="sm"
            className="position-absolute top-50 end-0 translate-middle-y me-2"
          />
        )}
      </div>
      {suggestions.length > 0 && (
        <ListGroup className="mt-1" style={{ maxHeight: 180, overflowY: 'auto' }}>
          {suggestions.map((suggestion) => (
            <ListGroup.Item
              key={`${suggestion.latitude}-${suggestion.longitude}`}
              action
              onClick={() => handleSelect(suggestion)}
              className="small"
            >
              {suggestion.displayName}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Form.Group>
  );
}
