"""
Readings of the traps and the trapping effort behind them.

A reading is a visit where the capture zone was counted and emptied: the catch
events of one batch (a lone catch event on its own). Its catches accumulated
over its exposure interval, which runs from the previous reading or
installation of the trap to the reading itself; a removal ends the exposure.
A reading with no known start (the first one after a removal, or more than
`LOOK_AROUND` after the previous one: a forgotten trap) is kept as a point:
its catches count, with no effort.

Over a time bucket, a reading contributes the share of its catches and of its
exposure that falls inside the bucket, in proportion to time. Totals are exact;
a single bucket shorter than the interval between readings gets an average.
The effort (trap-days) is the observed exposure only: the time since the last
reading of a trap is not counted until its catches are.
"""

from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.contrib.postgres.aggregates import BoolOr
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from ..models import HORNET_SPECIES_SLUG, TrapEvent

# How far before the window a reading may start, and after it end
LOOK_AROUND = timedelta(days=180)
DAY = 86400.0


@dataclass
class Reading:
    trap_id: int
    trap_type_id: int
    start: datetime | None
    end: datetime
    hornets: int = 0
    insects: int = 0
    bycatch_counted: bool | None = None
    # {species slug: quantity}, loaded only when asked for (by_species)
    species: dict | None = None

    def __post_init__(self):
        # Timestamps, for the arithmetic of `tally`
        self.start_ts = self.start.timestamp() if self.start else None
        self.end_ts = self.end.timestamp()


def _species_rows(span):
    """One row per reading with the quantity of each species, in `species`."""
    rows = (TrapEvent.objects.filter(kind=TrapEvent.KIND_CATCH, **span)
            .order_by()
            .values('trap_id', 'performed_at', 'batch', 'species__slug')
            .annotate(quantity=Sum('quantity'), bycatch=BoolOr('bycatch_counted'))
            .values_list('trap_id', 'performed_at', 'batch', 'species__slug', 'quantity', 'bycatch'))
    readings = {}
    for tid, at, batch, slug, quantity, bycatch in rows:
        entry = readings.setdefault((tid, at, batch), {'species': {}, 'bycatch': None})
        entry['species'][slug] = entry['species'].get(slug, 0) + quantity
        if bycatch is not None:
            entry['bycatch'] = bool(entry['bycatch']) or bycatch
    for (tid, at, _), entry in readings.items():
        species = entry['species']
        yield tid, at, sum(species.values()), species.get(HORNET_SPECIES_SLUG, 0), entry['bycatch'], species


def load_readings(trap_types: dict, window_start: datetime, window_end: datetime,
                  by_species: bool = False) -> list:
    """
    Readings of the traps in `trap_types` ({trap id: trap type id}) whose
    exposure may touch [window_start, window_end). With `by_species`, each
    reading also carries the quantity of every species.
    """
    if not trap_types:
        return []
    span = {'trap_id__in': list(trap_types),
            'performed_at__gte': window_start - LOOK_AROUND,
            'performed_at__lt': window_end + LOOK_AROUND}
    # One row per reading, summed by the database. Lone catch events (no
    # batch) of a trap at the same instant make one reading, as they should.
    if by_species:
        catches = _species_rows(span)
    else:
        catches = ((*row, None) for row in (
            TrapEvent.objects.filter(kind=TrapEvent.KIND_CATCH, **span)
            .order_by()
            .values('trap_id', 'performed_at', 'batch')
            .annotate(insects=Sum('quantity'),
                      hornets=Coalesce(Sum('quantity',
                                           filter=Q(species__slug=HORNET_SPECIES_SLUG)), 0),
                      bycatch=BoolOr('bycatch_counted'))
            .values_list('trap_id', 'performed_at', 'insects', 'hornets', 'bycatch')))
    markers = (TrapEvent.objects
               .filter(kind__in=[TrapEvent.KIND_INSTALLATION, TrapEvent.KIND_REMOVAL], **span)
               .order_by().values_list('trap_id', 'performed_at', 'kind'))
    # At the same instant, the reading comes first: counted, then removed
    entries = [(tid, at, 0, (insects, hornets, bycatch, species))
               for tid, at, insects, hornets, bycatch, species in catches]
    entries += [(tid, at, 1, kind) for tid, at, kind in markers]
    entries.sort(key=lambda entry: entry[:3])

    readings = []
    trap_id = start = None
    for tid, at, rank, data in entries:
        if tid != trap_id:
            trap_id, start = tid, None
        if rank == 0:
            insects, hornets, bycatch, species = data
            readings.append(Reading(tid, trap_types[tid], start, at, hornets, insects, bycatch,
                                    species))
            start = at
        else:
            start = at if data == TrapEvent.KIND_INSTALLATION else None
    return [r for r in readings if r.end >= window_start and (r.start or r.end) < window_end]


