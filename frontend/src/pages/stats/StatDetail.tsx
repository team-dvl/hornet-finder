import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Container, Spinner } from 'react-bootstrap';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { IconButton } from '../../components/ui';
import CatchesView from '../../components/stats/CatchesView';
import MapStatView from '../../components/stats/MapStatView';
import type { GridState } from '../../components/stats/StatGridOverlay';
import StatExportSheet from '../../components/stats/StatExportSheet';
import StatFiltersSheet from '../../components/stats/StatFiltersSheet';
import TrapRankingView from '../../components/stats/TrapRankingView';
import TrapSpeciesView from '../../components/stats/TrapSpeciesView';
import TrapTypesView from '../../components/stats/TrapTypesView';
import {
  filterableGroups, GRANULARITY_OPTIONS, ORDER_OPTIONS, readParams, writeParams,
} from '../../components/stats/statParams';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchTrapTypes, selectTrapTypes } from '../../store/store';
import { ACTION_ICONS } from '../../utils/icons';
import {
  fetchStat, fetchStatCatalogue, StatsError, type StatDescription, type StatParams, type StatResult,
} from '../../utils/statsApi';

/** The catalogue, read once per session: it only changes with a deployment */
let cataloguePromise: Promise<StatDescription[]> | null = null;
function loadCatalogue() {
  cataloguePromise ??= fetchStatCatalogue().catch((error) => {
    cataloguePromise = null;
    throw error;
  });
  return cataloguePromise;
}

/** Views of the table statistics: a list, or charts (`view=chart` in the URL) */
const VIEWS: Record<string, (props: { result: StatResult; chart?: boolean }) => React.ReactElement> = {
  'traps-catches': CatchesView,
  'traps-species': TrapSpeciesView,
  'trap-types': TrapTypesView,
  'traps-ranking': TrapRankingView,
};

/** Statistics drawn on a map: they load their own cells, view by view */
const MAP_STATS = new Set(['traps-coverage', 'traps-pressure']);

type Loaded = { key: string; result?: StatResult; error?: string };

/**
 * One statistic: its filters (kept in the URL, so a link shows the same
 * table), the traps it counts, its warnings and its table.
 */
