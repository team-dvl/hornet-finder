import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { IconButton } from '../../components/ui';
import CatchesView from '../../components/stats/CatchesView';
import StatExportSheet from '../../components/stats/StatExportSheet';
import StatFiltersSheet from '../../components/stats/StatFiltersSheet';
import TrapTypesView from '../../components/stats/TrapTypesView';
import {
  filterableGroups, GRANULARITY_OPTIONS, readParams, writeParams,
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

const VIEWS: Record<string, (props: { result: StatResult }) => React.ReactElement> = {
  'traps-catches': CatchesView,
  'trap-types': TrapTypesView,
};

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

  const params = useMemo(() => readParams(searchParams), [searchParams]);
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

  const loading = loaded.key !== requestKey;
  const result = loaded.result;

  const update = useCallback((changes: StatParams) => {
    const next = { ...params, ...changes };
    // Free dates start from the period on screen rather than from nothing
    if (changes.period === 'custom' && !next.from && result) {
      next.from = result.period.start;
      next.to = result.period.end;
    }
    const search = writeParams(next);
    navigate({ search: search ? `?${search}` : '' }, { replace: true });
  }, [params, navigate, result]);

  const chips = useMemo(() => {
    const list: string[] = [result?.period.label ?? '…'];
    if (description?.filters.includes('granularity')) {
      list.push(GRANULARITY_OPTIONS.find((o) => o.value === (params.granularity || 'week'))?.chip ?? '');
    }
    if (params.trap_type) list.push(trapTypes.find((t) => t.slug === params.trap_type)?.name ?? params.trap_type);
    if (params.group) list.push(groups.find((g) => g.path === params.group)?.label ?? params.group);
    if (params.mine === 'true') list.push('Mes pièges');
    if (params.radius) list.push(`Zone : ${params.radius} km`);
    return list.filter(Boolean);
  }, [result, description, params, trapTypes, groups]);

  const View = VIEWS[statId];
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
            {result.scope.label}{'\u00a0'}: {result.scope.traps}
            <HelpTip id="stat-scope-help" title="Pièges comptés">
              {result.scope.kind === 'all'
                ? 'Ces totaux ne situent aucun piège : ils comptent tous les pièges, y compris ceux réservés à un groupe. Avec une zone, seuls les pièges que vous voyez sur la carte seraient comptés.'
                : 'Un résultat limité à une zone situe les pièges, et donc souvent les ruchers : il ne compte que les pièges que vous voyez déjà sur la carte (publics, les vôtres, ceux de vos groupes).'}
            </HelpTip>
            {loading && <Spinner animation="border" size="sm" className="ms-2" />}
          </div>
        )}

        {loaded.error && !loading && <Alert variant="danger">{loaded.error}</Alert>}
        {!result && loading && <div className="text-center py-4"><Spinner animation="border" /></div>}

        {result && (
          <div className={loading ? 'opacity-50' : undefined}>
            {result.warnings.map((warning) => (
              <Alert key={warning} variant="warning" className="small py-2">{warning}</Alert>
            ))}
            {View ? <View result={result} /> : <Alert variant="secondary">Statistique inconnue.</Alert>}
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
      {sheet === 'export' && <StatExportSheet onHide={() => setSheet(null)} statId={statId} params={params} />}
    </PageLayout>
  );
}
