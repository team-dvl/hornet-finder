from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0018_group_invitations'),
    ]

    operations = [
        migrations.AddField(
            model_name='groupinvitation',
            name='last_notified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='groupinvitation',
            name='reminders_sent',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
