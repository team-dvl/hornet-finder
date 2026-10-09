from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils import timezone


class AuditEvent(models.Model):
    """
    One business action, recorded when it happened. Append-only: a database
    trigger refuses any UPDATE, and any DELETE outside the retention purge
    (see `audit.recorder.purge_expired`).

    The actor is a Keycloak GUID, deliberately not a foreign key: the event
    outlives the account. Names are resolved when the trail is read, never
    stored.
    """

    SOURCE_API = 'api'
    SOURCE_SYSTEM = 'system'
    SOURCE_BACKFILL = 'backfill'
    SOURCE_CHOICES = [
        (SOURCE_API, 'API'),
        (SOURCE_SYSTEM, 'System'),
        (SOURCE_BACKFILL, 'Rebuilt from existing data'),
    ]

    id = models.BigAutoField(primary_key=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    # Null when unknown (rebuilt events) or when nobody signed in (export links)
    actor = models.UUIDField(null=True, blank=True, db_index=True)
    # Roles the actor held at the time, e.g. whether they acted as an admin
    actor_roles = ArrayField(models.CharField(max_length=32), default=list, blank=True)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_API)
    # `<domain>.<verb>`, one of audit.actions.ACTIONS
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=32)
    target_id = models.CharField(max_length=256, blank=True, default='')
    # How the target read at the time (an address, a name, a QR code), so the
    # trail stays readable once the object changed or is gone
    target_label = models.CharField(max_length=255, blank=True, default='')
    # Every object the action concerns, as `<type>:<id>` (the target included):
    # what "the history of trap 42" or "of group /beekeepers/x" searches
    refs = ArrayField(models.CharField(max_length=300), default=list, blank=True)
    # Update: {field: [before, after]}; deletion: the object as it was;
    # creation and other actions: what describes them
    changes = models.JSONField(default=dict, blank=True)
    # Shared by the events of one request
    request_id = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        indexes = [
            models.Index(fields=['-occurred_at', '-id'], name='audit_occurred_idx'),
            models.Index(fields=['target_type', 'target_id'], name='audit_target_idx'),
            GinIndex(fields=['refs'], name='audit_refs_idx'),
        ]

    def __str__(self):
        return f"{self.occurred_at:%Y-%m-%d %H:%M} {self.action} {self.target_type}:{self.target_id}"
