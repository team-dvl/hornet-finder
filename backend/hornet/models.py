import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.gis.db import models as geomodels
from django.contrib.gis.geos import Point
from django.utils import timezone
from django.utils.text import slugify

# Slug of the species the trap counter tracks (see Trap.hornet_catch_count)
HORNET_SPECIES_SLUG = 'vespa-velutina'


def unique_slug(model, name, max_length=64):
    """
    Derive an unused slug from a display name.

    Slugs are internal identity (they key the seed migration and the API
    write fields), never a user's choice: nobody is asked to invent one.
    """
    base = slugify(name)[:max_length] or 'item'
    candidate, index = base, 1
    while model.objects.filter(slug=candidate).exists():
        suffix = f'-{index}'
        candidate = f'{base[:max_length - len(suffix)]}{suffix}'
        index += 1
    return candidate


def avatar_upload_path(instance, filename):
    """Profile photos live under `avatars/<user guid>/`, a public media prefix."""
    return f'avatars/{instance.guid}/{filename}'


class User(models.Model):
    guid = models.UUIDField(primary_key=True, editable=False)
    date_created = models.DateTimeField(auto_now_add=True)
    # Keycloak group paths of this user, refreshed from the `membership` claim
    # on every authenticated request. Needed to answer questions about *another*
    # user's groups, which the requester's own token cannot tell us (see
    # hornet/trap_permissions.py).
    group_paths = models.JSONField(default=list, blank=True)
    # Profile photo uploaded in the app. Its public URL is also written to the
    # Keycloak `picture` attribute, so the account console and the tokens show it.
    avatar = models.ImageField(upload_to=avatar_upload_path, null=True, blank=True)

    def __str__(self):
        return str(self.guid)


class GeolocatedModel(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    point = geomodels.PointField(geography=True, srid=4326, null=True, blank=True)

    class Meta:
        abstract = True  # No table will be created for this model

    def save(self, *args, **kwargs):
        if self.latitude is not None and self.longitude is not None:
            self.point = Point(self.longitude, self.latitude, srid=4326)
        super().save(*args, **kwargs)

class Hornet(GeolocatedModel):
    COLOR_CHOICES = [
        ('', 'Aucune couleur'),
        ('red', 'Rouge'),
        ('blue', 'Bleu'),
        ('yellow', 'Jaune'),
        ('green', 'Vert'),
        ('orange', 'Orange'),
        ('purple', 'Violet'),
        ('pink', 'Rose'),
        ('brown', 'Marron'),
        ('white', 'Blanc'),
        ('black', 'Noir'),
        ('gray', 'Gris'),
        ('cyan', 'Cyan'),
        ('magenta', 'Magenta'),
        ('lime', 'Vert citron'),
    ]
    
    id = models.AutoField(primary_key=True)
    direction = models.IntegerField()
    duration = models.IntegerField(null=True, blank=True)
    mark_color_1 = models.CharField(max_length=20, choices=COLOR_CHOICES, blank=True, default='')
    mark_color_2 = models.CharField(max_length=20, choices=COLOR_CHOICES, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL)
    linked_nest = models.ForeignKey('Nest', null=True, blank=True, on_delete=models.SET_NULL)
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

class Nest(GeolocatedModel):
    id = models.AutoField(primary_key=True)
    public_place = models.BooleanField(default=False)
    address = models.CharField(max_length=255, blank=True, default='')  # Allow empty address
    destroyed = models.BooleanField(default=False)
    destroyed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL)
    comments = models.TextField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

class BeekeeperGroup(models.Model):
    """Represents a group of beekeepers for access control."""
    name = models.CharField(max_length=128, unique=True)
    # Optionally, store the group path as in the JWT (e.g. /beekeepers/vsab)
    path = models.CharField(max_length=256, unique=True)

    def __str__(self):
        return self.name

