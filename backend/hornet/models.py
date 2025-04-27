from django.db import models


class Hornet(models.Model):
    id = models.AutoField(primary_key=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    direction = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

class Nest(models.Model):
    id = models.AutoField(primary_key=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    destroyed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
