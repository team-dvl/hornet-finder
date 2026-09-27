"""Flag the trap types that only stand in front of hives.

Such a trap would reveal an apiary, so it is never public. Only the seeded
electric harp is flagged here; an admin flags the others from the referential.
"""

from django.db import migrations, models

APIARY_BOUND_SLUGS = ['electric-harp']


def flag(apps, schema_editor):
    TrapType = apps.get_model('hornet', 'TrapType')
    TrapType.objects.filter(slug__in=APIARY_BOUND_SLUGS).update(apiary_bound=True)


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0014_apiary_address'),
    ]

    operations = [
        migrations.AddField(
            model_name='traptype',
            name='apiary_bound',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(flag, migrations.RunPython.noop),
    ]