class ApiaryGroupPermission(models.Model):
    apiary = models.ForeignKey('Apiary', on_delete=models.CASCADE)
    group = models.ForeignKey('BeekeeperGroup', on_delete=models.CASCADE)
    can_read = models.BooleanField(default=True)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ('apiary', 'group')

    def __str__(self):
        perms = []
        if self.can_read:
            perms.append('read')
        if self.can_update:
            perms.append('update')
        if self.can_delete:
            perms.append('delete')
        return f"{self.group.name} on {self.apiary.id}: {', '.join(perms)}"

def apiary_photo_path(instance, filename):
    """Every file of an apiary lives under `apiaries/<apiary id>/`, which lets
    the media view resolve the apiary (and its permissions) from the path."""
    return f"apiaries/{instance.pk}/{uuid.uuid4().hex}.jpg"


class Apiary(GeolocatedModel):
    INFESTATION_LEVEL_CHOICES = [
        (1, "Light"),
        (2, "Medium"),
        (3, "High"),
    ]

    id = models.AutoField(primary_key=True)
    # Indicative, and often left out by the beekeepers: NULL means not assessed
    infestation_level = models.IntegerField(choices=INFESTATION_LEVEL_CHOICES,
                                            null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL)
    # The beekeeper in charge: the creator at first, reassignable by an admin
    owner = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                              related_name='owned_apiaries')
    # Registration number at the Belgian food safety agency (AFSCA / FAVV)
    afsca_number = models.CharField(max_length=32, blank=True, default='')
    # Describes the position, filled from it by the form and editable by hand
    address = models.CharField(max_length=255, blank=True, default='')
    photo = models.ImageField(upload_to=apiary_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=apiary_photo_path, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)
    # groups that can access this apiary, with permissions
    allowed_groups = models.ManyToManyField(
        BeekeeperGroup,
        through='ApiaryGroupPermission',
        blank=True,
        related_name="apiaries"
    )


# ---------------------------------------------------------------------------
# Traps module
# ---------------------------------------------------------------------------

def trap_photo_path(instance, filename):
    """Upload path of a trap's own photo: every file of a trap lives under
    `traps/<trap id>/`, which is what lets the media view resolve the trap (and
    therefore the permissions) from the path alone."""
    return f"traps/{instance.pk}/{uuid.uuid4().hex}.jpg"


def trap_event_photo_path(instance, filename):
    """Upload path of a photo attached to a trap event."""
    return f"traps/{instance.trap_id}/{uuid.uuid4().hex}.jpg"


def trap_type_photo_path(instance, filename):
    """Upload path of a trap type illustration. These are public."""
    return f"trap-types/{uuid.uuid4().hex}.jpg"


def species_photo_path(instance, filename):
    """Upload path of a species illustration. These are public."""
    return f"species/{uuid.uuid4().hex}.jpg"


