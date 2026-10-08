"""Write the AFSCA numbers already recorded as `X.XXX.XXX.XXX`.

Only numbers made of 10 digits and separators are rewritten; any other value
is left untouched (see prod note 0019 to list them).
"""

from django.db import migrations

from hornet.afsca import normalize_afsca


def format_numbers(apps, schema_editor):
    Apiary = apps.get_model('hornet', 'Apiary')
    for apiary in Apiary.objects.exclude(afsca_number='').only('id', 'afsca_number'):
        normalized = normalize_afsca(apiary.afsca_number)
        if normalized and normalized != apiary.afsca_number:
            Apiary.objects.filter(pk=apiary.pk).update(afsca_number=normalized)


class Migration(migrations.Migration):

    dependencies = [
        ("hornet", "0022_nest_photos"),
    ]

    operations = [
        migrations.RunPython(format_numbers, migrations.RunPython.noop),
    ]