@dataclass
class Tally:
    """What the readings bring to one time bucket (or to one group of traps)."""
    hornets: float = 0.0
    insects: float = 0.0
    # Readings where the other species were counted: for the selectivity
    counted_hornets: float = 0.0
    counted_insects: float = 0.0
    seconds: float = 0.0
    readings: int = 0
    traps: set = field(default_factory=set)
    # Per species, when the readings carry them: all, and on complete readings
    species: dict = field(default_factory=dict)
    counted_species: dict = field(default_factory=dict)

    @property
    def trap_days(self) -> float:
        return self.seconds / DAY

    def add(self, reading: Reading, share: float, seconds: float):
        self.hornets += reading.hornets * share
        self.insects += reading.insects * share
        if reading.bycatch_counted:
            self.counted_hornets += reading.hornets * share
            self.counted_insects += reading.insects * share
        for slug, quantity in (reading.species or {}).items():
            self.species[slug] = self.species.get(slug, 0.0) + quantity * share
            if reading.bycatch_counted:
                self.counted_species[slug] = self.counted_species.get(slug, 0.0) + quantity * share
        self.seconds += seconds
        if seconds > 0 or share > 0:
            self.traps.add(reading.trap_id)


def tally(readings, bounds: list, key=None) -> list:
    """
    Spread `readings` over the buckets `bounds` ([(start, end)] datetimes,
    sorted, contiguous). With `key`, return one dict {key(reading): Tally}
    per bucket instead of one Tally.
    """
    edges = [(b[0].timestamp(), b[1].timestamp()) for b in bounds]
    starts = [edge[0] for edge in edges]
    first_start, last_end = edges[0][0], edges[-1][1]
    result = [{} if key else Tally() for _ in bounds]

    def target(index, reading):
        if not key:
            return result[index]
        return result[index].setdefault(key(reading), Tally())

    for reading in readings:
        start, end = reading.start_ts, reading.end_ts
        if end <= first_start or (start if start is not None else end) >= last_end:
            continue
        inside = first_start <= end < last_end
        end_index = bisect_right(starts, end) - 1
        if inside:
            target(end_index, reading).readings += 1
        if start is None or start >= end:
            if inside:
                target(end_index, reading).add(reading, 1.0, 0.0)
            continue
        duration = end - start
        index = max(0, bisect_right(starts, start) - 1)
        while index < len(edges) and edges[index][0] < end:
            seconds = min(end, edges[index][1]) - max(start, edges[index][0])
            if seconds > 0:
                target(index, reading).add(reading, seconds / duration, seconds)
            index += 1
    return result


def traps_in_service(traps: dict, window_start: datetime, window_end: datetime) -> set:
    """
    Ids of the traps in service at some point of [window_start, window_end):
    from an installation to the next removal. `traps` maps each trap id to
    (installed_at date, active flag), the fallback of a journal without any
    installation (traps older than the journal).
    """
    from .periods import local_midnight

    if not traps:
        return set()
    events = (TrapEvent.objects
              .filter(trap_id__in=list(traps),
                      kind__in=[TrapEvent.KIND_INSTALLATION, TrapEvent.KIND_REMOVAL],
                      performed_at__lt=window_end)
              .order_by('trap_id', 'performed_at', 'id')
              .values_list('trap_id', 'kind', 'performed_at'))
    by_trap = {}
    for trap_id, kind, at in events:
        by_trap.setdefault(trap_id, []).append((kind, at))

    result = set()
    for trap_id, (installed_at, active) in traps.items():
        begin, spans = None, []
        journal = by_trap.get(trap_id, [])
        if not any(kind == TrapEvent.KIND_INSTALLATION for kind, _ in journal):
            # No installation recorded: in place since `installed_at`
            begin = local_midnight(installed_at)
        for kind, at in journal:
            if kind == TrapEvent.KIND_INSTALLATION:
                begin = begin or at
            elif begin is not None:
                spans.append((begin, at))
                begin = None
        if begin is not None and (active or journal):
            spans.append((begin, window_end))
        if any(start < window_end and end > window_start for start, end in spans):
            result.add(trap_id)
    return result
