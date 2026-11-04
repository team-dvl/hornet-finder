"""
Beekeeping module: hive types, hives, and where and with whom each hive was.

Depends on `hornet` (apiaries, users, beekeeper groups), never the reverse. See
`doc/APICULTURE.md`. Hives carry a UUID that the client may choose, so a hive
created offline keeps its identity when it reaches the server.
"""

import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


class HiveType(models.Model):
    """
    Referential of hive models (TBH, Chandler, Warré, log hive, nucleus),
    editable by platform admins. Bars of the same family are interchangeable.
    """

    BAR_FAMILY_TOPBAR = 'topbar'
    BAR_FAMILY_WARRE = 'warre'
    BAR_FAMILY_CHOICES = [
        (BAR_FAMILY_TOPBAR, 'Top bar'),
        (BAR_FAMILY_WARRE, 'Warré'),
    ]

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    sort_order = models.IntegerField(default=0)
    # Empty for a hive without bars (log hive)
    bar_family = models.CharField(max_length=16, choices=BAR_FAMILY_CHOICES, blank=True, default='')
    # Bars a top-bar hive holds at most, shared by its colonies when it is divided
    max_bars = models.PositiveSmallIntegerField(null=True, blank=True)
    # Warré: bars per box, the number of boxes varying
    bars_per_box = models.PositiveSmallIntegerField(null=True, blank=True)
    # Two for a top-bar hive split by a divider, one otherwise
    max_colonies = models.PositiveSmallIntegerField(default=1)
    # A small hive to carry a colony from one hive to another (nucleus): a
    # colony waits in it a few days, fed, before it is transferred
    portable = models.BooleanField(default=False)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


def hive_photo_path(instance, filename):
    """The photo of a hive lives under `hives/<hive id>/`: the media view resolves its rights from the path."""
    return f"hives/{instance.pk}/{uuid.uuid4().hex}.jpg"


class Hive(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_STORED = 'stored'
    STATUS_RETIRED = 'retired'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'In service'),
        (STATUS_STORED, 'Stored'),
        (STATUS_RETIRED, 'Retired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hive_type = models.ForeignKey(HiveType, on_delete=models.PROTECT, related_name='hives')
    # Free and editable: nothing refers to a hive by its name
    name = models.CharField(max_length=120)
    number = models.CharField(max_length=16, blank=True, default='')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE,
                              db_index=True)
    # Where the hive stands while in service; an apiary holding hives cannot be deleted
    apiary = models.ForeignKey('hornet.Apiary', null=True, blank=True, on_delete=models.PROTECT,
                               related_name='hives')
    # Owned by an association or by a person, never both
    owner_group = models.ForeignKey('hornet.BeekeeperGroup', null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='hives')
    owner_user = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='owned_hives')
    # The beekeeper the hive is entrusted to
    keeper = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='kept_hives')
    commissioned_on = models.DateField(null=True, blank=True)
    # Position of the divider of a top-bar hive, which takes the place of a bar:
    # compartment 1 lies below it, compartment 2 above. Empty without a divider.
    divider_bar = models.PositiveSmallIntegerField(null=True, blank=True)
    comments = models.TextField(blank=True, default='')
    # One picture of the hive, to tell it apart (its colonies' pictures go with the visits)
    photo = models.ImageField(upload_to=hive_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=hive_photo_path, null=True, blank=True)
    # Identifier in an imported source (Glide), unique when set
    external_ref = models.CharField(max_length=64, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='created_hives')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name', 'number']
        constraints = [
            models.CheckConstraint(
                condition=~(Q(owner_group__isnull=False) & Q(owner_user__isnull=False)),
                name='hive_single_owner',
            ),
            # In service means standing in an apiary, and only then
            models.CheckConstraint(
                condition=(Q(status='active', apiary__isnull=False)
                           | (~Q(status='active') & Q(apiary__isnull=True))),
                name='hive_active_in_apiary',
            ),
        ]

    def __str__(self):
        return f"{self.name} #{self.number}" if self.number else self.name


class HivePlacement(models.Model):
    """A stay of a hive in an apiary, from `started_on` to `ended_on` (open while it stands there)."""

    hive = models.ForeignKey(Hive, on_delete=models.CASCADE, related_name='placements')
    # Kept as a label when the apiary is deleted afterwards
    apiary = models.ForeignKey('hornet.Apiary', null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='hive_placements')
    apiary_label = models.CharField(max_length=255, blank=True, default='')
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_on', '-id']
        constraints = [
            models.UniqueConstraint(fields=['hive'], condition=Q(ended_on__isnull=True),
                                    name='hiveplacement_one_open'),
        ]


class HiveCustody(models.Model):
    """A period during which a hive was entrusted to a beekeeper."""

    hive = models.ForeignKey(Hive, on_delete=models.CASCADE, related_name='custodies')
    keeper = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='hive_custodies')
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_on', '-id']
        constraints = [
            models.UniqueConstraint(fields=['hive'], condition=Q(ended_on__isnull=True),
                                    name='hivecustody_one_open'),
        ]


