"""
Beekeeping module: hive types, hives, and where and with whom each hive was.

Depends on `hornet` (apiaries, users, beekeeper groups), never the reverse. See
`doc/APICULTURE.md`. Hives carry a UUID that the client may choose, so a hive
created offline keeps its identity when it reaches the server.
"""

import uuid

from django.db import models
from django.db.models import Q


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

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


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
    comments = models.TextField(blank=True, default='')
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
