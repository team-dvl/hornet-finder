"""
Rebuild the audit trail of the retention period from the existing data
(see audit/backfill.py). Runs once, before the API records anything: the
container applies the migrations before it serves.
"""

from datetime import timedelta

from django.conf import settings
from django.db import migrations
from django.utils import timezone


def rebuild(apps, schema_editor):
    from audit import backfill

    cutoff = timezone.now() - timedelta(days=settings.AUDIT_RETENTION_DAYS)
    count = backfill.run(apps, cutoff)
    if count:
        print(f"\n  Audit trail: {count} event(s) rebuilt since {cutoff:%Y-%m-%d}", end='')


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0001_initial'),
        ('hornet', '0023_afsca_number_format'),
    ]

    # Rebuilt events cannot be told from later ones once the trail runs, and
    # the table is append-only: going back leaves them (0001 drops the table)
    operations = [
        migrations.RunPython(rebuild, migrations.RunPython.noop),
    ]
