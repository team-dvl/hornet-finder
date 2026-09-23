import uuid

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


class User(models.Model):
    guid = models.UUIDField(primary_key=True, editable=False)
    date_created = models.DateTimeField(auto_now_add=True)
    # Keycloak group paths of this user, refreshed from the `membership` claim
    # on every authenticated request. Needed to answer questions about *another*
    # user's groups, which the requester's own token cannot tell us (see
    # hornet/trap_permissions.py).
    group_paths = models.JSONField(default=list, blank=True)

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

class Apiary(GeolocatedModel):
    INFESTATION_LEVEL_CHOICES = [
        (1, "Light"),
        (2, "Medium"),
        (3, "High"),
    ]
    
    id = models.AutoField(primary_key=True)
    infestation_level = models.IntegerField(choices=INFESTATION_LEVEL_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL)
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


class TrapType(models.Model):
    """A model of trap, e.g. a commercial one or `Fait maison`."""

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, default='')
    photo = models.ImageField(upload_to=trap_type_photo_path, null=True, blank=True)
    photo_thumbnail = models.ImageField(upload_to=trap_type_photo_path, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

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
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'species'

    def __str__(self):
        return self.name


class Trap(GeolocatedModel):
    """A trap owned by a volunteer or a beekeeper, optionally delegated to a group."""

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

    def recompute_hornet_catch_count(self, save=True):
        """Refresh the denormalised counter from the catch events."""
        total = self.events.filter(
            kind=TrapEvent.KIND_CATCH, species__slug=HORNET_SPECIES_SLUG
        ).aggregate(total=models.Sum('quantity'))['total'] or 0
        self.hornet_catch_count = total
        if save:
            self.save(update_fields=['hornet_catch_count', 'updated_at'])
        return total

    def apply_event_side_effects(self, event, save=True):
        """Reflect a newly recorded event on the trap itself."""
        fields = []
        if event.kind == TrapEvent.KIND_INSTALLATION:
            self.active = True
            self.installed_at = timezone.localtime(event.performed_at).date()
            fields += ['active', 'installed_at']
        elif event.kind == TrapEvent.KIND_REMOVAL:
            self.active = False
            fields += ['active']
        elif event.kind == TrapEvent.KIND_CATCH:
            self.recompute_hornet_catch_count(save=False)
            fields += ['hornet_catch_count']
        if fields and save:
            self.save(update_fields=fields + ['updated_at'])
        return fields


class TrapEvent(models.Model):
    """
    One intervention on a trap: the journal of the trap.

    A catch is an intervention like any other (someone came, looked and emptied
    the trap), so catches and maintenance share this single model; only catches
    carry a species and a quantity.
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

    id = models.AutoField(primary_key=True)
    trap = models.ForeignKey(Trap, on_delete=models.CASCADE, related_name='events')
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    performed_at = models.DateTimeField()
    performed_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='trap_events')
    species = models.ForeignKey(Species, null=True, blank=True, on_delete=models.PROTECT,
                                related_name='trap_events')
    quantity = models.PositiveIntegerField(null=True, blank=True)
    comments = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-performed_at', '-id']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(kind='catch', species__isnull=False, quantity__gte=1)
                    | (~models.Q(kind='catch') & models.Q(species__isnull=True,
                                                          quantity__isnull=True))
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
            if not self.quantity:
                raise ValidationError({'quantity': "A catch requires a quantity of at least 1."})
        else:
            if self.species_id is not None or self.quantity is not None:
                raise ValidationError(
                    "Only a catch can carry a species and a quantity."
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
