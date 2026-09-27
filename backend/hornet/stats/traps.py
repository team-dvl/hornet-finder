"""
Trapping statistics: Asian hornet catches over time (`traps-catches`) and the
comparison of the trap types (`trap-types`). Definitions in doc/STATISTICS.md.
"""

from statistics import median

from django.db.models import Min
from django.utils import timezone

from ..models import TrapEvent, TrapType
from .base import Statistic, StatError, register, select_traps
from .confidence import poisson_interval, wilson_interval
from .exposure import load_readings, tally
from .periods import GRANULARITIES, PeriodError, buckets, format_day, resolve_period

WEEK = 7
# Below that many insects counted, a selectivity is too uncertain to show
MIN_INSECTS_FOR_SELECTIVITY = 20
BUCKET_DAYS = {'day': 1, 'week': 7, 'month': 30}


def _round(value, digits):
    return None if value is None else round(value, digits)


def rate(tally_):
    """Asian hornets per trap and per week, with its 95 % interval."""
    if tally_.trap_days <= 0:
        return None, None, None
    low, high = poisson_interval(tally_.hornets)
    scale = WEEK / tally_.trap_days
    return tally_.hornets * scale, low * scale, high * scale


def _warnings(period, readings, granularity=None) -> list:
    warnings = []
    first = (TrapEvent.objects.filter(kind=TrapEvent.KIND_CATCH, bycatch_counted__isnull=False)
             .aggregate(first=Min('performed_at'))['first'])
    if first is None or period.start_dt < first:
        since = (f"avant le {format_day(timezone.localtime(first).date(), True)}"
                 if first else "jusqu'à la mise à jour du formulaire de relevé")
        warnings.append(
            f"Les relevés sans capture n'étaient pas enregistrés {since} : "
            "sur cette période, les frelons par piège sont surestimés.")
    if granularity:
        spans = [(r.end - r.start).total_seconds() / 86400 for r in readings
                 if r.start is not None and r.end > r.start]
        if spans and median(spans) > 1.5 * BUCKET_DAYS[granularity]:
            warnings.append(
                f"Les pièges sont relevés tous les {median(spans):.0f} jours en moyenne : "
                "les valeurs de chaque ligne sont réparties au prorata, pas mesurées.")
    return warnings


def _period(params, today):
    try:
        return resolve_period(params, today)
    except PeriodError as exc:
        raise StatError(str(exc))


def _trap_map(selection) -> dict:
    return dict(selection.queryset.values_list('id', 'trap_type_id'))


@register
class TrapCatches(Statistic):
    id = 'traps-catches'
    title = 'Captures de frelons asiatiques'
    description = 'Frelons asiatiques capturés, et rapportés au nombre de pièges en service.'
    filters = ('period', 'granularity', 'compare', 'trap_type', 'group', 'mine', 'zone')

    COLUMNS = [
        {'key': 'bucket', 'label': 'Période', 'type': 'text'},
        {'key': 'start', 'label': 'Du', 'type': 'date'},
        {'key': 'end', 'label': 'Au', 'type': 'date'},
        {'key': 'traps', 'label': 'Pièges actifs', 'type': 'int'},
        {'key': 'trap_days', 'label': 'Pièges-jours', 'type': 'float', 'decimals': 1},
        {'key': 'readings', 'label': 'Relevés', 'type': 'int'},
        {'key': 'hornets', 'label': 'Frelons asiatiques', 'type': 'float', 'decimals': 1},
        {'key': 'rate', 'label': 'Frelons par piège et par semaine', 'type': 'float', 'decimals': 2},
        {'key': 'rate_low', 'label': 'IC 95 % bas', 'type': 'float', 'decimals': 2},
        {'key': 'rate_high', 'label': 'IC 95 % haut', 'type': 'float', 'decimals': 2},
    ]
    PREVIOUS_COLUMN = {'key': 'previous_rate', 'label': 'Année précédente, par piège et par semaine',
                       'type': 'float', 'decimals': 2}

    @staticmethod
    def _align_key(granularity, index, bucket):
        if granularity == 'week':
            return bucket.key
        if granularity == 'month':
            return bucket.start.month
        return index

    @staticmethod
    def _series(period, granularity, readings):
        parts = buckets(period, granularity)
        tallies = tally(readings, [(b.start_dt, b.end_dt) for b in parts])
        whole = tally(readings, [(period.start_dt, period.end_dt)])[0]
        return parts, tallies, whole

    def compute(self, params, scope, today=None) -> dict:
        period = _period(params, today)
        granularity = params.get('granularity') or 'week'
        if granularity not in GRANULARITIES:
            raise StatError(f"Granularité inconnue : {granularity}.")
        compare = params.get('compare', 'true') not in ('false', '0')
        selection = select_traps(params, scope)
        trap_map = _trap_map(selection)

        previous = period.previous_year() if compare else None
        # One read of the journals for both years
        readings = load_readings(trap_map, (previous or period).start_dt, period.end_dt)
        parts, tallies, whole = self._series(period, granularity, readings)
        previous_whole = None
        previous_rates = {}
        if compare:
            p_parts, p_tallies, previous_whole = self._series(previous, granularity, readings)
            previous_rates = {self._align_key(granularity, i, b): rate(t)[0]
                              for i, (b, t) in enumerate(zip(p_parts, p_tallies))}

        rows = []
        for index, (part, t) in enumerate(zip(parts, tallies)):
            value, low, high = rate(t)
            row = {
                'bucket': part.key, 'dates': part.dates,
                'start': part.start.isoformat(), 'end': part.end.isoformat(),
                'traps': len(t.traps), 'trap_days': _round(t.trap_days, 2),
                'readings': t.readings, 'hornets': _round(t.hornets, 2),
                'rate': _round(value, 3), 'rate_low': _round(low, 3), 'rate_high': _round(high, 3),
            }
            if compare:
                row['previous_rate'] = _round(
                    previous_rates.get(self._align_key(granularity, index, part)), 3)
            rows.append(row)

        value, low, high = rate(whole)
        totals = {
            'traps': len(whole.traps), 'trap_days': _round(whole.trap_days, 2),
            'readings': whole.readings, 'hornets': _round(whole.hornets, 2),
            'rate': _round(value, 3), 'rate_low': _round(low, 3), 'rate_high': _round(high, 3),
            'peak_traps': max((len(t.traps) for t in tallies), default=0),
        }
        if compare:
            totals['previous_rate'] = _round(rate(previous_whole)[0], 3)
            totals['previous_hornets'] = _round(previous_whole.hornets, 2)

        return {
            'statistic': {'id': self.id, 'title': self.title},
            'period': period.as_dict(),
            'previous': previous.as_dict() if previous else None,
            'granularity': granularity,
            'filters': selection.filters,
            'scope': selection.scope_dict(),
            'columns': self.COLUMNS + ([self.PREVIOUS_COLUMN] if compare else []),
            'rows': rows,
            'totals': totals,
            'warnings': _warnings(period, [r for r in readings if r.end >= period.start_dt],
                                  granularity),
            'computed_at': timezone.now().isoformat(),
        }