class TrapType(models.Model):
    """A model of trap, e.g. a commercial one or `Fait maison`."""

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    photo = models.ImageField(upload_to=trap_type_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=trap_type_photo_path, null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    # Only ever set up in front of hives (electric harp, muzzle...): showing such
    # a trap would reveal an apiary, so it stays private whatever its visibility
    apiary_bound = models.BooleanField(default=False)
    # The catches pile up between emptyings (electric harp, muzzle, fatal
    # trap...): a reading counts what the trap holds and says whether it was
    # emptied. Otherwise (butterfly net...) every reading takes everything out.
    accumulates = models.BooleanField(default=False)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Species(models.Model):
    """An insect (or other) species that can be found in a trap."""

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    scientific_name = models.CharField(max_length=128, blank=True, default='')
    wikipedia_url = models.URLField(max_length=255, blank=True, default='')
    photo = models.ImageField(upload_to=species_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=species_photo_path, null=True, blank=True)
    # Author and licence of the photo, mandatory for Wikimedia Commons pictures
    photo_credit = models.CharField(max_length=255, blank=True, default='')
    photo_source_url = models.URLField(max_length=500, blank=True, default='')
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'species'

    def __str__(self):
        return self.name


class Trap(GeolocatedModel):
    """A trap owned by a trapper or a beekeeper, optionally delegated to a beekeeper group."""

    VISIBILITY_PUBLIC = 'public'
    VISIBILITY_GROUP = 'group'
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, 'Public'),
        (VISIBILITY_GROUP, 'Group only'),
    ]

    id = models.AutoField(primary_key=True)
    owner = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                              related_name='traps')
    active = models.BooleanField(default=True)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES,
                                  default=VISIBILITY_PUBLIC)
    # Delegation: the group whose members may maintain the trap, e.g. while the
    # owner is away. Also restricts visibility when visibility is 'group'.
    group = models.ForeignKey(BeekeeperGroup, null=True, blank=True, on_delete=models.SET_NULL,
                              related_name='traps')
    trap_type = models.ForeignKey(TrapType, on_delete=models.PROTECT, related_name='traps')
    photo = models.ImageField(upload_to=trap_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=trap_photo_path, null=True, blank=True)
    address = models.CharField(max_length=255, blank=True, default='')
    installed_at = models.DateField()
    comments = models.TextField(blank=True, default='')
    # Denormalised count of Vespa velutina caught, recomputed on every change
    hornet_catch_count = models.PositiveIntegerField(default=0)
    # What the last reading left in the trap, recomputed with the catches:
    # {'at': ISO date of the reading, 'items': [{'species_slug', 'quantity'}],
    # 'others_counted': whether the other species are known}; null once emptied
    contents = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Trap {self.id} ({self.trap_type_id})"

    def clean(self):
        super().clean()
        if self.visibility == self.VISIBILITY_GROUP and self.group_id is None:
            raise ValidationError({'group': "A group is required when visibility is 'group'."})

    def recompute_catches(self, save=True):
        """
        Derive the catches of every reading from what was seen in the trap.

        A reading records what the trap holds (`observed_quantity`) and whether
        it was emptied afterwards. What it left in place is the baseline of the
        next reading, whose catches (`quantity`) are what it saw beyond that
        baseline, never below zero (escaped or decayed insects). An emptied
        trap, or one put in service (installation), starts again from zero.

        The Asian hornet is counted at every reading, so its baseline is always
        known. The other species are only known while every reading since the
        last emptying counted them: otherwise their catches cannot be told from
        what was already there, and the reading is marked as not counting them
        (`bycatch_counted` False), which keeps it out of the selectivity.

        Recomputed whole on every change of the journal: a reading inserted,
        edited or removed shifts the baseline of the following ones.
        """
        events = list(self.events.filter(kind__in=TrapEvent.BASELINE_KINDS)
                      .select_related('species').order_by('performed_at', 'id'))
        # One step per installation or reading (the catch events of one batch)
        steps = {}
        for event in events:
            key = event.batch if event.kind == TrapEvent.KIND_CATCH and event.batch else event.pk
            steps.setdefault(key, []).append(event)

        stock, others_known, left_at = {}, True, None
        changed, hornets = [], 0
        for step in steps.values():
            first = step[0]
            if first.kind == TrapEvent.KIND_INSTALLATION:
                stock, others_known, left_at = {}, True, None
                continue
            downgrade = not others_known and first.bycatch_counted
            observed = {}
            for event in step:
                slug = event.species.slug
                seen = event.observed_quantity if event.observed_quantity is not None else event.quantity
                observed[slug] = seen
                baseline = stock.get(slug, 0) if slug == HORNET_SPECIES_SLUG or others_known else 0
                caught = max(0, seen - baseline)
                if event.quantity != caught or downgrade:
                    event.quantity = caught
                    if downgrade:
                        event.bycatch_counted = False
                    changed.append(event)
                if slug == HORNET_SPECIES_SLUG:
                    hornets += caught
            # Readings recorded before the question are taken as emptied, as they were
            if first.emptied is False:
                others_known = bool(first.bycatch_counted)
                stock = observed if others_known else {HORNET_SPECIES_SLUG: observed.get(HORNET_SPECIES_SLUG, 0)}
                left_at = first.performed_at
            else:
                stock, others_known, left_at = {}, True, None

        if changed:
            TrapEvent.objects.bulk_update(changed, ['quantity', 'bycatch_counted'])
        self.hornet_catch_count = hornets
        self.contents = None if left_at is None else {
            'at': left_at.isoformat(),
            'items': [{'species_slug': slug, 'quantity': quantity}
                      for slug, quantity in stock.items() if quantity > 0],
            'others_counted': others_known,
        }
        if save:
            self.save(update_fields=['hornet_catch_count', 'contents', 'updated_at'])
        return hornets

    def apply_event_side_effects(self, event, save=True):
        """Reflect a newly recorded event on the trap itself."""
        fields = []
        if event.kind == TrapEvent.KIND_INSTALLATION:
            self.active = True
            self.installed_at = timezone.localtime(event.performed_at).date()
            # A trap is put in service empty: the baseline of its catches restarts
            self.recompute_catches(save=False)
            fields += ['active', 'installed_at', 'hornet_catch_count', 'contents']
        elif event.kind == TrapEvent.KIND_REMOVAL:
            self.active = False
            fields += ['active']
        elif event.kind == TrapEvent.KIND_CATCH:
            self.recompute_catches(save=False)
            fields += ['hornet_catch_count', 'contents']
        if fields and save:
            self.save(update_fields=fields + ['updated_at'])
        return fields


