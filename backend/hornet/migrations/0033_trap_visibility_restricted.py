"""
The visibility of a trap says what it is: `public` or `restricted`. `group` (restricted to the
delegated group) becomes `restricted`, and the traps of an apiary-bound type, which were stored
as public although never shown, are restricted.
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
        ('hornet', '0032_nest_owner'),
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
