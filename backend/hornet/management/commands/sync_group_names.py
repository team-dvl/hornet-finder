"""Rename the local mirrors of Keycloak groups after their Keycloak display name."""

from django.core.management.base import BaseCommand

from hornet.models import BeekeeperGroup
from hornet.trap_views import _group_for_path


class Command(BaseCommand):
    help = ("Give every local group the display name of its Keycloak group "
            "(its description, else the group name). Groups unknown to Keycloak "
            "keep a name derived from their path.")

    def handle(self, *args, **options):
        for group in BeekeeperGroup.objects.order_by('path'):
            before = group.name
            after = _group_for_path(group.path).name
            mark = '=' if before == after else '→'
            self.stdout.write(f"{group.path}: {before} {mark} {after}")