class Colony(models.Model):
    """
    A colony of bees, distinct from the hive it lives in: it may move to
    another hive (transfer) and keeps its identity and its lineage. Colonies
    are born from a division, from what stays after a swarm, from a caught
    swarm or from a bought package; they end when they die, are merged into
    another one, abscond, or swarm (the part that stays is a new colony).
    """

    ORIGIN_DIVISION = 'division'
    ORIGIN_SWARM_PARENT = 'swarm_parent'
    ORIGIN_SWARM_CAUGHT = 'swarm_caught'
    ORIGIN_PACKAGE = 'package'
    ORIGIN_UNKNOWN = 'unknown'
    ORIGIN_CHOICES = [
        (ORIGIN_DIVISION, 'Division'),
        (ORIGIN_SWARM_PARENT, 'What stayed after a swarm'),
        (ORIGIN_SWARM_CAUGHT, 'Caught swarm'),
        (ORIGIN_PACKAGE, 'Bought package'),
        (ORIGIN_UNKNOWN, 'Unknown'),
    ]
    END_DIED = 'died'
    END_MERGED = 'merged'
    END_ABSCONDED = 'absconded'
    END_SWARMED = 'swarmed'
    END_UNKNOWN = 'unknown'
    END_CHOICES = [
        (END_DIED, 'Died'),
        (END_MERGED, 'Merged into another colony'),
        (END_ABSCONDED, 'Absconded'),
        (END_SWARMED, 'Swarmed'),
        (END_UNKNOWN, 'Unknown'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, blank=True, default='')
    origin = models.CharField(max_length=16, choices=ORIGIN_CHOICES, default=ORIGIN_UNKNOWN)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='children')
    # The hive it lives in, or lived in last once ended: its rights are the hive's.
    # A hive that ever held a colony is retired, not deleted.
    hive = models.ForeignKey(Hive, on_delete=models.PROTECT, related_name='colonies')
    compartment = models.PositiveSmallIntegerField(default=1)
    # Top-bar hive: bars it occupies; Warré: boxes; empty when not counted
    bars = models.PositiveSmallIntegerField(null=True, blank=True)
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    end_cause = models.CharField(max_length=16, choices=END_CHOICES, blank=True, default='')
    merged_into = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name='absorbed')
    # Since when it raises a new queen (queenless part of a division, what
    # stayed after a swarm), and when the new queen was seen laying: together
    # the brood break the varroa control relies on
    requeening_since = models.DateField(null=True, blank=True)
    laying_since = models.DateField(null=True, blank=True)
    comments = models.TextField(blank=True, default='')
    external_ref = models.CharField(max_length=64, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='created_colonies')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_on', 'name']
        constraints = [
            models.CheckConstraint(condition=Q(compartment__in=[1, 2]), name='colony_compartment'),
            models.CheckConstraint(
                condition=(Q(ended_on__isnull=True, end_cause='')
                           | Q(ended_on__isnull=False) & ~Q(end_cause='')),
                name='colony_end_with_cause',
            ),
            # One living colony per compartment
            models.UniqueConstraint(fields=['hive', 'compartment'], condition=Q(ended_on__isnull=True),
                                    name='colony_one_per_compartment'),
        ]

    def __str__(self):
        return self.name or f"Colonie {str(self.pk)[:8]}"

    @property
    def active(self) -> bool:
        return self.ended_on is None


class ColonyOccupancy(models.Model):
    """A stay of a colony in a hive compartment, from `started_on` to `ended_on`."""

    colony = models.ForeignKey(Colony, on_delete=models.CASCADE, related_name='occupancies')
    hive = models.ForeignKey(Hive, on_delete=models.CASCADE, related_name='occupancies')
    compartment = models.PositiveSmallIntegerField(default=1)
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_on', '-id']
        constraints = [
            models.UniqueConstraint(fields=['colony'], condition=Q(ended_on__isnull=True),
                                    name='colonyoccupancy_one_open'),
        ]


def visit_photo_path(instance, filename):
    """Every file of a visit lives under `visits/<visit id>/`: the media view resolves its rights from the path."""
    return f"visits/{instance.visit_id}/{uuid.uuid4().hex}.jpg"


