"""Seed the hive types in use: TBH, TBH Chandler, Warré, log hive and nucleus.

Ordinary rows afterwards, edited by admins from the administration screen.
Idempotent (keyed on the slug): a row already there is left as it is.
"""

from django.db import migrations

# (slug, name, description, sort order, bar family, max bars, bars per box, max colonies)
HIVE_TYPES = [
    ('tbh', 'TBH', "Ruche horizontale à barrettes (top bar hive). Une cloison permet d'y loger deux colonies.",
     10, 'topbar', 24, None, 2),
    ('tbh-chandler', 'TBH Chandler', "Ruche horizontale à barrettes, modèle de Phil Chandler. Une cloison permet d'y loger deux colonies.",
     20, 'topbar', 24, None, 2),
    ('warre', 'Warré', "Ruche verticale à éléments empilés, garnis de barrettes.",
     30, 'warre', None, 8, 1),
    ('log', 'Ruche tronc', "Tronc évidé, sans barrette.",
     40, '', None, None, 1),
    ('nucleus', 'Nucleus', "Petite ruche à barrettes pour démarrer une colonie ou la déplacer vers un autre rucher.",
     50, 'topbar', 12, None, 1),
]


def seed(apps, schema_editor):
    HiveType = apps.get_model('apiculture', 'HiveType')
    for slug, name, description, order, family, max_bars, per_box, colonies in HIVE_TYPES:
        HiveType.objects.get_or_create(slug=slug, defaults={
            'name': name, 'description': description, 'sort_order': order, 'bar_family': family,
            'max_bars': max_bars, 'bars_per_box': per_box, 'max_colonies': colonies,
        })


class Migration(migrations.Migration):

    dependencies = [
        ('apiculture', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
