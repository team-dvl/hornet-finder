import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0025_trap_partial_emptying'),
    ]

    operations = [
        migrations.CreateModel(
            name='PushNotification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sender', models.UUIDField(db_index=True)),
                ('group_path', models.CharField(max_length=255)),
                ('recipient', models.UUIDField(blank=True, null=True)),
                ('title', models.CharField(max_length=60)),
                ('body', models.CharField(max_length=200)),
                ('recipients_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='PushSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('endpoint', models.TextField(unique=True)),
                ('p256dh', models.CharField(max_length=255)),
                ('auth', models.CharField(max_length=255)),
                ('device', models.CharField(blank=True, default='', max_length=64)),
                ('installed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                           related_name='push_subscriptions', to='hornet.user')),
            ],
        ),
        migrations.CreateModel(
            name='PushDelivery',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('device', models.CharField(blank=True, default='', max_length=64)),
                ('installed', models.BooleanField(default=False)),
                ('user', models.UUIDField(db_index=True)),
                ('status', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('error', models.CharField(blank=True, default='', max_length=200)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('received_at', models.DateTimeField(blank=True, null=True)),
                ('notification', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                                   related_name='deliveries', to='hornet.pushnotification')),
                ('subscription', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                                   related_name='deliveries', to='hornet.pushsubscription')),
            ],
        ),
    ]
