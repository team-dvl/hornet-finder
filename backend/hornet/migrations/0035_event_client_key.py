"""
A key chosen by the client on trap and nest journal entries, so that a request
replayed after a lost answer records the entry once (see hornet/idempotency.py).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0034_trap_visibility_restricted'),
    ]

    operations = [
        migrations.AddField(
            model_name='trapevent',
            name='client_key',
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='nestevent',
            name='client_key',
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
    ]
