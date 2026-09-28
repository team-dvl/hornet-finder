import { useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';
import { currentPosition } from '../../utils/position';
import type { StatParams } from '../../utils/statsApi';
import {
  GRANULARITY_OPTIONS, ORDER_OPTIONS, PERIOD_OPTIONS, RADIUS_OPTIONS, SEASON_OPTIONS, yearOptions,
} from './statParams';

interface StatFiltersSheetProps {
  show: boolean;
  onHide: () => void;
  params: StatParams;
  /** Parameters this statistic offers (from the catalogue) */
  filters: string[];
  onChange: (changes: StatParams) => void;
  trapTypes: { slug: string; name: string }[];
  groups: { path: string; label: string }[];
}

/**
 * Filters of a statistic, applied as they are picked: the table behind the
 * sheet follows, and the header's close button is the only way out.
 */
export default function StatFiltersSheet({
  show, onHide, params, filters, onChange, trapTypes, groups,
}: StatFiltersSheetProps) {
  const [locating, setLocating] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const offers = (name: string) => filters.includes(name);
  const period = params.period;

  const pickRadius = async (value: string) => {
    setZoneError(null);
    if (!value) {
      onChange({ lat: '', lon: '', radius: '' });
      return;
    }
    setLocating(true);
    try {
      const position = await currentPosition();
      onChange({ lat: String(position.lat), lon: String(position.lon), radius: value });
    } catch (error) {
      setZoneError((error as Error).message.replace('trier par distance', 'filtrer par zone'));
    } finally {
      setLocating(false);
    }
  };

  return (
    <BottomSheet show={show} onHide={onHide} title="Filtres">
      <Form.Label className="fw-semibold mb-2">Période</Form.Label>
      <div className="stat-chip-grid" role="radiogroup" aria-label="Période">
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={period === option.value ? 'primary' : 'outline-primary'}
            className="rounded-pill"
            role="radio"
            aria-checked={period === option.value}
            onClick={() => onChange({ period: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {period === 'season' && (
        <div className="stat-field-row mt-2">
          <Form.Group controlId="stat-season" className="flex-grow-1">
            <Form.Label className="small text-muted mb-1">Saison</Form.Label>
            <Form.Select value={params.season} onChange={(e) => onChange({ season: e.target.value })}>
              {SEASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="stat-season-year" className="stat-year">
            <Form.Label className="small text-muted mb-1">Année</Form.Label>
            <Form.Select value={params.year} onChange={(e) => onChange({ year: e.target.value })}>
              {yearOptions().map((year) => <option key={year} value={year}>{year}</option>)}
            </Form.Select>
          </Form.Group>
        </div>
      )}

      {period === 'year' && (
        <Form.Group controlId="stat-year" className="mt-2">
          <Form.Label className="small text-muted mb-1 d-flex align-items-center">
            Année du cycle
            <HelpTip id="stat-year-help" title="Année">
              Le cycle de vie du frelon, assimilé à l&apos;année civile : du 1er janvier au
              31 décembre, jusqu&apos;à aujourd&apos;hui pour l&apos;année en cours.
            </HelpTip>
          </Form.Label>
          <Form.Select value={params.year} onChange={(e) => onChange({ year: e.target.value })}>
            {yearOptions().map((year) => <option key={year} value={year}>{year}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      {period === 'custom' && (
        <div className="stat-field-row mt-2">
          <Form.Group controlId="stat-from" className="flex-grow-1">
            <Form.Label className="small text-muted mb-1">Du</Form.Label>
            <Form.Control type="date" value={params.from ?? ''} onChange={(e) => onChange({ from: e.target.value })} />
          </Form.Group>
          <Form.Group controlId="stat-to" className="flex-grow-1">
            <Form.Label className="small text-muted mb-1">Au</Form.Label>
            <Form.Control type="date" value={params.to ?? ''} onChange={(e) => onChange({ to: e.target.value })} />
          </Form.Group>
        </div>
      )}

      {offers('granularity') && (
        <>
          <Form.Label className="fw-semibold mt-3 mb-2 d-block">Granularité</Form.Label>
          <ButtonGroup className="w-100" role="radiogroup" aria-label="Granularité">
            {GRANULARITY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={(params.granularity || 'week') === option.value ? 'primary' : 'outline-primary'}
                role="radio"
                aria-checked={(params.granularity || 'week') === option.value}
                onClick={() => onChange({ granularity: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        </>
      )}

      {offers('order') && (
        <>
          <Form.Label className="fw-semibold mt-3 mb-2 d-flex align-items-center">
            Classement
            <HelpTip id="stat-order-help" title="Classement">
              Par semaine : frelons capturés par semaine de présence du piège, qui ne favorise pas les
              pièges posés plus tôt. Captures : le total de la période.
            </HelpTip>
          </Form.Label>
          <ButtonGroup className="w-100" role="radiogroup" aria-label="Classement">
            {ORDER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={(params.order || 'rate') === option.value ? 'primary' : 'outline-primary'}
                role="radio"
                aria-checked={(params.order || 'rate') === option.value}
                onClick={() => onChange({ order: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        </>
      )}

      <div className="d-grid gap-2 mt-3">
        {offers('trap_type') && (
          <Form.Group controlId="stat-trap-type">
            <Form.Label className="small text-muted mb-1">Type de piège</Form.Label>
            <Form.Select value={params.trap_type ?? ''} onChange={(e) => onChange({ trap_type: e.target.value })}>
              <option value="">Tous les types</option>
              {trapTypes.map((type) => <option key={type.slug} value={type.slug}>{type.name}</option>)}
            </Form.Select>
          </Form.Group>
        )}
        {offers('group') && groups.length > 0 && (
          <Form.Group controlId="stat-group">
            <Form.Label className="small text-muted mb-1">Groupe</Form.Label>
            <Form.Select value={params.group ?? ''} onChange={(e) => onChange({ group: e.target.value })}>
              <option value="">Tous les groupes</option>
              {groups.map((group) => <option key={group.path} value={group.path}>{group.label}</option>)}
            </Form.Select>
          </Form.Group>
        )}
        {offers('zone') && (
          <Form.Group controlId="stat-zone">
            <Form.Label className="small text-muted mb-1 d-flex align-items-center">
              Zone
              <HelpTip id="stat-zone-help" title="Zone">
                Un total limité à une zone pourrait révéler un piège privé, et donc un rucher :
                avec une zone, seuls les pièges que vous voyez sur la carte sont comptés.
              </HelpTip>
              {locating && <Spinner animation="border" size="sm" className="ms-2" />}
            </Form.Label>
            <Form.Select value={params.radius ?? ''} disabled={locating} onChange={(e) => void pickRadius(e.target.value)}>
              <option value="">Partout</option>
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={String(km)}>{km} km autour de ma position</option>
              ))}
            </Form.Select>
          </Form.Group>
        )}
      </div>
      {zoneError && <Alert variant="danger" className="small py-2 mt-2 mb-0">{zoneError}</Alert>}

      <div className="mt-3">
        {offers('mine') && (
          <Form.Check
            type="switch"
            id="stat-mine"
            className="stat-switch"
            label="Mes pièges seulement"
            checked={params.mine === 'true'}
            onChange={(e) => onChange({ mine: e.target.checked ? 'true' : '' })}
          />
        )}
        {offers('compare') && (
          <Form.Check
            type="switch"
            id="stat-compare"
            className="stat-switch"
            label="Comparer à l'année précédente"
            checked={params.compare !== 'false'}
            onChange={(e) => onChange({ compare: e.target.checked ? '' : 'false' })}
          />
        )}
      </div>
    </BottomSheet>
  );
}
