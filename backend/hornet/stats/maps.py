"""
Map statistics on a 250 m grid: the coverage of a territory by the traps
(`traps-coverage`) and the pressure of the Asian hornet (`traps-pressure`).

The grid lives in Belgian Lambert 2008 (EPSG:3812, metres), anchored on its
origin: a cell stays the same cell whatever the part of the map asked for.
The area studied is the zone filter (a circle), else the map view (`bbox`);
cells are clipped to it. Both statistics locate traps, so they only ever count
the traps the requester can see on the map (see base.py).
"""

import json
import math

from django.db import connection
from django.utils import timezone

from ..models import Trap
from .base import MAX_RADIUS_KM, Statistic, StatError, register, select_traps
from .confidence import poisson_interval
from .exposure import load_readings, tally, traps_in_service
from .periods import PeriodError, resolve_period
from .traps import _warnings

SRID = 3812
CELL = 250  # metres
MAX_CELLS = 10000
REACHES = (100, 250, 500)
BANDWIDTHS = (100, 250, 500)
# Below that effort around a cell (trap-days, kernel-weighted), no pressure
MIN_EFFORT_DAYS = 7
# Class limits of the pressure, Asian hornets per trap and per week
PRESSURE_BINS = [0.1, 0.25, 0.5, 1, 2]
WEEK = 7


def _number(value: str, message: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise StatError(message)
    if not math.isfinite(number):
        raise StatError(message)
    return number


ZONE_KEYS = ('lat', 'lon', 'radius')


def _area_sql(params):
    """SQL of the area studied (EPSG:3812), its arguments, and its kind."""
    if any(params.get(key) for key in ZONE_KEYS):
        lat = _number(params.get('lat'), "Zone : latitude invalide.")
        lon = _number(params.get('lon'), "Zone : longitude invalide.")
        radius = _number(params.get('radius'), "Zone : rayon invalide.")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise StatError("Zone : position hors limites.")
        if not 0 < radius <= MAX_RADIUS_KM:
            raise StatError(f"Zone : rayon de {MAX_RADIUS_KM} km au plus.")
        sql = f"ST_Buffer(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), {SRID}), %s, 32)"
        return sql, [lon, lat, radius * 1000], 'zone'
    bbox = params.get('bbox')
    if not bbox:
        raise StatError("Indiquez une zone ou l'emprise de la carte.")
    parts = str(bbox).split(',')
    if len(parts) != 4:
        raise StatError("Emprise invalide (ouest,sud,est,nord).")
    west, south, east, north = (_number(p, "Emprise invalide.") for p in parts)
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise StatError("Emprise invalide.")
    sql = f"ST_Transform(ST_MakeEnvelope(%s, %s, %s, %s, 4326), {SRID})"
    return sql, [west, south, east, north], 'bbox'


def _choice(params, name, allowed, default):
    raw = params.get(name) or default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise StatError(f"Valeur invalide : {name}.")
    if value not in allowed:
        raise StatError(f"{name} : {', '.join(map(str, allowed))} m.")
    return value


class MapStatistic(Statistic):
    """Common part of the grid statistics."""
    filters = ('period', 'trap_type', 'group', 'mine', 'zone')
    kind = 'map'

    def _prepare(self, params, scope, today, reach_m):
        try:
            period = resolve_period(params, today)
        except PeriodError as exc:
            raise StatError(str(exc))
        area_sql, area_args, area_kind = _area_sql(params)
        # The area is applied below with the reach of the traps: a trap just
        # outside a zone still covers its edge
        selection = select_traps({k: v for k, v in params.items() if k not in ZONE_KEYS},
                                 scope, always_localized=True)
        if area_kind == 'zone':
            selection.filters.append(f"Zone : {float(params['radius']):g} km")

        with connection.cursor() as cursor:
            cursor.execute(f"SELECT ST_Area({area_sql})", area_args)
            area = cursor.fetchone()[0] or 0.0
        if area / (CELL * CELL) > MAX_CELLS:
            limit = MAX_CELLS * CELL * CELL / 1e6
            raise StatError(f"Zone trop grande : zoomez ({limit:.0f} km² au plus).", status=422)

        candidates = {row[0]: (row[1], row[2]) for row in
                      selection.queryset.values_list('id', 'installed_at', 'active')}
        # Traps near enough to matter, then those in service during the period
        near = self._near(list(candidates), area_sql, area_args, reach_m)
        in_service = traps_in_service({i: candidates[i] for i in near}, period.start_dt, period.end_dt)
        return period, selection, area_sql, area_args, area_kind, area, near, in_service

    @staticmethod
    def _near(ids, area_sql, area_args, distance):
        if not ids:
            return {}
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH area AS (SELECT {area_sql} AS g)
                SELECT t.id, ST_X(ST_Transform(t.point::geometry, {SRID})), ST_Y(ST_Transform(t.point::geometry, {SRID})),
                       ST_Y(t.point::geometry), ST_X(t.point::geometry), ST_Within(ST_Transform(t.point::geometry, {SRID}), area.g)
                FROM hornet_trap t, area
                WHERE t.id = ANY(%s) AND ST_DWithin(ST_Transform(t.point::geometry, {SRID}), area.g, %s)
                """, area_args + [ids, distance])
            return {row[0]: {'x': row[1], 'y': row[2], 'lat': row[3], 'lon': row[4], 'inside': row[5]}
                    for row in cursor.fetchall()}

    @staticmethod
    def _cells(area_sql, area_args):
        """Cells of the grid over the area, clipped to it: GeoJSON, centre, area."""
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH area AS (SELECT {area_sql} AS g),
                cells AS (
                    SELECT c.i, c.j, ST_Intersection(c.geom, area.g) AS g
                    FROM area, ST_SquareGrid({CELL}, area.g) AS c
                    WHERE ST_Intersects(c.geom, area.g)
                )
                SELECT cells.i, cells.j,
                       ST_AsGeoJSON(ST_Transform(cells.g, 4326), 6),
                       ST_X(ST_Centroid(cells.g)), ST_Y(ST_Centroid(cells.g)),
                       ST_Y(ST_Transform(ST_Centroid(cells.g), 4326)),
                       ST_X(ST_Transform(ST_Centroid(cells.g), 4326)),
                       ST_Area(cells.g)
                FROM cells
                WHERE ST_Area(cells.g) > 0
                """, area_args)
            return cursor.fetchall()

    def _base(self, period, selection, area_kind, area, near, in_service) -> dict:
        inside = [i for i in in_service if near[i]['inside']]
        scope = {'kind': 'visible', 'label': 'Pièges visibles par vous', 'traps': len(inside)}
        return {
            'statistic': {'id': self.id, 'title': self.title},
            'kind': self.kind,
            'period': period.as_dict(),
            'previous': None,
            'granularity': None,
            'filters': selection.filters,
            'scope': scope,
            'area': {'kind': area_kind, 'km2': round(area / 1e6, 3)},
            'traps': [[round(near[i]['lat'], 5), round(near[i]['lon'], 5)] for i in sorted(in_service)],
            'computed_at': timezone.now().isoformat(),
        }