class TrapEvent(models.Model):
    """
    One intervention on a trap: the journal of the trap.

    A catch is an intervention like any other (someone came, looked and emptied
    the trap), so catches and maintenance share this single model; only catches
    carry a species and a quantity.

    One visit usually finds several species: each gets its own catch event,
    and the events recorded together share a `batch` and a `performed_at`.
    Such a visit is a reading ("relevé"): what the capture zone holds is counted
    (`observed_quantity`), then removed, or left in place in a trap whose type
    accumulates (`emptied`). The catches of the reading (`quantity`) are derived
    from it, see `Trap.recompute_catches`. The Asian hornet is always recorded,
    at zero if need be, so a reading without any catch still shows in the
    journal and in the statistics. The maintenance actions done during the same
    visit (cleaning, refill, repair) join its batch.
    """

    KIND_INSTALLATION = 'installation'
    KIND_INSPECTION = 'inspection'
    KIND_CLEANING = 'cleaning'
    KIND_REFILL = 'refill'
    KIND_REPAIR = 'repair'
    KIND_REMOVAL = 'removal'
    KIND_CATCH = 'catch'
    KIND_CHOICES = [
        (KIND_INSTALLATION, 'Installation'),
        (KIND_INSPECTION, 'Inspection'),
        (KIND_CLEANING, 'Cleaning'),
        (KIND_REFILL, 'Consumable refill'),
        (KIND_REPAIR, 'Repair'),
        (KIND_REMOVAL, 'Removal'),
        (KIND_CATCH, 'Catch'),
    ]
    # Actions that can be recorded along with a reading, in the same visit
    VISIT_ACTION_KINDS = (KIND_CLEANING, KIND_REFILL, KIND_REPAIR)
    # Events the catches of the following readings depend on
    BASELINE_KINDS = (KIND_CATCH, KIND_INSTALLATION)

    id = models.AutoField(primary_key=True)
    trap = models.ForeignKey(Trap, on_delete=models.CASCADE, related_name='events')
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    performed_at = models.DateTimeField()
    performed_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='trap_events')
    species = models.ForeignKey(Species, null=True, blank=True, on_delete=models.PROTECT,
                                related_name='trap_events')
    # New catches since the previous reading, derived (see Trap.recompute_catches)
    quantity = models.PositiveIntegerField(null=True, blank=True)
    # What the trap held at the reading, before it was emptied (if it was)
    observed_quantity = models.PositiveIntegerField(null=True, blank=True)
    # Whether the trap was emptied after this reading, the same on every catch
    # event of a batch; always true for a type that does not accumulate
    emptied = models.BooleanField(null=True, blank=True)
    # Groups the events of one visit (catches and actions); NULL for a lone event
    batch = models.UUIDField(null=True, blank=True, db_index=True)
    # Whether the other species were counted too during this reading, the same
    # on every catch event of a batch: False when they were left uncounted,
    # NULL when unknown (readings recorded before the question was asked)
    bycatch_counted = models.BooleanField(null=True, blank=True)
    comments = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-performed_at', '-id']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(kind='catch', species__isnull=False, quantity__gte=0)
                    | (~models.Q(kind='catch') & models.Q(species__isnull=True,
                                                          quantity__isnull=True,
                                                          observed_quantity__isnull=True,
                                                          emptied__isnull=True,
                                                          bycatch_counted__isnull=True))
                ),
                name='trapevent_catch_fields',
            ),
        ]

    def __str__(self):
        return f"{self.kind} on trap {self.trap_id}"

    def clean(self):
        super().clean()
        if self.kind == self.KIND_CATCH:
            if self.species_id is None:
                raise ValidationError({'species': "A catch requires a species."})
            if self.quantity is None:
                raise ValidationError({'quantity': "A catch requires a quantity."})
            # What was seen, not the derived catches: a species still in the
            # trap from the previous reading has no new catch, yet is present
            seen = self.observed_quantity if self.observed_quantity is not None else self.quantity
            if seen == 0 and self.species.slug != HORNET_SPECIES_SLUG:
                raise ValidationError(
                    {'quantity': "Only the Asian hornet can be recorded at zero."}
                )
        else:
            if (self.species_id is not None or self.quantity is not None
                    or self.observed_quantity is not None or self.emptied is not None
                    or self.bycatch_counted is not None):
                raise ValidationError(
                    "Only a catch can carry a species, a quantity and a bycatch count."
                )


