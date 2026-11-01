"""
What a hive can hold, and the dated moves of the colonies.

A top-bar hive (TBH, Chandler) holds up to `max_bars` bars and, split by a
divider, two colonies. The divider takes the place of a bar: at position `d`,
compartment 1 holds bars 1..d-1 and compartment 2 bars d+1..max_bars. A Warré
counts boxes, without a maximum; a log hive counts nothing. A nucleus holds
one colony on its bars.
"""

from rest_framework.exceptions import ValidationError

from .models import Colony, ColonyOccupancy, HiveType


def is_topbar(hive) -> bool:
    return hive.hive_type.bar_family == HiveType.BAR_FAMILY_TOPBAR


def counts_bars(hive) -> bool:
    """Whether a colony of this hive has a count: bars (top bar) or boxes (Warré)."""
    return bool(hive.hive_type.bar_family)


def compartment_capacity(hive, compartment, divider=None):
    """Bars a compartment holds at most (None: no limit), with `divider` (default: the hive's)."""
    if not is_topbar(hive) or not hive.hive_type.max_bars:
        return None
    divider = hive.divider_bar if divider is None else divider
    total = hive.hive_type.max_bars
    if not divider:
        return total
    return divider - 1 if compartment == 1 else total - divider


def living(hive, exclude=None):
    queryset = Colony.objects.filter(hive=hive, ended_on__isnull=True)
    if exclude is not None:
        queryset = queryset.exclude(pk__in=[c.pk for c in exclude])
    return queryset


def check_place(hive, compartment, bars, *, exclude=(), divider=None, field='compartment'):
    """
    Refuse what `hive` cannot hold: a second compartment without a divider, a
    compartment already occupied, more bars than it has room for. `exclude`
    lists the colonies leaving the place in the same operation.
    """
    divider = hive.divider_bar if divider is None else divider
    if compartment not in (1, 2):
        raise ValidationError({field: "A compartment is 1 or 2."})
    if compartment == 2 and (hive.hive_type.max_colonies < 2 or not divider):
        raise ValidationError({field: "Only a hive split by a divider has a second compartment."})
    if living(hive, exclude).filter(compartment=compartment).exists():
        raise ValidationError({field: "This compartment already holds a colony."})
    if bars is not None and not counts_bars(hive):
        raise ValidationError({'bars': "This hive has no bars."})
    capacity = compartment_capacity(hive, compartment, divider)
    if bars is not None and capacity is not None and bars > capacity:
        raise ValidationError({'bars': f"At most {capacity} bars in this compartment."})


def check_divider(hive, divider):
    """A divider fits the bars of the colonies on each side; it goes only once one side is empty."""
    if divider is not None:
        if not is_topbar(hive) or hive.hive_type.max_colonies < 2:
            raise ValidationError({'divider_bar': "This hive takes no divider."})
        if not 2 <= divider <= hive.hive_type.max_bars - 1:
            raise ValidationError({'divider_bar': f"Between 2 and {hive.hive_type.max_bars - 1}."})
    colonies = list(living(hive))
    if divider is None and any(c.compartment == 2 for c in colonies):
        raise ValidationError({'divider_bar': "Two colonies live on either side of the divider."})
    for colony in colonies:
        capacity = compartment_capacity(hive, colony.compartment, divider or 0)
        if colony.bars is not None and capacity is not None and colony.bars > capacity:
            raise ValidationError({'divider_bar': f"The colony of compartment {colony.compartment} "
                                                  f"has {colony.bars} bars: no room for them."})


def bars_after_transfer(source, target, bars):
    """Bars follow a colony between hives of the same family; otherwise they are counted again."""
    if source is not None and source.hive_type.bar_family == target.hive_type.bar_family:
        return bars
    return None


def install(colony, hive, compartment, day):
    """Put a new colony in `hive` from `day` (saved with its first stay)."""
    colony.hive = hive
    colony.compartment = compartment
    colony.save()
    ColonyOccupancy.objects.create(colony=colony, hive=hive, compartment=compartment, started_on=day)


def close_stay(colony, day):
    stay = colony.occupancies.filter(ended_on__isnull=True).first()
    if stay is not None:
        if day < stay.started_on:
            raise ValidationError({'on': f"Not before {stay.started_on.isoformat()}, the start of "
                                         "the current period."})
        stay.ended_on = day
        stay.save(update_fields=['ended_on'])


def relocate(colony, hive, compartment, day):
    """Move a living colony to another hive or compartment from `day`."""
    close_stay(colony, day)
    colony.hive = hive
    colony.compartment = compartment
    colony.save(update_fields=['hive', 'compartment', 'bars', 'updated_at'])
    ColonyOccupancy.objects.create(colony=colony, hive=hive, compartment=compartment, started_on=day)


def end(colony, day, cause, merged_into=None):
    if day < colony.started_on:
        raise ValidationError({'on': "Before the colony started."})
    close_stay(colony, day)
    colony.ended_on = day
    colony.end_cause = cause
    colony.merged_into = merged_into
    colony.save(update_fields=['ended_on', 'end_cause', 'merged_into', 'updated_at'])
