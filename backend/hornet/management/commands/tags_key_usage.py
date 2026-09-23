"""Count the live tags signed with each HMAC key, before retiring one."""

from django.core.management.base import BaseCommand

from hornet.tags import TagConfigurationError, get_config, key_usage


class Command(BaseCommand):
    help = ("Count the tags signed with each key index. Removing a key from "
            "TAG_HMAC_KEYS invalidates every tag it signed.")

    def handle(self, *args, **options):
        try:
            get_config()
        except TagConfigurationError as exc:
            self.stderr.write(self.style.WARNING(f"Configuration: {exc}"))
        self.stdout.write(f"{'key':>4}  {'state':<12}{'associated':>11}{'free':>7}{'revoked':>9}")
        for row in key_usage():
            self.stdout.write(f"{row['index']:>4}  {row['state']:<12}"
                              f"{row['associated']:>11}{row['free']:>7}{row['revoked']:>9}")
