from django.db import models
from django.contrib.gis.db import models as geomodels
from django.contrib.gis.geos import Point


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
    created_by = models.CharField(max_length=255, null=True, blank=True)
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
    created_by = models.CharField(max_length=255, null=True, blank=True)  # Add created_by field
    comments = models.TextField(null=True, blank=True)

class Apiary(GeolocatedModel):
    INFESTATION_LEVEL_CHOICES = [
        (1, "Light"),
        (2, "Medium"),
        (3, "High"),
    ]
    
    id = models.AutoField(primary_key=True)
    infestation_level = models.IntegerField(choices=INFESTATION_LEVEL_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)
