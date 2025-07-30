from django.db import models
from django.contrib.gis.db import models as geomodels
from django.contrib.gis.geos import Point


class User(models.Model):
    guid = models.UUIDField(primary_key=True, editable=False)
    date_created = models.DateTimeField(auto_now_add=True)

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

    def clean(self):
        # Validation : les deux couleurs ne peuvent pas être identiques si elles existent
        if self.mark_color_1 and self.mark_color_2 and self.mark_color_1 == self.mark_color_2:
            from django.core.exceptions import ValidationError
            raise ValidationError("Les deux marques de couleur ne peuvent pas être identiques.")

class Nest(GeolocatedModel):
    id = models.AutoField(primary_key=True)
    public_place = models.BooleanField(default=False)
    address = models.CharField(max_length=255, blank=True, default='')  # Allow empty address
    destroyed = models.BooleanField(default=False)
    destroyed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL)
    comments = models.TextField(null=True, blank=True)

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
