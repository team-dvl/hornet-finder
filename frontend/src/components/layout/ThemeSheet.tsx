import { ButtonGroup, ToggleButton } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import { MODES, PALETTES, setMode, setPalette, useTheme } from '../../utils/theme';

interface ThemeSheetProps {
  show: boolean;
  onHide: () => void;
}

/**
 * Look of the app: the palette and the mode (light, dark, or the system's).
 * A choice applies at once, so the sheet doubles as its own preview.
 */
export default function ThemeSheet({ show, onHide }: ThemeSheetProps) {
  const { palette, mode } = useTheme();

  return (
    <BottomSheet show={show} onHide={onHide} title="Apparence">
      <div className="d-grid gap-3">
        <fieldset>
          <legend className="fs-6 fw-semibold">Mode</legend>
          <ButtonGroup className="w-100" aria-label="Mode">
            {MODES.map((m) => (
              <ToggleButton
                key={m.id}
                id={`theme-mode-${m.id}`}
                type="radio"
                name="theme-mode"
                variant="outline-primary"
                className="theme-choice"
                value={m.id}
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
              >
                <i className={`bi bi-${m.icon} me-2`} aria-hidden="true" />
                {m.label}
              </ToggleButton>
            ))}
          </ButtonGroup>
        </fieldset>
        <fieldset>
          <legend className="fs-6 fw-semibold">Thème</legend>
          <ButtonGroup className="w-100" aria-label="Thème">
            {PALETTES.map((p) => (
              <ToggleButton
                key={p.id}
                id={`theme-palette-${p.id}`}
                type="radio"
                name="theme-palette"
                variant="outline-primary"
                className="theme-choice"
                value={p.id}
                checked={palette === p.id}
                onChange={() => setPalette(p.id)}
              >
                <span className="theme-swatch me-2" data-palette={p.id} aria-hidden="true" />
                {p.label}
              </ToggleButton>
            ))}
          </ButtonGroup>
        </fieldset>
      </div>
    </BottomSheet>
  );
}
