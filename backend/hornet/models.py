from django.db import models


class Hornet(models.Model):
    id = models.AutoField(primary_key=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    direction = models.IntegerField()
    duration = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    linked_nest = models.ForeignKey('Nest', null=True, blank=True, on_delete=models.SET_NULL)

class Nest(models.Model):
    id = models.AutoField(primary_key=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    public_place = models.BooleanField(default=False)
    address = models.CharField(max_length=255)
    destroyed = models.BooleanField(default=False)
    destroyed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    comments = models.TextField(null=True, blank=True)

class Apiary(models.Model):
    INFESTATION_LEVEL_CHOICES = [
        (1, "Light"),
        (2, "Medium"),
        (3, "High"),
    ]
    
    id = models.AutoField(primary_key=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    infestation_level = models.IntegerField(choices=INFESTATION_LEVEL_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)
