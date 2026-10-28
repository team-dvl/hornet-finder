"""Platform-wide settings: the notifications held back, the scheduler's last pass."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hornet", "0032_nest_owner"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlatformSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("paused_kinds", models.JSONField(blank=True, default=list)),
                ("updated_at", models.DateTimeField(blank=True, null=True)),
                ("updated_by", models.UUIDField(blank=True, null=True)),
                ("scheduler_seen_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "verbose_name_plural": "platform settings",
            },
        ),
    ]
