from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0013_apiary_owner_afsca_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='apiary',
            name='address',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
