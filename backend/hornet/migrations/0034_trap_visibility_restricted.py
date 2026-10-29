"""
The visibility of a trap says what it is: `public` or `restricted`. `group` (restricted to the
delegated group) becomes `restricted`. So do all the existing traps of an apiary-bound type, whoever
owns them: they were stored as public but never shown, and they stay hidden. Their owners who keep
no bees may make them public themselves.
"""

from django.db import migrations, models


def forwards(apps, schema_editor):
    Trap = apps.get_model('hornet', 'Trap')
    Trap.objects.filter(visibility='group').update(visibility='restricted')
    Trap.objects.filter(trap_type__apiary_bound=True).exclude(visibility='restricted').update(visibility='restricted')


def backwards(apps, schema_editor):
    Trap = apps.get_model('hornet', 'Trap')
    Trap.objects.filter(visibility='restricted').update(visibility='group')


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0033_platformsettings'),
    ]

    operations = [
        migrations.AlterField(
            model_name='trap',
            name='visibility',
            field=models.CharField(
                choices=[('public', 'Public'), ('restricted', 'Restricted')],
                default='public', max_length=16),
        ),
        migrations.RunPython(forwards, backwards),
    ]
