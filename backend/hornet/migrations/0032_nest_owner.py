"""
The owner of a nest, distinct from its reporter: every existing nest starts
owned by whoever reported it.
"""

import django.db.models.deletion
from django.db import migrations, models


def forwards(apps, schema_editor):
    Nest = apps.get_model('hornet', 'Nest')
    Nest.objects.filter(owner__isnull=True).update(owner=models.F('created_by'))


class Migration(migrations.Migration):

    dependencies = [
        ("hornet", "0031_nest_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="nest",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="owned_nests",
                to="hornet.user",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
