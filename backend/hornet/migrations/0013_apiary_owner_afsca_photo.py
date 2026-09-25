import django.db.models.deletion
import hornet.models
from django.db import migrations, models


def owner_from_creator(apps, schema_editor):
    """Until now the creator was the owner: make it explicit."""
    Apiary = apps.get_model('hornet', 'Apiary')
    Apiary.objects.filter(owner__isnull=True).update(owner=models.F('created_by'))


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0012_user_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='apiary',
            name='owner',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='owned_apiaries', to='hornet.user'),
        ),
        migrations.AddField(
            model_name='apiary',
            name='afsca_number',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='apiary',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to=hornet.models.apiary_photo_path),
        ),
        migrations.AddField(
            model_name='apiary',
            name='photo_thumbnail',
            field=models.ImageField(blank=True, null=True, upload_to=hornet.models.apiary_photo_path),
        ),
        migrations.RunPython(owner_from_creator, migrations.RunPython.noop),
    ]
