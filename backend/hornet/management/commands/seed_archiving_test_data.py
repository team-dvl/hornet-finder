"""Dev-only seed command populating Hornet/Nest test data (derived from hornet_finder_dump.sql) to test archiving/year filtering."""
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from hornet.models import Hornet, Nest

# (longitude, latitude, direction, duration, created_at, mark_color_1, mark_color_2)
# Extracted from hornet_finder_dump.sql (hornet_hornet table), created_by intentionally dropped.
HORNETS = [
    (4.88344967365265, 50.49153769338963, 248, None, '2025-07-22 08:41:59', '', ''),
    (4.883611111111111, 50.49138888888889, 40, None, '2025-07-22 08:45:27', '', ''),
    (4.880277777777779, 50.49166666666667, 53, None, '2025-07-22 22:23:23', 'yellow', ''),
    (4.8829422, 50.5031789, 141, None, '2025-07-23 17:46:55', 'purple', ''),
    (4.88299226, 50.503176, 16, None, '2025-07-26 18:15:15', 'yellow', ''),
    (4.880277777777779, 50.49166666666667, 33, None, '2025-07-22 22:22:40', 'purple', ''),
    (4.880374799, 50.4917446, 145, None, '2025-07-28 17:21:32', 'pink', ''),
    (4.887543474149478, 50.49066283388267, 3, None, '2025-07-30 10:21:42', 'pink', ''),
    (4.85882305540597, 50.48063626051925, 205, None, '2025-07-30 12:34:41', 'blue', ''),
    (4.8865238891, 50.487319694, 3, None, '2025-07-30 12:37:49', 'pink', ''),
    (4.8737571, 50.5029957, 70, None, '2025-08-05 19:27:17', 'red', 'cyan'),
    (4.853805, 50.4794767, 188, None, '2025-08-05 18:59:16', 'pink', 'pink'),
    (4.883819, 50.502784233, 6, None, '2025-08-08 12:22:33', 'yellow', 'green'),
    (4.867372485258148, 50.501064735330196, 285, None, '2025-08-07 19:20:25', 'blue', 'blue'),
    (4.867420847050599, 50.50105363337238, 45, None, '2025-08-10 06:28:10', '', ''),
    (4.87332969903946, 50.4913533371277, 130, None, '2025-08-10 08:52:04', '', ''),
    (4.8849542252, 50.4909314, 325, None, '2025-08-13 21:24:24', 'pink', 'green'),
    (4.850578, 50.475578, 263, None, '2025-08-18 11:13:00', 'green', 'green'),
    (4.8566559, 50.4778237, 246, None, '2025-08-19 10:04:10', 'green', 'green'),
    (4.866777397692204, 50.500865704825266, 270, None, '2025-08-19 18:41:17', '', ''),
    (4.867400927469135, 50.50100048188388, 270, None, '2025-08-19 18:41:41', '', ''),
    (4.860315, 50.47748, 240, None, '2025-08-25 17:27:53', '', ''),
    (4.88285, 50.496383, 56, None, '2025-08-25 19:08:57', 'pink', 'cyan'),
    (4.88285, 50.496383, 211, None, '2025-08-25 19:09:22', 'pink', 'green'),
]