class Visit(models.Model):
    """
    A visit to an apiary: when, who came, what was done, and one inspection
    per colony looked at. Participants without an account are only named
    (`guest_names`), never written in the audit trail.
    """

    KIND_CONTROL = 'control'
    KIND_FEEDING = 'feeding'
    KIND_DIVISION = 'division'
    KIND_SWARM_CATCH = 'swarm_catch'
    KIND_TRANSFER = 'transfer'
    KIND_ENTRANCE_GUARD = 'entrance_guard'
    KIND_OTHER = 'other'
    KINDS = [KIND_CONTROL, KIND_FEEDING, KIND_DIVISION, KIND_SWARM_CATCH, KIND_TRANSFER,
             KIND_ENTRANCE_GUARD, KIND_OTHER]
    # The general weather, as the WMO codes of Open-Meteo group it (`weather.py`)
    WEATHER_SUMMARIES = ['clear', 'mostly_clear', 'partly_cloudy', 'overcast', 'fog', 'drizzle', 'rain',
                         'showers', 'snow', 'thunderstorm']
    WEATHER_SOURCES = ['open-meteo']
    # Planned, then done once it took place (never back): only done visits tell of the colonies
    STATUS_PLANNED = 'planned'
    STATUS_DONE = 'done'
    STATUSES = [STATUS_PLANNED, STATUS_DONE]
    # What a planned visit follows up (`planning.py`): the move of a colony out
    # of its nucleus, or the check that a colony raising a queen lays again
    FOLLOW_UP_NUCLEUS = 'nucleus_transfer'
    FOLLOW_UP_LAYING = 'laying_check'
    FOLLOW_UPS = [FOLLOW_UP_NUCLEUS, FOLLOW_UP_LAYING]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=8, default=STATUS_DONE, db_index=True)
    # Kept as a label when the apiary is deleted afterwards
    apiary = models.ForeignKey('hornet.Apiary', null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='visits')
    apiary_label = models.CharField(max_length=255, blank=True, default='')
    started_at = models.DateTimeField(db_index=True)
    duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    title = models.CharField(max_length=120, blank=True, default='')
    kinds = models.JSONField(default=list, blank=True)
    report = models.TextField(blank=True, default='')
    # The weather during the visit: typed, or filled from Open-Meteo (`weather.py`)
    weather_temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)  # °C
    weather_precipitation = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)  # mm in the hour
    weather_wind = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)  # km/h at 10 m
    weather_cloud_cover = models.PositiveSmallIntegerField(null=True, blank=True)  # %
    weather_summary = models.CharField(max_length=16, blank=True, default='')
    # 'open-meteo' when the values came from it unchanged, '' when typed
    weather_source = models.CharField(max_length=16, blank=True, default='')
    participants = models.ManyToManyField('hornet.User', blank=True, related_name='visits')
    guest_names = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='created_visits')
    # When the reminder of a planned visit went out (`planning.py`); cleared when it moves
    reminded_at = models.DateTimeField(null=True, blank=True)
    follow_up = models.CharField(max_length=20, blank=True, default='')
    follow_up_colony = models.ForeignKey('Colony', null=True, blank=True, on_delete=models.SET_NULL,
                                         related_name='follow_ups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return self.title or f"Visite du {timezone.localtime(self.started_at):%d/%m/%Y}"


class Inspection(models.Model):
    """
    What was seen of one colony during a visit. Every observation is optional:
    the notes come first. The count of bars (or boxes) is the colony's after
    the visit.
    """

    TEMPERS = ['calm', 'nervous', 'aggressive']
    ACTIVITIES = ['low', 'normal', 'high']
    HORNETS = ['none', 'few', 'many']
    FEEDINGS = ['syrup', 'candy', 'other']
    UNITS = ['l', 'kg']

    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='inspections')
    # Kept as labels when the hive or the colony is deleted afterwards
    hive = models.ForeignKey(Hive, null=True, blank=True, on_delete=models.SET_NULL, related_name='inspections')
    hive_label = models.CharField(max_length=160, blank=True, default='')
    colony = models.ForeignKey(Colony, null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='inspections')
    colony_label = models.CharField(max_length=160, blank=True, default='')
    compartment = models.PositiveSmallIntegerField(default=1)
    queen_seen = models.BooleanField(null=True, blank=True)
    eggs_seen = models.BooleanField(null=True, blank=True)
    brood_seen = models.BooleanField(null=True, blank=True)
    queen_cells = models.BooleanField(null=True, blank=True)
    temper = models.CharField(max_length=16, blank=True, default='')
    activity = models.CharField(max_length=16, blank=True, default='')
    pollen = models.BooleanField(null=True, blank=True)
    hornets = models.CharField(max_length=16, blank=True, default='')
    entrance_guard = models.BooleanField(null=True, blank=True)
    feeding = models.CharField(max_length=16, blank=True, default='')
    feeding_amount = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feeding_unit = models.CharField(max_length=4, blank=True, default='')
    bars = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['hive_label', 'compartment', 'id']
        constraints = [
            models.UniqueConstraint(fields=['visit', 'colony'], condition=Q(colony__isnull=False),
                                    name='inspection_once_per_colony'),
        ]


class VisitPhoto(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='photos')
    inspection = models.ForeignKey(Inspection, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='photos')
    image = models.ImageField(upload_to=visit_photo_path)
    thumbnail = models.ImageField(upload_to=visit_photo_path, null=True, blank=True)
    uploaded_by = models.ForeignKey('hornet.User', null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name='visit_photos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