class TrapPhoto(models.Model):
    """A photo attached to a trap event (and kept under the trap's directory)."""

    id = models.AutoField(primary_key=True)
    trap = models.ForeignKey(Trap, on_delete=models.CASCADE, related_name='photos')
    event = models.ForeignKey(TrapEvent, null=True, blank=True, on_delete=models.CASCADE,
                              related_name='photos')
    image = models.ImageField(upload_to=trap_event_photo_path)
    thumbnail = models.ImageField(upload_to=trap_event_photo_path, null=True, blank=True)
    uploaded_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name='trap_photos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"Photo {self.id} of trap {self.trap_id}"


class Tag(models.Model):
    """
    A signed QR tag (see `hornet/tags.py`), recorded when it is generated.

    A tag is valid only when its signature checks out *and* it is known here.
    It starts free, is then associated with one object (a trap for now) and,
    when replaced, is revoked rather than deleted: scanning it later reports
    "revoked" instead of "unknown", which would look like a forgery.
    """

    id = models.AutoField(primary_key=True)
    value = models.CharField(max_length=44, unique=True)
    key_index = models.PositiveSmallIntegerField(db_index=True)
    generated_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='generated_tags')
    generated_at = models.DateTimeField(auto_now_add=True)
    trap = models.ForeignKey(Trap, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name='tags')
    associated_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name='associated_tags')
    associated_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='revoked_tags')
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-generated_at', '-id']
        constraints = [
            # At most one live tag per trap
            models.UniqueConstraint(
                fields=['trap'],
                condition=models.Q(revoked_at__isnull=True, trap__isnull=False),
                name='tag_one_active_per_trap',
            ),
        ]

    def __str__(self):
        return f"Tag {self.value[2:10]}"

    @property
    def short(self) -> str:
        from .tags import short_code
        return short_code(self.value)

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None