@register
class TrapTypes(Statistic):
    id = 'trap-types'
    title = 'Types de piège'
    description = 'Efficacité et sélectivité de chaque modèle de piège sur la période.'
    filters = ('period', 'group', 'mine', 'zone')

    COLUMNS = [
        {'key': 'name', 'label': 'Type de piège', 'type': 'text'},
        {'key': 'traps', 'label': 'Pièges', 'type': 'int'},
        {'key': 'trap_days', 'label': 'Pièges-jours', 'type': 'float', 'decimals': 1},
        {'key': 'readings', 'label': 'Relevés', 'type': 'int'},
        {'key': 'hornets', 'label': 'Frelons asiatiques', 'type': 'float', 'decimals': 1},
        {'key': 'rate', 'label': 'Frelons par piège et par semaine', 'type': 'float', 'decimals': 2},
        {'key': 'rate_low', 'label': 'IC 95 % bas', 'type': 'float', 'decimals': 2},
        {'key': 'rate_high', 'label': 'IC 95 % haut', 'type': 'float', 'decimals': 2},
        {'key': 'counted_insects', 'label': 'Insectes comptés (toutes espèces)', 'type': 'int'},
        {'key': 'selectivity', 'label': 'Sélectivité', 'type': 'percent'},
        {'key': 'selectivity_low', 'label': 'IC 95 % bas', 'type': 'percent'},
        {'key': 'selectivity_high', 'label': 'IC 95 % haut', 'type': 'percent'},
    ]

    @staticmethod
    def _row(t) -> dict:
        value, low, high = rate(t)
        insects = int(round(t.counted_insects))
        selectivity = interval = None
        if insects >= MIN_INSECTS_FOR_SELECTIVITY:
            hornets = int(round(t.counted_hornets))
            selectivity = hornets / insects
            interval = wilson_interval(hornets, insects)
        return {
            'traps': len(t.traps), 'trap_days': _round(t.trap_days, 2),
            'readings': t.readings, 'hornets': _round(t.hornets, 2),
            'rate': _round(value, 3), 'rate_low': _round(low, 3), 'rate_high': _round(high, 3),
            'counted_insects': insects,
            'selectivity': _round(selectivity, 4),
            'selectivity_low': _round(interval[0], 4) if interval else None,
            'selectivity_high': _round(interval[1], 4) if interval else None,
        }

    def compute(self, params, scope, today=None) -> dict:
        period = _period(params, today)
        selection = select_traps(params, scope)
        trap_map = _trap_map(selection)
        readings = load_readings(trap_map, period.start_dt, period.end_dt)
        bounds = [(period.start_dt, period.end_dt)]
        per_type = tally(readings, bounds, key=lambda r: r.trap_type_id)[0]
        whole = tally(readings, bounds)[0]

        names = dict(TrapType.objects.filter(id__in=per_type).values_list('id', 'name'))
        slugs = dict(TrapType.objects.filter(id__in=per_type).values_list('id', 'slug'))
        rows = [{'slug': slugs[type_id], 'name': names[type_id], **self._row(t)}
                for type_id, t in per_type.items()]
        # Most catches per trap first; types without any effort last
        rows.sort(key=lambda row: (row['rate'] is None, -(row['rate'] or 0), row['name']))

        return {
            'statistic': {'id': self.id, 'title': self.title},
            'period': period.as_dict(),
            'previous': None,
            'granularity': None,
            'filters': selection.filters,
            'scope': selection.scope_dict(),
            'columns': self.COLUMNS,
            'rows': rows,
            'totals': {'name': 'Tous les types', **self._row(whole)},
            'warnings': _warnings(period, readings),
            'computed_at': timezone.now().isoformat(),
        }