# (longitude, latitude, public_place, address, destroyed, destroyed_at, created_at, comments)
# Extracted from hornet_finder_dump.sql (hornet_nest table), created_by intentionally dropped.
NESTS = [
    (4.86425, 50.477577, False, '', True, '2025-07-26 12:53:13', '2025-07-26 13:14:11', None),
    (4.873675704002381, 50.510107293198296, False, '51, Rue des Minières, 5020 Vedrin, Belgique', False, None, '2025-08-07 03:01:35', 'perché haut'),
    (4.882811307907105, 50.486070858803934, True, 'Chemin i1, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5004, Belgique', True, '2025-08-15 10:30:00', '2025-08-05 10:01:49', 'rapporté par L.V.'),
    (4.868941605091096, 50.507850558991805, False, '3-5, Rue Joseph Lemineur, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', False, None, '2025-08-25 19:11:13', 'Nid de frelons européens'),
    (4.876368641853333, 50.51497348898347, True, 'RAVeL L142, Daussoulx, Namur, Wallonie, 5020, Belgique', False, None, '2025-08-29 12:38:22', "Nid probable, situé dans le 3ème saule à droite en partant du carrefour, direction Cognelée."),
    (4.874525964260102, 50.48278554376576, True, '169, Rue Frères Biéva, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', False, None, '2025-09-15 12:38:33', 'sur le pilône électrique'),
    (4.87244188785553, 50.50350565812975, False, 'Pharmacie Themans, 3, Rue Gustave Guidet, Frizet, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', False, None, '2025-10-07 13:32:34', 'Rapporté par Bérengere'),
    (4.883739352226257, 50.495043298277714, False, '2, Rue Alfred Brasseur, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', False, None, '2025-10-08 08:24:58', 'Nid signalé par le voisinage'),
    (4.886711239814759, 50.48526192450412, False, '14, Rue Sergent Delisse, Bouge, Namur, Fernelmont, Namur, Wallonie, 5004, Belgique', True, '2025-10-09 18:00:00', '2025-10-01 07:24:42', 'gros nid dans arbre. Signalé le 30 septembre 2025.'),
    (4.869915246963502, 50.48224621827876, False, '3, Rue des Prairies, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', True, '2025-10-07 17:00:00', '2025-10-11 11:41:40', None),
    (4.885371073425695, 50.48743879171348, True, 'Fond de Bouge, Bouge, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', True, '2025-10-13 18:00:00', '2025-10-15 09:41:59', 'signalé par L.V. - détruit 13 oct 2025'),
    (4.88581359267394, 50.485656957538744, False, '2, Rue du Bataillon des Canaris, Bouge, Namur, Fernelmont, Namur, Wallonie, 5004, Belgique', True, '2025-10-13 18:00:00', '2025-10-15 09:44:18', 'nid signalé par L.V., détruit le 13 oct 2025'),
    (4.87820327281952, 50.51597463844798, False, '22, Rue du Chèvrefeuille, Daussoulx, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', False, None, '2025-10-16 02:40:30', 'Nid signalé sur facebook, localisation incertaine'),
    (4.870655536651612, 50.47051436619157, False, '44, Rue Léanne, Bomel, Namur, Fernelmont, Namur, Wallonie, 5000, Belgique', False, None, '2025-10-23 06:53:53', None),
    (4.866889715194703, 50.48093030653181, False, '28, Rue de la Rose des Vents, Vedrin, Namur, Wallonie, 5020, Belgique', False, None, '2025-10-23 07:21:40', 'signalement CRA-2722'),
    (4.886294218234651, 50.49172576521946, False, '', False, None, '2025-10-23 09:30:22', 'hauteur 12m'),
    (4.882476031780244, 50.4902006451007, False, '38, Rue Joseph Wanet, Vedrin, Namur, Fernelmont, Namur, Wallonie, 5020, Belgique', True, '2025-10-16 18:00:00', '2025-10-23 06:44:53', 'nid signalé sur facebook par le propriétaire'),
    (4.872968941926957, 50.475225891917034, False, '96, Avenue Arthur Procès, Bomel, Namur, Fernelmont, Namur, Wallonie, 5000, Belgique', False, None, '2025-11-02 12:07:32', None),
    (4.862378239631654, 50.497978229653995, False, "82, Su l'Tîdge, Frizet, Saint-Marc, Namur, Fernelmont, Namur, Wallonie, 5003, Belgique", False, None, '2025-11-18 11:55:12', 'Arbre 10mètres .70 cm'),
    (4.898309111595154, 50.51716507474181, False, '85, Rue Basse Chaussée, Cognelée, Namur, Wallonie, 5022, Belgique', False, None, '2025-11-18 13:02:50', 'Arbre hauteur15 mètres, 80 cm diamètre'),
]


def _parse(dt_str):
    if dt_str is None:
        return None
    return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=dt_timezone.utc)


def _shift_to_current_year(dt, current_year):
    return dt.replace(year=current_year) if dt else None


class Command(BaseCommand):
    help = (
        "Seeds dev-only Hornet/Nest test data (derived from hornet_finder_dump.sql) "
        "with a mix of past-year and current-year created_at, to test archiving/year filtering. "
        "Apiary is never touched."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush', action='store_true',
            help='Delete ALL existing Hornet and Nest rows before seeding (dev database only).',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("This command can only be run when DEBUG=True (dev environment).")

        if options['flush']:
            self.stdout.write(self.style.WARNING("Flushing all Hornet and Nest rows..."))
            Hornet.objects.all().delete()
            Nest.objects.all().delete()

        current_year = timezone.now().year

        created_hornets = 0
        for lon, lat, direction, duration, created_at, color1, color2 in HORNETS:
            original_created_at = _parse(created_at)
            for created_at_value in (original_created_at, _shift_to_current_year(original_created_at, current_year)):
                hornet = Hornet(
                    longitude=lon, latitude=lat, direction=direction, duration=duration,
                    mark_color_1=color1, mark_color_2=color2, created_by=None,
                )
                hornet.save()
                Hornet.objects.filter(pk=hornet.pk).update(created_at=created_at_value)
                created_hornets += 1

        created_nests = 0
        for lon, lat, public_place, address, destroyed, destroyed_at, created_at, comments in NESTS:
            original_created_at = _parse(created_at)
            original_destroyed_at = _parse(destroyed_at)
            for year_created_at, year_destroyed_at in (
                (original_created_at, original_destroyed_at),
                (
                    _shift_to_current_year(original_created_at, current_year),
                    _shift_to_current_year(original_destroyed_at, current_year),
                ),
            ):
                nest = Nest(
                    longitude=lon, latitude=lat, public_place=public_place, address=address,
                    destroyed=destroyed, destroyed_at=year_destroyed_at, comments=comments, created_by=None,
                )
                nest.save()
                Nest.objects.filter(pk=nest.pk).update(created_at=year_created_at)
                created_nests += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {created_hornets} hornets and {created_nests} nests "
            f"(original years + duplicated in {current_year}). Apiary untouched."
        ))
