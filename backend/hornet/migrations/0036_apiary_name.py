from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hornet", "0035_apiary_host_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="apiary",
            name="name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