export default function StatDetail() {
  const { statId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const trapTypes = useAppSelector(selectTrapTypes);
  const { groups: membership } = useUserPermissions();

  const [description, setDescription] = useState<StatDescription | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ key: '' });
  const [sheet, setSheet] = useState<'filters' | 'export' | null>(null);
  const [grid, setGrid] = useState<GridState | null>(null);
  const isMap = MAP_STATS.has(statId);

  const params = useMemo(() => readParams(searchParams), [searchParams]);
  // How the table is shown is not a parameter of the statistic: never sent to the API
  const chart = searchParams.get('view') === 'chart';
  const requestKey = `${statId}?${writeParams(params)}`;
  const groups = useMemo(() => filterableGroups(membership), [membership]);

  useEffect(() => {
    let cancelled = false;
    loadCatalogue()
      .then((catalogue) => { if (!cancelled) setDescription(catalogue.find((s) => s.id === statId) ?? null); })
      .catch((e: unknown) => { if (!cancelled) setCatalogueError(e instanceof StatsError ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [statId]);

  useEffect(() => {
    if (trapTypes.length === 0) dispatch(fetchTrapTypes());
  }, [trapTypes.length, dispatch]);

  useEffect(() => {
    if (MAP_STATS.has(statId)) return undefined;
    let cancelled = false;
    fetchStat(statId, params)
      .then((result) => { if (!cancelled) setLoaded({ key: requestKey, result }); })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ key: requestKey, error: e instanceof StatsError ? e.message : String(e) });
      });
    return () => { cancelled = true; };
    // `params` is derived from the URL, as is `requestKey`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = isMap ? Boolean(grid?.loading) : loaded.key !== requestKey;
  const result = isMap ? grid?.result : loaded.result;
  // The file of a map covers the view on screen
  const gridBbox = grid?.bbox;
  const exportParams = useMemo(
    () => (isMap && gridBbox ? { ...params, bbox: gridBbox } : params),
    [isMap, gridBbox, params],
  );

  const update = useCallback((changes: StatParams) => {
    const next = { ...params, ...changes };
    // Free dates start from the period on screen rather than from nothing
    if (changes.period === 'custom' && !next.from && result) {
      next.from = result.period.start;
      next.to = result.period.end;
    }
    const search = new URLSearchParams(writeParams(next));
    if (chart) search.set('view', 'chart');
    const text = search.toString();
    navigate({ search: text ? `?${text}` : '' }, { replace: true });
  }, [params, navigate, result, chart]);

  const showChart = useCallback((on: boolean) => {
    const search = new URLSearchParams(writeParams(params));
    if (on) search.set('view', 'chart');
    navigate({ search: `?${search.toString()}` }, { replace: true });
  }, [params, navigate]);

  const chips = useMemo(() => {
    const list: string[] = [result?.period.label ?? '…'];
    if (description?.filters.includes('granularity')) {
      list.push(GRANULARITY_OPTIONS.find((o) => o.value === (params.granularity || 'week'))?.chip ?? '');
    }
    if (description?.filters.includes('order')) {
      list.push(ORDER_OPTIONS.find((o) => o.value === (params.order || 'rate'))?.chip ?? '');
    }
    if (params.trap_type) list.push(trapTypes.find((t) => t.slug === params.trap_type)?.name ?? params.trap_type);
    if (params.group) list.push(groups.find((g) => g.path === params.group)?.label ?? params.group);
    if (params.mine === 'true') list.push('Mes pièges');
    if (params.radius) list.push(`Zone : ${params.radius} km`);
    return list.filter(Boolean);
  }, [result, description, params, trapTypes, groups]);

  const View = VIEWS[statId] as (typeof VIEWS)[string] | undefined;
  const title = description?.title ?? result?.statistic.title ?? 'Statistique';

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader
          title={title}
          help={description?.description}
          actions={(
            <>
              <IconButton variant="outline-secondary" icon={ACTION_ICONS.filters} label="Filtres" onClick={() => setSheet('filters')} />
              <IconButton variant="outline-secondary" icon={ACTION_ICONS.export} label="Exporter" onClick={() => setSheet('export')} disabled={!result} />
            </>
          )}
        />
        {catalogueError && <Alert variant="danger">{catalogueError}</Alert>}

        <div className="d-flex flex-wrap gap-2 mb-2">
          {chips.map((chip) => (
            <Button key={chip} variant="outline-secondary" className="rounded-pill stat-chip" onClick={() => setSheet('filters')}>
              {chip}
            </Button>
          ))}
        </div>

        {result && (
          <div className="d-flex align-items-center small text-muted mb-2">
            {/* A map shows its trap count in its key figures */}
            {isMap ? result.scope.label : <>{result.scope.label}{'\u00a0'}: {result.scope.traps}</>}
            <HelpTip id="stat-scope-help" title="Pièges comptés">
              {result.scope.kind === 'all'
                ? 'Ces totaux ne situent aucun piège : ils comptent tous les pièges, y compris ceux réservés à un groupe. Avec une zone, seuls les pièges que vous voyez sur la carte seraient comptés.'
                : 'Un résultat limité à une zone situe les pièges, et donc souvent les ruchers : il ne compte que les pièges que vous voyez déjà sur la carte (publics, les vôtres, ceux de vos groupes).'}
            </HelpTip>
            {loading && <Spinner animation="border" size="sm" className="ms-2" />}
          </div>
        )}

        {!isMap && loaded.error && !loading && <Alert variant="danger">{loaded.error}</Alert>}
        {!isMap && !result && loading && <div className="text-center py-4"><Spinner animation="border" /></div>}

        {isMap && (
          <>
            {result?.warnings.map((warning) => (
              <Alert key={warning} variant="warning" className="small py-2">{warning}</Alert>
            ))}
            <MapStatView
              statId={statId as 'traps-coverage' | 'traps-pressure'}
              params={params}
              onParams={update}
              onState={setGrid}
            />
          </>
        )}

        {!isMap && result && (
          <div className={loading ? 'opacity-50' : undefined}>
            {result.warnings.map((warning) => (
              <Alert key={warning} variant="warning" className="small py-2">{warning}</Alert>
            ))}
            {View && (
              <ButtonGroup className="w-100 mb-3 stat-view-toggle" role="radiogroup" aria-label="Affichage">
                {[false, true].map((on) => (
                  <Button
                    key={String(on)}
                    variant={chart === on ? 'primary' : 'outline-primary'}
                    role="radio"
                    aria-checked={chart === on}
                    onClick={() => showChart(on)}
                  >
                    <i className={`bi ${on ? 'bi-bar-chart-line' : 'bi-list-ul'} me-2`} aria-hidden="true" />
                    {on ? 'Graphique' : 'Tableau'}
                  </Button>
                ))}
              </ButtonGroup>
            )}
            {View
              ? <View key={requestKey} result={result} chart={chart} />
              : <Alert variant="secondary">Statistique inconnue.</Alert>}
          </div>
        )}
      </Container>

      <StatFiltersSheet
        show={sheet === 'filters'}
        onHide={() => setSheet(null)}
        params={params}
        filters={description?.filters ?? []}
        onChange={update}
        trapTypes={trapTypes}
        groups={groups}
      />
      {sheet === 'export' && (
        <StatExportSheet
          onHide={() => setSheet(null)}
          statId={statId}
          params={exportParams}
          exports={description?.exports ?? ['xlsx', 'csv']}
          emailLink={Boolean(description?.email_link)}
        />
      )}
    </PageLayout>
  );
}