class GroupInvitation(models.Model):
    """
    Invitation of an existing user to join a beekeeper group (`/beekeepers/<id>`).

    Sent by a platform admin or an administrator of the group, who typed the
    invitee's full email address; accepting it adds the invitee to the Keycloak
    group. Only the Keycloak ids are stored, never the email address.
    """

    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_DECLINED = 'declined'
    STATUS_CANCELLED = 'cancelled'
    STATUS_EXPIRED = 'expired'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'En attente'),
        (STATUS_ACCEPTED, 'Acceptée'),
        (STATUS_DECLINED, 'Refusée'),
        (STATUS_CANCELLED, 'Annulée'),
        (STATUS_EXPIRED, 'Expirée'),
    ]
    VALIDITY = timedelta(days=30)
    # At most one email per interval, the invitation's own included
    REMINDER_INTERVAL = timedelta(hours=24)

    group_path = models.CharField(max_length=256)
    # Display name of the group when the invitation was sent
    group_name = models.CharField(max_length=255)
    invitee = models.ForeignKey('User', on_delete=models.CASCADE,
                                related_name='received_group_invitations')
    invited_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='sent_group_invitations')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    # Last email that reached the mail server (invitation or reminder)
    last_notified_at = models.DateTimeField(null=True, blank=True)
    reminders_sent = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['group_path', 'invitee'],
                condition=models.Q(status='pending'),
                name='group_invitation_one_pending',
            ),
        ]

    def __str__(self):
        return f"Invitation of {self.invitee_id} to {self.group_path} ({self.status})"

    @property
    def expires_at(self):
        return self.created_at + self.VALIDITY

    @property
    def next_reminder_at(self):
        """When a reminder may be sent; None when no email ever left (right away)."""
        return self.last_notified_at + self.REMINDER_INTERVAL if self.last_notified_at else None

    @classmethod
    def expire_stale(cls, **filters) -> None:
        """Mark the pending invitations past their validity as expired."""
        cls.objects.filter(
            status=cls.STATUS_PENDING, created_at__lte=timezone.now() - cls.VALIDITY, **filters,
        ).update(status=cls.STATUS_EXPIRED)


class InvitationThrottle(models.Model):
    """
    Failed email lookups of an inviter. Invitations name a person by their full
    email address; to keep that from probing which addresses have an account,
    `MAX_FAILURES` misses within `WINDOW` block the inviter for `LOCKOUT`. A
    successful lookup does not reset the count, otherwise a known address typed
    between guesses would lift the limit.
    """

    MAX_FAILURES = 10
    WINDOW = timedelta(hours=24)
    LOCKOUT = timedelta(hours=24)

    user = models.OneToOneField('User', on_delete=models.CASCADE, primary_key=True,
                                related_name='invitation_throttle')
    failures = models.PositiveSmallIntegerField(default=0)
    window_started_at = models.DateTimeField(null=True, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)

    def refresh(self, now) -> None:
        """Forget an elapsed lockout or failure window."""
        if self.locked_until and self.locked_until <= now:
            self.locked_until = None
        if self.window_started_at and now - self.window_started_at >= self.WINDOW:
            self.failures = 0
            self.window_started_at = None

    def is_locked(self, now) -> bool:
        return bool(self.locked_until and self.locked_until > now)

    def remaining(self, now) -> int:
        return 0 if self.is_locked(now) else self.MAX_FAILURES - self.failures

    def record_failure(self, now) -> None:
        if not self.failures:
            self.window_started_at = now
        self.failures += 1
        if self.failures >= self.MAX_FAILURES:
            self.locked_until = now + self.LOCKOUT
            self.failures = 0
            self.window_started_at = None


class StatExportJob(models.Model):
    """
    A statistics export sent by email: the link carries a random token, only
    its SHA-256 is kept. The file is computed when downloaded, with the
    parameters and the rights of the requester frozen here. The address it
    was sent to is not kept.
    """
    token_hash = models.CharField(max_length=64, unique=True)
    statistic = models.CharField(max_length=50)
    params = models.JSONField(default=dict)
    scope = models.JSONField(default=dict)
    # (label, value) lines shown on the download page
    summary = models.JSONField(default=list)
    requester = models.CharField(max_length=64, db_index=True)
    requester_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    downloads = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Export {self.statistic} ({self.created_at:%Y-%m-%d %H:%M})"
