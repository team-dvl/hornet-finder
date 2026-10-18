"""Notifications about nests, their kinds and defaults, and the end of the season."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from audit.models import AuditEvent
from . import nest_alerts, nest_season
from . import notification_kinds as kinds
from .models import (
    Apiary, ApiaryGroupPermission, BeekeeperGroup, Nest, NestAlert, NestEvent, PushNotification,
    PushSubscription, User,
)
from .push_views import PushViewSet

KEYS = {'VAPID_PUBLIC_KEY': 'public', 'VAPID_PRIVATE_KEY': 'private', 'PUSH_SYNC': True}


def at(day, hour=9, minute=5):
    """A local date-time in October 2026; the 20th is a Tuesday, the 25th a Sunday."""
    return timezone.make_aware(datetime(2026, 10, day, hour, minute))


@override_settings(**KEYS)
class NestAlertTestCase(TestCase):
    def setUp(self):
        webpush = patch('hornet.push.webpush', return_value=MagicMock(status_code=201))
        webpush.start()
        self.addCleanup(webpush.stop)
        self.reporter = self.person('/trappers')
        self.coordinator = self.person('/hunters/admin')
        self.admin = self.person('/admins')
        self.beekeeper = self.person('/beekeepers')  # has not chosen "Tous les nouveaux nids"
        self.owner = self.person('/beekeepers')  # owns an apiary 560 m from the nest
        self.association_admin = self.person('/beekeepers/vsab/admin')
        self.hunter = self.person('/hunters')
        self.no_device = self.person('/hunters/admin', device=False)

        apiary = Apiary.objects.create(latitude=50.505, longitude=4.5, owner=self.owner)
        group = BeekeeperGroup.objects.create(name='vsab', path='/beekeepers/vsab')
        ApiaryGroupPermission.objects.create(apiary=apiary, group=group, can_read=True)

    def person(self, path, device=True):
        user = User.objects.create(guid=uuid.uuid4(), group_paths=[path])
        if device:
            PushSubscription.objects.create(user=user, endpoint=f'https://push.example/{user.guid}',
                                            p256dh='p', auth='a', device='Android · Chrome')
        return user

    def report(self, by=None, outcome='', created=None, **fields):
        nest = Nest.objects.create(latitude=50.5, longitude=4.5, created_by=by or self.reporter,
                                   owner=by or self.reporter, address='Rue de Hemptinne 3, 5020 Vedrin, Namur', **fields)
        event = NestEvent.objects.create(nest=nest, kind='report', performed_at=nest.created_at,
                                         performed_by=by or self.reporter, outcome=outcome)
        if created:
            NestEvent.objects.filter(pk=event.pk).update(created_at=created)
        nest.recompute_status()
        return nest

    def received(self, user):
        return list(PushNotification.objects.filter(recipient=user.guid).order_by('created_at')
                    .values_list('title', 'body'))


class NewNestTests(NestAlertTestCase):
    def test_who_is_told_of_a_new_nest(self):
        nest = self.report(created=at(20, 8))
        result = nest_alerts.run(now=at(20))
        self.assertEqual(result['notifications'], 4)
        self.assertEqual(self.received(self.coordinator),
                         [("Nouveau nid signalé", f"Nid #{nest.pk} à Vedrin · lieu privé.")])
        self.assertEqual(len(self.received(self.admin)), 1)
        self.assertEqual(self.received(self.owner),
                         [("Nid près de votre rucher", f"Nid #{nest.pk} à Vedrin, à moins de 1 km de votre rucher.")])
        self.assertEqual(self.received(self.association_admin)[0][0], "Nid près d'un rucher de votre association")
        for user in (self.beekeeper, self.hunter, self.reporter, self.no_device):
            self.assertEqual(self.received(user), [])
        self.assertIsNotNone(NestEvent.objects.get(nest=nest).alerted_at)
        # Nothing twice
        self.assertEqual(nest_alerts.run(now=at(20, 10))['notifications'], 0)

    def test_a_beekeeper_chooses_all_new_nests(self):
        kinds.choose(self.beekeeper, kinds.NEST_NEW, True)
        self.beekeeper.save()
        self.report(created=at(20, 8))
        nest_alerts.run(now=at(20))
        self.assertEqual(len(self.received(self.beekeeper)), 1)

    def test_a_coordinator_may_turn_it_off(self):
        self.coordinator.notification_prefs = {kinds.NEST_NEW: False}
        self.coordinator.save()
        self.report(created=at(20, 8))
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.coordinator), [])

    def test_the_owner_who_turned_off_nearby_nests_may_still_want_all_of_them(self):
        self.owner.notification_prefs = {kinds.NEST_NEAR_APIARY: False, kinds.NEST_NEW: True}
        self.owner.save()
        self.report(created=at(20, 8))
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.owner)[0][0], "Nouveau nid signalé")

    def test_an_empty_nest_only_tells_the_coordinators(self):
        self.report(outcome='empty', created=at(20, 8))
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.coordinator)[0][0], "Nid vide signalé")
        self.assertEqual(self.received(self.owner), [])
        self.assertEqual(self.received(self.association_admin), [])

    def test_nobody_is_told_of_their_own_report(self):
        self.report(by=self.coordinator, created=at(20, 8))
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.coordinator), [])

    def test_the_night_waits_for_the_morning(self):
        self.report(created=at(24, 23))
        self.assertIn('skipped', nest_alerts.run(now=at(25, 9, 30)))  # Sunday: 10 am
        self.assertEqual(nest_alerts.run(now=at(25, 10, 5))['notifications'], 4)

    def test_several_nests_make_a_summary(self):
        for _ in range(3):
            self.report(created=at(20, 7))
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.coordinator), [("3 nouveaux nids signalés", "Vedrin, Vedrin, Vedrin.")])
        self.assertEqual(NestAlert.objects.filter(user=self.coordinator).count(), 3)

    def test_old_news_is_dropped(self):
        nest = self.report(created=at(17, 9))
        self.assertEqual(nest_alerts.run(now=at(20))['notifications'], 0)
        self.assertIsNotNone(NestEvent.objects.get(nest=nest).alerted_at)

    def test_a_nest_already_rejected_calls_nobody(self):
        nest = self.report(created=at(20, 8))
        visit = NestEvent.objects.create(nest=nest, kind='visit', outcome='other_species',
                                         performed_at=at(20, 8, 30), performed_by=self.coordinator)
        NestEvent.objects.filter(pk=visit.pk).update(created_at=at(20, 8, 30))
        nest.recompute_status()
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.owner), [])
        # The reporter still learns what became of it
        self.assertEqual(len(self.received(self.reporter)), 1)

    def test_locality(self):
        self.assertEqual(nest_alerts.locality('Rue de Hemptinne 3, 5020 Vedrin, Namur, Belgique'), 'Vedrin')
        self.assertEqual(nest_alerts.locality('Chaussée de Louvain 1200, 5020 Vedrin'), 'Vedrin')
        self.assertEqual(nest_alerts.locality('Dans le parc'), '')


class FollowupTests(NestAlertTestCase):
    def setUp(self):
        super().setUp()
        self.nest = self.report(created=at(19))
        NestEvent.objects.update(alerted_at=at(19))

    def record(self, kind, by, **fields):
        when = fields.pop('performed_at', at(20, 8))
        event = NestEvent.objects.create(nest=self.nest, kind=kind, performed_at=when, performed_by=by, **fields)
        NestEvent.objects.filter(pk=event.pk).update(created_at=when)  # recorded then, not when the test runs
        self.nest.recompute_status()
        return event

    def test_the_reporter_follows_the_visit_and_the_destruction(self):
        self.record('visit', self.coordinator, outcome='active')
        nest_alerts.run(now=at(20))
        self.record('destruction', self.coordinator, performed_at=at(20, 9))
        nest_alerts.run(now=at(20, 11))
        self.assertEqual(self.received(self.reporter), [
            ("Votre signalement a avancé", f"Le nid #{self.nest.pk} est confirmé : c'est bien un nid de frelons asiatiques."),
            ("Votre signalement a avancé", f"Le nid #{self.nest.pk} a été neutralisé le 20 octobre. Merci !"),
        ])

    def test_not_when_they_declared_it_themselves(self):
        self.record('destruction', self.reporter)
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.reporter), [])

    def test_the_reporter_may_turn_it_off(self):
        self.reporter.notification_prefs = {kinds.NEST_FOLLOWUP: False}
        self.reporter.save()
        self.record('visit', self.coordinator, outcome='not_found')
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.reporter), [])

    def test_the_owner_follows_it_once_handed_over(self):
        Nest.objects.filter(pk=self.nest.pk).update(owner=self.hunter)
        self.record('visit', self.coordinator, outcome='active')
        nest_alerts.run(now=at(20))
        self.assertEqual(self.received(self.reporter), [])
        self.assertEqual([title for title, _ in self.received(self.hunter)], ["Votre signalement a avancé"])


class SeasonEndTests(TestCase):
    def setUp(self):
        self.open = Nest.objects.create(latitude=50.5, longitude=4.5)
        self.destroyed = Nest.objects.create(latitude=50.5, longitude=4.5)
        for nest in (self.open, self.destroyed):
            Nest.objects.filter(pk=nest.pk).update(created_at=timezone.make_aware(datetime(2025, 9, 1)))
            NestEvent.objects.create(nest=nest, kind='report', performed_at=timezone.make_aware(datetime(2025, 9, 1)),
                                     alerted_at=timezone.now())
        NestEvent.objects.create(nest=self.destroyed, kind='destruction',
                                 performed_at=timezone.make_aware(datetime(2025, 9, 5)), alerted_at=timezone.now())
        for nest in (self.open, self.destroyed):
            nest.recompute_status()

    def test_open_nests_are_abandoned_on_the_first_of_march(self):
        Nest.objects.filter(pk=self.destroyed.pk).update(contact_phone='0470 12 34 56')
        self.assertEqual(nest_season.run(now=timezone.make_aware(datetime(2026, 2, 28, 12))),
                         {'abandoned': 0, 'phones_erased': 0})
        self.assertEqual(nest_season.run(now=timezone.make_aware(datetime(2026, 3, 1, 0, 10))),
                         {'abandoned': 1, 'phones_erased': 1})
        self.open.refresh_from_db()
        self.destroyed.refresh_from_db()
        self.assertEqual((self.open.status, self.destroyed.status), (Nest.STATUS_ABANDONED, Nest.STATUS_DESTROYED))
        self.assertEqual(self.destroyed.contact_phone, '')
        self.assertEqual(self.open.events.first().kind, NestEvent.KIND_SEASON_END)
        self.assertTrue(AuditEvent.objects.filter(action='nest.season_ended', refs__contains=[f'nest:{self.open.pk}'])
                        .exists())
        # Again: nothing left
        self.assertEqual(nest_season.run(now=timezone.make_aware(datetime(2026, 3, 2))),
                         {'abandoned': 0, 'phones_erased': 0})


class PreferenceTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def call(self, method, user, data=None):
        request = getattr(self.factory, method)('/push/preferences/', data, format='json')
        force_authenticate(request, user=_Token(user))
        return PushViewSet.as_view({'get': 'preferences', 'put': 'set_preferences'})(request)

    def kinds_of(self, response):
        return {kind['id']: kind['enabled'] for kind in response.data['kinds']}

    def test_each_one_sees_the_kinds_that_concern_them(self):
        trapper = User.objects.create(guid=uuid.uuid4(), group_paths=['/trappers'])
        beekeeper = User.objects.create(guid=uuid.uuid4(), group_paths=['/beekeepers/vsab'])
        coordinator = User.objects.create(guid=uuid.uuid4(), group_paths=['/hunters/admin'])
        self.assertNotIn(kinds.NEST_NEW, self.kinds_of(self.call('get', trapper)))
        self.assertTrue(self.kinds_of(self.call('get', trapper))[kinds.NEST_FOLLOWUP])
        self.assertEqual({k: v for k, v in self.kinds_of(self.call('get', beekeeper)).items() if k.startswith('nest')},
                         {kinds.NEST_NEW: False, kinds.NEST_NEAR_APIARY: True, kinds.NEST_FOLLOWUP: True})
        coordinator_kinds = self.kinds_of(self.call('get', coordinator))
        self.assertTrue(coordinator_kinds[kinds.NEST_NEW])
        self.assertNotIn(kinds.NEST_NEAR_APIARY, coordinator_kinds)

    def test_only_what_differs_from_the_default_is_stored(self):
        beekeeper = User.objects.create(guid=uuid.uuid4(), group_paths=['/beekeepers'])
        response = self.call('put', beekeeper, {kinds.NEST_NEW: True, kinds.NEST_FOLLOWUP: False})
        self.assertTrue(self.kinds_of(response)[kinds.NEST_NEW])
        beekeeper.refresh_from_db()
        self.assertEqual(beekeeper.notification_prefs, {kinds.NEST_NEW: True, kinds.NEST_FOLLOWUP: False})
        self.call('put', beekeeper, {kinds.NEST_NEW: False})
        beekeeper.refresh_from_db()
        self.assertEqual(beekeeper.notification_prefs, {kinds.NEST_FOLLOWUP: False})


class _Token:
    """The requester as the push views see them."""

    def __init__(self, user):
        self.guid = str(user.guid)
        self.roles = ['beekeeper']
        self.token_info = {'membership': user.group_paths}

    @property
    def is_authenticated(self):
        return True
