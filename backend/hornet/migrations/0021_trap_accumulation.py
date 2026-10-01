"""Readings of traps that accumulate their catches.

A reading now records what the trap holds and whether it was emptied; its
catches are derived from it. Every reading recorded so far followed the old
rule (count what you take out), so it saw exactly its catches and was emptied:
the derived catches stay the same and no trap is left holding anything.
"""

from django.db import migrations, models
from django.db.models import F


def backfill_readings(apps, schema_editor):
    TrapEvent = apps.get_model('hornet', 'TrapEvent')
    TrapEvent.objects.filter(kind='catch').update(observed_quantity=F('quantity'), emptied=True)


class Migration(migrations.Migration):

    dependencies = [
        ("hornet", "0020_stat_export_job"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="trapevent",
            name="trapevent_catch_fields",
        ),
        migrations.AddField(
            model_name="trap",
            name="contents",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trapevent",
            name="emptied",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trapevent",
            name="observed_quantity",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="traptype",
            name="accumulates",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_readings, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="trapevent",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("kind", "catch"),
                        ("quantity__gte", 0),
                        ("species__isnull", False),
                    ),
                    models.Q(
                        models.Q(("kind", "catch"), _negated=True),
                        ("bycatch_counted__isnull", True),
                        ("emptied__isnull", True),
                        ("observed_quantity__isnull", True),
                        ("quantity__isnull", True),
                        ("species__isnull", True),
                    ),
                    _connector="OR",
                ),
                name="trapevent_catch_fields",
            ),
        ),
    ]