def _bucket(points, size) -> dict:
    """Points (x, y, ...) by squares of `size`, to visit only the close ones."""
    buckets = {}
    for point in points:
        buckets.setdefault((int(point[0] // size), int(point[1] // size)), []).append(point)
    return buckets


def _close(buckets, x, y, size):
    bx, by = int(x // size), int(y // size)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            yield from buckets.get((bx + dx, by + dy), ())


def _feature(geometry: str, properties: dict) -> dict:
    return {'type': 'Feature', 'geometry': json.loads(geometry), 'properties': properties}


@register
class TrapsCoverage(MapStatistic):
    id = 'traps-coverage'
    title = 'Couverture du territoire'
    description = "Part de la zone à portée d'un piège en service pendant la période."
    filters = MapStatistic.filters + ('reach',)

    COLUMNS = [
        {'key': 'lat', 'label': 'Latitude (centre)', 'type': 'float', 'decimals': 5},
        {'key': 'lon', 'label': 'Longitude (centre)', 'type': 'float', 'decimals': 5},
        {'key': 'covered', 'label': 'Part couverte', 'type': 'percent'},
        {'key': 'traps', 'label': 'Pièges à portée du centre', 'type': 'int'},
    ]

    @staticmethod
    def _covered_cells(area_sql, area_args, ids, reach):
        """
        Covered cells only, with the area the discs of the traps cover in each.
        A trap is paired with the cells around its own (grid indices are
        floor(x / CELL), floor(y / CELL)), so each cell meets only the discs
        within reach, and each disc is cut to the cell before the union:
        testing every cell against every trap took minutes on a town,
        intersecting each cell with a union of whole discs several seconds.
        """
        span = math.ceil(reach / CELL)
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH area AS (SELECT {area_sql} AS g),
                traps AS MATERIALIZED (
                    SELECT ST_Transform(t.point::geometry, {SRID}) AS g
                    FROM hornet_trap t WHERE t.id = ANY(%s)
                ),
                cells AS MATERIALIZED (
                    SELECT c.i, c.j, ST_Intersection(c.geom, area.g) AS g
                    FROM area, ST_SquareGrid({CELL}, area.g) AS c
                    WHERE ST_Intersects(c.geom, area.g)
                ),
                pairs AS (
                    SELECT cells.i, cells.j, cells.g AS cell,
                           ST_Intersection(cells.g, ST_Buffer(traps.g, %s, 16)) AS piece
                    FROM traps
                    CROSS JOIN generate_series(-%s, %s) AS dx
                    CROSS JOIN generate_series(-%s, %s) AS dy
                    JOIN cells ON cells.i = floor(ST_X(traps.g) / {CELL})::int + dx
                              AND cells.j = floor(ST_Y(traps.g) / {CELL})::int + dy
                    WHERE ST_DWithin(traps.g, cells.g, %s)
                ),
                covered AS (
                    -- The cell rides along: joining back to `cells` makes the
                    -- planner loop over every cell for every covered one
                    SELECT i, j, (array_agg(cell))[1] AS g, ST_Area(ST_Union(piece)) AS area
                    FROM pairs GROUP BY i, j
                )
                SELECT i, j, ST_AsGeoJSON(ST_Transform(g, 4326), 6),
                       ST_X(ST_Centroid(g)), ST_Y(ST_Centroid(g)),
                       ST_Y(ST_Transform(ST_Centroid(g), 4326)),
                       ST_X(ST_Transform(ST_Centroid(g), 4326)),
                       ST_Area(g), area
                FROM covered
                WHERE ST_Area(g) > 0
                """, area_args + [ids, reach, span, span, span, span, reach])
            return cursor.fetchall()

    def compute(self, params, scope, today=None) -> dict:
        reach = _choice(params, 'reach', REACHES, 250)
        (period, selection, area_sql, area_args, area_kind, area,
         near, in_service) = self._prepare(params, scope, today, reach)
        ids = sorted(in_service)
        rows = self._covered_cells(area_sql, area_args, ids, reach) if ids else []

        buckets = _bucket([(near[t]['x'], near[t]['y']) for t in ids], reach)
        features, table = [], []
        covered_area = 0.0
        for i, j, geometry, x, y, lat, lon, cell_area, cover_area in rows:
            if cover_area <= 0:
                continue
            covered_area += cover_area
            share = min(1.0, cover_area / cell_area)
            count = sum(1 for tx, ty in _close(buckets, x, y, reach)
                        if (tx - x) ** 2 + (ty - y) ** 2 <= reach * reach)
            features.append(_feature(geometry, {'id': f'{i}:{j}', 'covered': round(share, 3),
                                                'traps': count}))
            table.append({'lat': round(lat, 5), 'lon': round(lon, 5), 'covered': round(share, 4),
                          'traps': count})

        inside = sum(1 for t in ids if near[t]['inside'])
        area_km2 = area / 1e6
        summary = {
            'coverage': round(covered_area / area, 4) if area else None,
            'covered_km2': round(covered_area / 1e6, 3),
            'traps': inside,
            'density': round(inside / area_km2, 2) if area_km2 else None,
            'reach': reach,
        }
        return {
            **self._base(period, selection, area_kind, area, near, in_service),
            'parameters': {'reach': reach, 'cell': CELL},
            'summary': summary,
            'cells': {'type': 'FeatureCollection', 'features': features},
            'columns': self.COLUMNS,
            'rows': table,
            'totals': {'lat': None, 'lon': None, 'covered': summary['coverage'], 'traps': inside},
            'notes': [("Rayon d'action supposé", f"{reach} m (hypothèse de travail, pas une mesure)"),
                      ('Maille', f'{CELL} m, Lambert belge 2008 (EPSG:{SRID})'),
                      ('Surface étudiée', f'{area_km2:.2f} km²')],
            'warnings': [],
        }


@register
class TrapsPressure(MapStatistic):
    id = 'traps-pressure'
    title = 'Carte de pression'
    description = 'Frelons asiatiques par piège et par semaine, lissés sur la carte.'
    filters = MapStatistic.filters + ('bandwidth',)

    COLUMNS = [
        {'key': 'lat', 'label': 'Latitude (centre)', 'type': 'float', 'decimals': 5},
        {'key': 'lon', 'label': 'Longitude (centre)', 'type': 'float', 'decimals': 5},
        {'key': 'rate', 'label': 'Frelons par piège et par semaine (lissé)', 'type': 'float', 'decimals': 2},
        {'key': 'effort', 'label': 'Effort pondéré (pièges-jours)', 'type': 'float', 'decimals': 1},
        {'key': 'hornets', 'label': 'Frelons pondérés', 'type': 'float', 'decimals': 1},
    ]

    def compute(self, params, scope, today=None) -> dict:
        bandwidth = _choice(params, 'bandwidth', BANDWIDTHS, 250)
        reach = 3 * bandwidth
        (period, selection, area_sql, area_args, area_kind, area,
         near, in_service) = self._prepare(params, scope, today, reach)

        trap_types = dict(Trap.objects.filter(id__in=in_service).values_list('id', 'trap_type_id'))
        readings = load_readings(trap_types, period.start_dt, period.end_dt)
        per_trap = tally(readings, [(period.start_dt, period.end_dt)], key=lambda r: r.trap_id)[0]
        sources = [(near[t]['x'], near[t]['y'], per_trap[t].hornets, per_trap[t].trap_days)
                   for t in per_trap if t in near]

        buckets = _bucket(sources, reach)
        two_h2 = 2 * bandwidth * bandwidth

        features, table = [], []
        for i, j, geometry, x, y, lat, lon, _ in (self._cells(area_sql, area_args) if sources else []):
            effort = weighted = 0.0
            for sx, sy, hornets, days in _close(buckets, x, y, reach):
                d2 = (sx - x) ** 2 + (sy - y) ** 2
                if d2 > reach * reach:
                    continue
                w = math.exp(-d2 / two_h2)
                effort += w * days
                weighted += w * hornets
            if effort < MIN_EFFORT_DAYS:
                continue
            value = weighted / effort * WEEK
            level = sum(1 for limit in PRESSURE_BINS if value >= limit)
            features.append(_feature(geometry, {
                'id': f'{i}:{j}', 'rate': round(value, 3), 'level': level,
                'effort': round(effort, 1), 'hornets': round(weighted, 1)}))
            table.append({'lat': round(lat, 5), 'lon': round(lon, 5), 'rate': round(value, 3),
                          'effort': round(effort, 1), 'hornets': round(weighted, 1)})

        inside = [t for t in per_trap if t in near and near[t]['inside']]
        hornets = sum(per_trap[t].hornets for t in inside)
        days = sum(per_trap[t].trap_days for t in inside)
        rate = low = high = None
        if days > 0:
            lo, hi = poisson_interval(hornets)
            rate, low, high = hornets / days * WEEK, lo / days * WEEK, hi / days * WEEK
        summary = {
            'rate': None if rate is None else round(rate, 3),
            'rate_low': None if low is None else round(low, 3),
            'rate_high': None if high is None else round(high, 3),
            'hornets': round(hornets, 2), 'trap_days': round(days, 2),
            'traps': sum(1 for t in in_service if near[t]['inside']),
            'bandwidth': bandwidth,
        }
        return {
            **self._base(period, selection, area_kind, area, near, in_service),
            'parameters': {'bandwidth': bandwidth, 'cell': CELL, 'min_effort_days': MIN_EFFORT_DAYS},
            'summary': summary,
            'bins': PRESSURE_BINS,
            'cells': {'type': 'FeatureCollection', 'features': features},
            'columns': self.COLUMNS,
            'rows': table,
            'totals': {'lat': None, 'lon': None, 'rate': summary['rate'],
                       'effort': summary['trap_days'], 'hornets': summary['hornets']},
            'notes': [('Lissage', f'noyau gaussien de {bandwidth} m'),
                      ('Effort minimal', f'{MIN_EFFORT_DAYS} pièges-jours pondérés autour d\'une maille'),
                      ('Maille', f'{CELL} m, Lambert belge 2008 (EPSG:{SRID})'),
                      ('Surface étudiée', f'{area / 1e6:.2f} km²')],
            'warnings': _warnings(period, readings),
        }
