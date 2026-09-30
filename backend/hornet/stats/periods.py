"""
Periods of the statistics: presets resolved to calendar dates, and the time
buckets (day, ISO week, month) a period is split into.

Dates are local to Europe/Brussels (settings.TIME_ZONE). A period covers
whole days, `start` and `end` included; its datetimes run from local midnight
of `start` to local midnight after `end`.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

LOCAL = ZoneInfo(settings.TIME_ZONE)

MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
          'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
               'Septembre', 'Octobre', 'Novembre', 'Décembre']

# (label, first day, last day) of each season, as (month, day)
SEASONS = {
    'spring': ('Printemps', (2, 1), (6, 15)),
    'summer': ('Été', (6, 16), (9, 30)),
    'late': ('Été-automne-hiver', (6, 16), (12, 31)),
}
PERIODS = ('d7', 'd30', 'month', 'season', 'year', 'custom')
GRANULARITIES = ('day', 'week', 'month')

# Longest custom period, and so the most buckets a table can have
MAX_SPAN_DAYS = 3 * 366
FIRST_YEAR = 2020
# The project started in 2025: nothing to archive before
ARCHIVE_FIRST_YEAR = 2025


class PeriodError(ValueError):
    """A period parameter that cannot be resolved; the message is for the UI."""


def local_today() -> date:
    return timezone.localdate(timezone=LOCAL)


def local_midnight(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LOCAL)


def format_day(day: date, with_year: bool = False) -> str:
    text = f"{day.day} {MONTHS[day.month - 1]}"
    return f"{text} {day.year}" if with_year else text


def format_range(start: date, end: date, with_year: bool = True) -> str:
    """`9–15 févr.`, `30 mars – 5 avr.`, with the year when asked."""
    suffix = f" {end.year}" if with_year else ''
    if start == end:
        return format_day(start) + suffix
    if start.year != end.year:
        return f"{format_day(start, True)} – {format_day(end, True)}"
    if start.month == end.month:
        return f"{start.day}–{end.day} {MONTHS[end.month - 1]}{suffix}"
    return f"{format_day(start)} – {format_day(end)}{suffix}"


def shift_year(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year + years)
    except ValueError:  # 29 February
        return day.replace(year=day.year + years, day=28)


@dataclass(frozen=True)
class Period:
    key: str
    start: date
    end: date
    label: str
    season: str = ''
    year: int = 0

    @property
    def start_dt(self) -> datetime:
        return local_midnight(self.start)

    @property
    def end_dt(self) -> datetime:
        """Exclusive end: midnight after the last day."""
        return local_midnight(self.end + timedelta(days=1))

    def previous_year(self) -> 'Period':
        start, end = shift_year(self.start, -1), shift_year(self.end, -1)
        if self.key == 'season':
            label = f"{SEASONS[self.season][0]} {self.year - 1}"
        elif self.key == 'year':
            label = f"Année {self.year - 1}"
        else:
            label = format_range(start, end)
        return Period(self.key, start, end, label, self.season, self.year - 1 if self.year else 0)

    def as_dict(self) -> dict:
        return {
            'key': self.key, 'label': self.label, 'dates': format_range(self.start, self.end),
            'start': self.start.isoformat(), 'end': self.end.isoformat(),
            'season': self.season or None, 'year': self.year or None,
        }


def _year(params, today: date) -> int:
    raw = params.get('year') or today.year
    try:
        year = int(raw)
    except (TypeError, ValueError):
        raise PeriodError("Année invalide.")
    if not FIRST_YEAR <= year <= today.year:
        raise PeriodError(f"Année hors limites ({FIRST_YEAR} à {today.year}).")
    return year


def _date(params, name: str) -> date:
    try:
        return date.fromisoformat(params.get(name) or '')
    except ValueError:
        raise PeriodError("Dates libres : indiquez un début et une fin (AAAA-MM-JJ).")


def resolve_period(params, today: date | None = None) -> Period:
    """
    The period asked by `params` (`period`, plus `season`, `year`, `from`,
    `to` as needed), in calendar dates. A period still running stops today:
    a table never shows days that have not happened yet.
    """
    today = today or local_today()
    key = params.get('period') or 'season'
    if key not in PERIODS:
        raise PeriodError(f"Période inconnue : {key}.")

    season, year = '', 0
    if key == 'd7':
        start, end, label = today - timedelta(days=6), today, '7 derniers jours'
    elif key == 'd30':
        start, end, label = today - timedelta(days=29), today, '30 derniers jours'
    elif key == 'month':
        start, end = today.replace(day=1), today
        label = f"{MONTH_NAMES[today.month - 1]} {today.year}"
    elif key == 'season':
        season = params.get('season') or 'spring'
        if season not in SEASONS:
            raise PeriodError(f"Saison inconnue : {season}.")
        year = _year(params, today)
        name, (m1, d1), (m2, d2) = SEASONS[season]
        start, end, label = date(year, m1, d1), date(year, m2, d2), f"{name} {year}"
    elif key == 'year':
        year = _year(params, today)
        start, end, label = date(year, 1, 1), date(year, 12, 31), f"Année {year}"
    else:
        start, end = _date(params, 'from'), _date(params, 'to')
        if end < start:
            raise PeriodError("Dates libres : la fin précède le début.")
        if (end - start).days > MAX_SPAN_DAYS:
            raise PeriodError("Dates libres : trois ans au plus.")
        label = format_range(start, end)

    if start > today:
        raise PeriodError("Cette période n'a pas encore commencé.")
    end = min(end, today)
    return Period(key, start, end, label, season, year)


def resolve_archive_period(params, today: date | None = None) -> Period:
    """
    The whole season (`period=season` + `season`) or year (`period=year`, the
    default) of `year` that `params` ask to archive, with the same bounds as
    the statistics' periods but never clipped to today: only a period that is
    over can be archived, so an object still to come cannot slip in.
    """
    today = today or local_today()
    key = params.get('period') or 'year'
    if key not in ('season', 'year'):
        raise PeriodError("Seuls une saison ou une année peuvent être archivées.")
    try:
        year = int(params.get('year') or '')
    except ValueError:
        raise PeriodError("Année invalide.")
    if not ARCHIVE_FIRST_YEAR <= year <= today.year:
        raise PeriodError(f"Année hors limites ({ARCHIVE_FIRST_YEAR} à {today.year}).")

    season = ''
    if key == 'season':
        season = params.get('season') or ''
        if season not in SEASONS:
            raise PeriodError(f"Saison inconnue : {season}.")
        name, (m1, d1), (m2, d2) = SEASONS[season]
        start, end, label = date(year, m1, d1), date(year, m2, d2), f"{name} {year}"
    else:
        start, end, label = date(year, 1, 1), date(year, 12, 31), f"Année {year}"
    if end >= today:
        raise PeriodError("Cette période n'est pas terminée.")
    return Period(key, start, end, label, season, year)


@dataclass(frozen=True)
class Bucket:
    key: str        # 'S14', '2026-04-12', 'avr. 2026'
    dates: str      # the days it covers, clipped to the period
    start: date
    end: date       # inclusive

    @property
    def start_dt(self) -> datetime:
        return local_midnight(self.start)

    @property
    def end_dt(self) -> datetime:
        return local_midnight(self.end + timedelta(days=1))


def buckets(period: Period, granularity: str) -> list:
    """Split `period` into days, ISO weeks or months, clipped to its bounds."""
    if granularity not in GRANULARITIES:
        raise PeriodError(f"Granularité inconnue : {granularity}.")
    result = []
    day = period.start
    while day <= period.end:
        if granularity == 'day':
            last = day
            key = day.isoformat()
        elif granularity == 'week':
            last = day + timedelta(days=6 - day.weekday())
            key = f"S{day.isocalendar().week:02d}"
        else:
            following = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
            last = following - timedelta(days=1)
            key = f"{MONTHS[day.month - 1]} {day.year}"
        last = min(last, period.end)
        result.append(Bucket(key, format_range(day, last, with_year=False), day, last))
        day = last + timedelta(days=1)
    return result


# Periods that slide with the calendar
RELATIVE_PERIODS = ('d7', 'd30', 'month')


def freeze_period(params: dict, today: date | None = None) -> dict:
    """`params` with a sliding period (last 7 days...) turned into its dates,
    so a link used later still covers the days that were asked for."""
    if params.get('period') not in RELATIVE_PERIODS:
        return dict(params)
    period = resolve_period(params, today)
    frozen = {key: value for key, value in params.items() if key not in ('from', 'to')}
    frozen.update(period='custom', **{'from': period.start.isoformat(), 'to': period.end.isoformat()})
    return frozen
