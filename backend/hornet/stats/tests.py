import io
import math
from datetime import date, datetime, time
from unittest.mock import patch

from rest_framework.test import force_authenticate

from ..models import Trap, TrapEvent, TrapType
from ..tests import FakeTrapUser, TrapTestCase
from .confidence import poisson_interval, wilson_interval
from .exposure import load_readings, tally
from .periods import LOCAL, PeriodError, buckets, resolve_period
from .views import StatDetailView, StatExportLinkView, StatsCatalogueView


def at(day: date, hour: int = 0):
    return datetime.combine(day, time(hour), tzinfo=LOCAL)


class PeriodTests(TrapTestCase):
    today = date(2026, 9, 27)

    def test_seasons_and_year(self):
        spring = resolve_period({'period': 'season', 'season': 'spring', 'year': '2025'}, self.today)
        self.assertEqual((spring.start, spring.end, spring.label),
                         (date(2025, 2, 1), date(2025, 6, 15), 'Printemps 2025'))
        summer = resolve_period({'period': 'season', 'season': 'summer', 'year': '2025'}, self.today)
        self.assertEqual((summer.start, summer.end), (date(2025, 6, 16), date(2025, 9, 30)))
        late = resolve_period({'period': 'season', 'season': 'late', 'year': '2025'}, self.today)
        self.assertEqual(late.start, date(2025, 6, 16))
        year = resolve_period({'period': 'year', 'year': '2025'}, self.today)
        self.assertEqual((year.start, year.end, year.label),
                         (date(2025, 1, 1), date(2025, 12, 31), 'Année 2025'))

    def test_a_running_period_stops_today(self):
        year = resolve_period({'period': 'year'}, self.today)
        self.assertEqual((year.start, year.end), (date(2026, 1, 1), self.today))
        d7 = resolve_period({'period': 'd7'}, self.today)
        self.assertEqual((d7.start, d7.end), (date(2026, 9, 21), self.today))
        month = resolve_period({'period': 'month'}, self.today)
        self.assertEqual((month.start, month.label), (date(2026, 9, 1), 'Septembre 2026'))

    def test_invalid_periods(self):
        for params in ({'period': 'forever'}, {'period': 'season', 'season': 'winter'},
                       {'period': 'year', 'year': '2031'},
                       {'period': 'custom', 'from': '2025-05-01', 'to': '2025-04-01'},
                       {'period': 'custom', 'from': 'x'}):
            with self.assertRaises(PeriodError, msg=params):
                resolve_period(params, self.today)
        with self.assertRaises(PeriodError):
            resolve_period({'period': 'season', 'season': 'spring', 'year': '2026'},
                           date(2026, 1, 10))

    def test_weeks_are_iso_and_clipped_to_the_period(self):
        spring = resolve_period({'period': 'season', 'season': 'spring', 'year': '2025'}, self.today)
        weeks = buckets(spring, 'week')
        # 1 February 2025 is a Saturday: the first week holds two days
        self.assertEqual((weeks[0].key, weeks[0].start, weeks[0].end),
                         ('S05', date(2025, 2, 1), date(2025, 2, 2)))
        self.assertEqual(weeks[1].key, 'S06')
        self.assertEqual(weeks[-1].end, date(2025, 6, 15))
        months = buckets(spring, 'month')
        self.assertEqual([m.key for m in months],
                         ['févr. 2025', 'mars 2025', 'avr. 2025', 'mai 2025', 'juin 2025'])
        self.assertEqual(months[-1].end, date(2025, 6, 15))

    def test_previous_year(self):
        spring = resolve_period({'period': 'season', 'season': 'spring', 'year': '2025'}, self.today)
        previous = spring.previous_year()
        self.assertEqual((previous.start, previous.end, previous.label),
                         (date(2024, 2, 1), date(2024, 6, 15), 'Printemps 2024'))


class ConfidenceTests(TrapTestCase):
    def test_exact_poisson_bounds(self):
        # Reference values of the exact (Garwood) interval
        for count, (low, high) in {0: (0, 3.689), 1: (0.0253, 5.572), 20: (12.217, 30.888)}.items():
            got = poisson_interval(count)
            self.assertAlmostEqual(got[0], low, places=3)
            self.assertAlmostEqual(got[1], high, places=3)

    def test_wilson(self):
        low, high = wilson_interval(12, 40)
        self.assertAlmostEqual(low, 0.181, places=3)
        self.assertAlmostEqual(high, 0.454, places=3)
        self.assertIsNone(wilson_interval(0, 0))


class StatsTestCase(TrapTestCase):
    """A trap journal written directly, in March 2025."""

    def setUp(self):
        super().setUp()
        # The fixture trap was installed today: move it into the past
        self.trap.events.all().delete()
        self.install(self.trap, date(2025, 3, 1))

    def install(self, trap, day, kind=TrapEvent.KIND_INSTALLATION):
        return TrapEvent.objects.create(trap=trap, kind=kind, performed_at=at(day))

    def reading(self, trap, day, hornets, others=0, bycatch=None):
        batch = f'{trap.id:08d}-0000-0000-0000-{day.toordinal():012d}'
        TrapEvent.objects.create(trap=trap, kind=TrapEvent.KIND_CATCH, performed_at=at(day),
                                 species=self.velutina, quantity=hornets, batch=batch,
                                 bycatch_counted=bycatch)
        if others:
            TrapEvent.objects.create(trap=trap, kind=TrapEvent.KIND_CATCH, performed_at=at(day),
                                     species=self.other_species, quantity=others, batch=batch,
                                     bycatch_counted=bycatch)

    def make_trap(self, **fields):
        values = {'latitude': 50.5, 'longitude': 4.5, 'owner': self.owner,
                  'trap_type': self.trap_type, 'installed_at': date(2025, 3, 1)}
        values.update(fields)
        trap = Trap.objects.create(**values)
        self.install(trap, date(2025, 3, 1))
        return trap

    def stat(self, stat_id, query, user=None):
        request = self.factory.get(f'/stats/{stat_id}/', query)
        force_authenticate(request, user=user or self.admin_user)
        return StatDetailView.as_view()(request, stat_id=stat_id)

    MARCH = {'period': 'custom', 'from': '2025-03-01', 'to': '2025-03-31'}


class ExposureTests(StatsTestCase):
    def test_catches_are_spread_over_their_exposure(self):
        self.reading(self.trap, date(2025, 3, 15), 14)
        response = self.stat('traps-catches', {**self.MARCH, 'granularity': 'week',
                                                'compare': 'false'})
        self.assertEqual(response.status_code, 200, response.data)
        rows = {row['bucket']: row for row in response.data['rows']}
        # 14 days of exposure: 2 in S09 (1-2 March), 7 in S10, 5 in S11 (10-14 March)
        self.assertAlmostEqual(rows['S09']['hornets'], 2)
        self.assertAlmostEqual(rows['S10']['hornets'], 7)
        self.assertAlmostEqual(rows['S11']['hornets'], 5)
        self.assertEqual(rows['S12']['hornets'], 0)
        self.assertEqual(rows['S11']['readings'], 1)
        totals = response.data['totals']
        self.assertAlmostEqual(totals['hornets'], 14)
        self.assertAlmostEqual(totals['trap_days'], 14, places=1)
        # One hornet a day is seven a week
        self.assertAlmostEqual(totals['rate'], 7, places=2)
        self.assertLess(totals['rate_low'], 7)
        self.assertGreater(totals['rate_high'], 7)

    def test_a_reading_at_zero_brings_effort_without_catches(self):
        self.reading(self.trap, date(2025, 3, 8), 7)
        self.reading(self.trap, date(2025, 3, 15), 0, bycatch=True)
        totals = self.stat('traps-catches', {**self.MARCH, 'compare': 'false'}).data['totals']
        self.assertAlmostEqual(totals['trap_days'], 14, places=1)
        self.assertAlmostEqual(totals['rate'], 3.5, places=2)

    def test_a_removal_ends_the_exposure(self):
        self.reading(self.trap, date(2025, 3, 5), 4)
        self.install(self.trap, date(2025, 3, 6), TrapEvent.KIND_REMOVAL)
        self.install(self.trap, date(2025, 3, 20))
        self.reading(self.trap, date(2025, 3, 22), 2)
        readings = load_readings({self.trap.id: self.trap_type.id}, at(date(2025, 3, 1)),
                                 at(date(2025, 4, 1)))
        local = lambda moment: moment.astimezone(LOCAL).date()  # noqa: E731
        self.assertEqual([(local(r.start), local(r.end), r.hornets) for r in readings],
                         [(date(2025, 3, 1), date(2025, 3, 5), 4),
                          (date(2025, 3, 20), date(2025, 3, 22), 2)])
        whole = tally(readings, [(at(date(2025, 3, 1)), at(date(2025, 4, 1)))])[0]
        self.assertAlmostEqual(whole.trap_days, 6)

    def test_catches_outside_the_window_are_left_out(self):
        self.reading(self.trap, date(2025, 4, 10), 40)  # exposed 1 March - 10 April
        totals = self.stat('traps-catches', {**self.MARCH, 'compare': 'false'}).data['totals']
        # 31 of the 40 days fall in March
        self.assertAlmostEqual(totals['hornets'], 31, places=1)
        self.assertEqual(totals['readings'], 0)


class TrapCatchesTests(StatsTestCase):
    def test_comparison_with_the_previous_year(self):
        self.reading(self.trap, date(2025, 3, 15), 14)
        self.install(self.trap, date(2024, 3, 1))
        self.reading(self.trap, date(2024, 3, 15), 28)
        # The 2024 journal ended with a removal, as a trap put away for the winter would
        self.install(self.trap, date(2024, 3, 16), TrapEvent.KIND_REMOVAL)
        response = self.stat('traps-catches', {'period': 'custom', 'from': '2025-03-01',
                                                'to': '2025-03-14', 'granularity': 'week'})
        totals = response.data['totals']
        self.assertAlmostEqual(totals['rate'], 7, places=2)
        self.assertAlmostEqual(totals['previous_rate'], 14, places=2)
        self.assertEqual(response.data['columns'][-1]['key'], 'previous_rate')
        s10 = next(row for row in response.data['rows'] if row['bucket'] == 'S10')
        self.assertAlmostEqual(s10['previous_rate'], 14, places=2)

    def test_warns_while_readings_at_zero_did_not_exist(self):
        self.reading(self.trap, date(2025, 3, 15), 14)
        warnings = self.stat('traps-catches', self.MARCH).data['warnings']
        self.assertTrue(any('sans capture' in w for w in warnings))
        # Once a reading answers the bycatch question, later periods are complete
        self.reading(self.trap, date(2025, 2, 20), 0, bycatch=True)
        warnings = self.stat('traps-catches', self.MARCH).data['warnings']
        self.assertFalse(any('sans capture' in w for w in warnings))

    def test_warns_when_buckets_are_finer_than_the_readings(self):
        self.reading(self.trap, date(2025, 3, 15), 14)
        warnings = self.stat('traps-catches', {**self.MARCH, 'granularity': 'day'}).data['warnings']
        self.assertTrue(any('tous les 14 jours' in w for w in warnings))

    def test_invalid_parameters(self):
        for query in ({'period': 'nope'}, {**self.MARCH, 'granularity': 'hour'},
                      {**self.MARCH, 'trap_type': 'nope'}, {**self.MARCH, 'lat': '50'},
                      {**self.MARCH, 'lat': '50', 'lon': '4', 'radius': '500'}):
            response = self.stat('traps-catches', query)
            self.assertEqual(response.status_code, 400, query)
            self.assertIn('error', response.data)
        self.assertEqual(self.stat('nope', self.MARCH).status_code, 404)


class TrapTypesTests(StatsTestCase):
    def test_rate_and_selectivity_per_type(self):
        other_type = TrapType.objects.get(slug='bottle')
        bottle = self.make_trap(trap_type=other_type)
        self.reading(self.trap, date(2025, 3, 15), 14, others=6, bycatch=True)
        self.reading(bottle, date(2025, 3, 15), 7, others=33, bycatch=True)
        # Not counted for the selectivity: the other species were left out
        self.reading(bottle, date(2025, 3, 29), 7, others=0, bycatch=False)
        response = self.stat('trap-types', self.MARCH)
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data['rows']
        self.assertEqual([row['slug'] for row in rows], ['homemade', 'bottle'])
        homemade, bottle_row = rows
        self.assertAlmostEqual(homemade['rate'], 7, places=2)
        self.assertEqual(homemade['counted_insects'], 20)
        self.assertAlmostEqual(homemade['selectivity'], 0.7)
        self.assertAlmostEqual(bottle_row['rate'], 14 / 28 * 7, places=2)
        self.assertEqual(bottle_row['counted_insects'], 40)
        self.assertAlmostEqual(bottle_row['selectivity'], 7 / 40)
        self.assertLess(bottle_row['selectivity_low'], 7 / 40)
        self.assertEqual(response.data['totals']['traps'], 2)

    def test_selectivity_needs_twenty_insects(self):
        self.reading(self.trap, date(2025, 3, 15), 5, others=5, bycatch=True)
        row = self.stat('trap-types', self.MARCH).data['rows'][0]
        self.assertEqual(row['counted_insects'], 10)
        self.assertIsNone(row['selectivity'])


class ThreeTrapsTestCase(StatsTestCase):
    """A public trap, a group-only one and an apiary-bound (harp) one."""

    def setUp(self):
        super().setUp()
        self.reading(self.trap, date(2025, 3, 15), 14)  # public trap
        self.private = self.make_trap(visibility=Trap.VISIBILITY_GROUP, group=self.group)
        self.reading(self.private, date(2025, 3, 15), 28)
        harp = TrapType.objects.get(slug='electric-harp')
        self.assertTrue(harp.apiary_bound)
        self.harp = self.make_trap(trap_type=harp)
        self.reading(self.harp, date(2025, 3, 15), 56)
        self.zone = {**self.MARCH, 'lat': '50.5', 'lon': '4.5', 'radius': '2'}


class AccessTests(ThreeTrapsTestCase):
    """Totals count every trap; anything located counts only visible ones."""

    def hornets(self, query, user):
        response = self.stat('traps-catches', {**query, 'compare': 'false'}, user=user)
        self.assertEqual(response.status_code, 200, response.data)
        return round(response.data['totals']['hornets']), response.data['scope']

    def test_totals_without_zone_count_every_trap(self):
        total, scope = self.hornets(self.MARCH, self.stranger_user)
        self.assertEqual(total, 14 + 28 + 56)
        self.assertEqual((scope['kind'], scope['traps']), ('all', 3))

    def test_a_zone_counts_only_the_traps_one_can_see(self):
        total, scope = self.hornets(self.zone, self.stranger_user)
        self.assertEqual(total, 14)
        self.assertEqual((scope['kind'], scope['traps']), ('visible', 1))
        # The owner sees their harp; a member of the group sees the group's trap
        self.assertEqual(self.hornets(self.zone, self.owner_user)[0], 14 + 28 + 56)
        self.assertEqual(self.hornets(self.zone, self.member_user)[0], 14 + 28)
        self.assertEqual(self.hornets(self.zone, self.admin_user)[0], 14 + 28 + 56)

    def test_a_zone_leaves_out_traps_outside_it(self):
        far = self.make_trap(latitude=51.2, longitude=4.4)
        self.reading(far, date(2025, 3, 15), 1000)
        self.assertEqual(self.hornets(self.zone, self.admin_user)[0], 14 + 28 + 56)

    def test_group_filter_is_limited_to_ones_groups(self):
        query = {**self.MARCH, 'group': self.group_path}
        self.assertEqual(self.stat('traps-catches', query, self.stranger_user).status_code, 403)
        self.assertEqual(self.hornets(query, self.group_admin_user)[0], 28)
        self.assertEqual(self.hornets(query, self.admin_user)[0], 28)

    def test_mine(self):
        self.assertEqual(self.hornets({**self.MARCH, 'mine': 'true'}, self.owner_user)[0],
                         14 + 28 + 56)
        self.assertEqual(self.hornets({**self.MARCH, 'mine': 'true'}, self.member_user)[0], 0)


class CatalogueTests(TrapTestCase):
    def catalogue(self, user=None):
        request = self.factory.get('/stats/')
        if user:
            force_authenticate(request, user=user)
        return StatsCatalogueView.as_view()(request)

    def test_every_role_gets_the_catalogue(self):
        for user in (self.owner_user, self.member_user, self.admin_user):
            ids = [entry['id'] for entry in self.catalogue(user).data]
            self.assertEqual(ids, ['traps-catches', 'traps-species', 'trap-types', 'traps-ranking',
                                   'traps-coverage', 'traps-pressure'])

    def test_anonymous_and_roleless_users_are_refused(self):
        self.assertIn(self.catalogue().status_code, (401, 403))
        self.assertEqual(self.catalogue(FakeTrapUser([], None)).status_code, 403)


class ExportTests(ThreeTrapsTestCase):
    """Files behind a signed link, computed with the rights of the requester."""

    def link(self, fmt, params, user=None):
        request = self.factory.post('/stats/traps-catches/export/',
                                    {'format': fmt, 'params': params}, format='json')
        force_authenticate(request, user=user or self.admin_user)
        return StatExportLinkView.as_view()(request, stat_id='traps-catches')

    def download(self, url):
        return self.client.get(url)

    def test_csv(self):
        response = self.link('csv', {**self.MARCH, 'granularity': 'week', 'compare': 'false'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['filename'],
                         'captures-de-frelons-asiatiques-1-31-mars-2025.csv')
        file = self.download(response.data['url'])
        self.assertEqual(file.status_code, 200)
        self.assertIn('attachment;', file['Content-Disposition'])
        text = file.content.decode('utf-8')
        self.assertTrue(text.startswith('﻿Période;Du;Au;'))
        lines = text.strip().split('\r\n')
        self.assertTrue(lines[-1].startswith('Total;2025-03-01;2025-03-31;'))
        # 98 hornets in March with the three traps of the fixture, decimal comma
        self.assertIn(';98,0;', lines[-1])

    def test_xlsx_has_data_and_parameters(self):
        from openpyxl import load_workbook
        response = self.link('xlsx', {**self.MARCH, 'granularity': 'week'})
        file = self.download(response.data['url'])
        self.assertEqual(file.status_code, 200)
        workbook = load_workbook(io.BytesIO(file.content))
        self.assertEqual(workbook.sheetnames, ['Données', 'Paramètres'])
        data = workbook['Données']
        self.assertEqual(data.cell(1, 1).value, 'Période')
        self.assertEqual(data.cell(data.max_row, 1).value, 'Total')
        self.assertEqual(data.cell(2, 2).value.date(), date(2025, 3, 1))
        labels = [row[0].value for row in workbook['Paramètres'].iter_rows()]
        self.assertIn('Pièges comptés', labels)
        self.assertIn('Comparée à', labels)

    def test_the_file_keeps_the_rights_of_the_requester(self):
        zone = {**self.zone, 'compare': 'false'}
        url = self.link('csv', zone, user=self.stranger_user).data['url']
        total = self.download(url).content.decode('utf-8').strip().split('\r\n')[-1]
        self.assertIn(';14,0;', total)

    def test_refusals(self):
        self.assertEqual(self.link('pdf', self.MARCH).status_code, 400)
        self.assertEqual(self.link('csv', {'period': 'nope'}).status_code, 400)
        self.assertEqual(self.download('/api/stats/export/forged:token/').status_code, 404)
        url = self.link('csv', self.MARCH).data['url']
        with patch('hornet.stats.views.EXPORT_LINK_SECONDS', -1):
            self.assertEqual(self.download(url).status_code, 410)


class CoverageTests(StatsTestCase):
    """A 2 km zone around the fixture trap (50.5, 4.5)."""

    zone = {'period': 'custom', 'from': '2025-03-01', 'to': '2025-03-31',
            'lat': '50.5', 'lon': '4.5', 'radius': '2'}

    def map(self, stat_id, query, user=None):
        response = self.stat(stat_id, query, user=user)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_one_trap_covers_a_disc(self):
        data = self.map('traps-coverage', self.zone)
        summary = data['summary']
        # pi * 0.25^2 of pi * 2^2: (0.25 / 2)^2, the buffer polygon within 0.2 %
        self.assertAlmostEqual(summary['coverage'], (0.25 / 2) ** 2, delta=0.0002)
        self.assertAlmostEqual(summary['covered_km2'], math.pi * 0.25 ** 2, delta=0.001)
        self.assertEqual(summary['traps'], 1)
        self.assertEqual(data['kind'], 'map')
        self.assertEqual(data['scope']['kind'], 'visible')
        features = data['cells']['features']
        # A 500 m disc spans at most 3 x 3 cells of 250 m, and at least 2 x 2
        self.assertTrue(4 <= len(features) <= 9, len(features))
        self.assertTrue(all(0 < f['properties']['covered'] <= 1 for f in features))
        self.assertEqual(data['traps'], [[50.5, 4.5]])

    def test_the_reach_is_a_parameter(self):
        wide = self.map('traps-coverage', {**self.zone, 'reach': '500'})['summary']
        self.assertAlmostEqual(wide['coverage'], (0.5 / 2) ** 2, delta=0.0005)
        self.assertEqual(self.stat('traps-coverage', {**self.zone, 'reach': '300'}).status_code, 400)

    def test_a_trap_outside_the_zone_covers_its_edge(self):
        # 2.1 km north of the centre: 150 m of its disc reach into the zone
        self.make_trap(latitude=50.5 + 2.1 / 111.2, longitude=4.5)
        summary = self.map('traps-coverage', self.zone)['summary']
        self.assertEqual(summary['traps'], 1)
        self.assertGreater(summary['covered_km2'], math.pi * 0.25 ** 2 + 0.01)

    def test_a_trap_out_of_service_covers_nothing(self):
        removed = self.make_trap(latitude=50.51, longitude=4.51)
        self.install(removed, date(2025, 2, 20), TrapEvent.KIND_REMOVAL)
        self.install(removed, date(2025, 4, 10))
        # Its installation of 1 March is before the removal: out of service all March
        removed.events.filter(performed_at=at(date(2025, 3, 1))).delete()
        self.assertEqual(self.map('traps-coverage', self.zone)['summary']['traps'], 1)

    def test_only_visible_traps_count(self):
        self.make_trap(latitude=50.51, longitude=4.51, visibility=Trap.VISIBILITY_GROUP,
                       group=self.group)
        self.assertEqual(self.map('traps-coverage', self.zone, self.stranger_user)['summary']['traps'], 1)
        self.assertEqual(self.map('traps-coverage', self.zone, self.member_user)['summary']['traps'], 2)

    def test_area_limits(self):
        march = {'period': 'custom', 'from': '2025-03-01', 'to': '2025-03-31'}
        self.assertEqual(self.stat('traps-coverage', march).status_code, 400)
        huge = self.stat('traps-coverage', {**march, 'bbox': '3,50,6,51'})
        self.assertEqual(huge.status_code, 422)
        self.assertIn('zoomez', huge.data['error'])
        bbox = self.map('traps-coverage', {**march, 'bbox': '4.49,50.49,4.51,50.51'})
        self.assertEqual(bbox['area']['kind'], 'bbox')
        self.assertEqual(self.stat('traps-coverage', {**march, 'bbox': '4.5,50.5'}).status_code, 400)


class PressureTests(StatsTestCase):
    zone = CoverageTests.zone

    def test_pressure_near_a_trap_is_its_rate(self):
        self.reading(self.trap, date(2025, 3, 15), 14)  # 7 a week over 14 days
        data = self.stat('traps-pressure', self.zone).data
        self.assertEqual(data['summary']['traps'], 1)
        self.assertAlmostEqual(data['summary']['rate'], 7, places=2)
        rates = [f['properties']['rate'] for f in data['cells']['features']]
        # A single trap: every cell with enough effort shows its rate
        self.assertTrue(rates)
        self.assertTrue(all(abs(rate - 7) < 1e-6 for rate in rates))
        # The effort fades with distance: far cells stay transparent
        efforts = [f['properties']['effort'] for f in data['cells']['features']]
        self.assertGreaterEqual(min(efforts), 7)
        self.assertLessEqual(max(efforts), 14.01)

    def test_no_effort_no_colour(self):
        data = self.stat('traps-pressure', self.zone).data
        self.assertEqual(data['cells']['features'], [])

    def test_export_of_a_map(self):
        self.reading(self.trap, date(2025, 3, 15), 14)
        request = self.factory.post('/stats/traps-coverage/export/',
                                    {'format': 'csv', 'params': self.zone}, format='json')
        force_authenticate(request, user=self.admin_user)
        link = StatExportLinkView.as_view()(request, stat_id='traps-coverage')
        self.assertEqual(link.status_code, 200, link.data)
        text = self.client.get(link.data['url']).content.decode('utf-8')
        self.assertTrue(text.startswith('﻿Latitude (centre);'))


class SpeciesTests(StatsTestCase):
    def test_catches_and_shares_per_species(self):
        self.reading(self.trap, date(2025, 3, 8), 7, others=14, bycatch=True)
        # Not complete: counted in the catches, not in the shares
        self.reading(self.trap, date(2025, 3, 15), 5, others=0, bycatch=False)
        data = self.stat('traps-species', {**self.MARCH, 'granularity': 'week'}).data
        rows = {row['slug']: row for row in data['rows']}
        self.assertEqual(data['rows'][0]['slug'], 'vespa-velutina')
        self.assertAlmostEqual(rows['vespa-velutina']['catches'], 12)
        self.assertAlmostEqual(rows['vespa-velutina']['counted'], 7)
        self.assertAlmostEqual(rows['vespa-velutina']['share'], 7 / 21, places=4)
        self.assertAlmostEqual(rows['apis-mellifera']['share'], 14 / 21, places=4)
        self.assertLess(rows['apis-mellifera']['share_low'], 14 / 21)
        self.assertEqual(data['totals']['readings'], 2)
        self.assertEqual(data['totals']['complete_readings'], 1)
        self.assertEqual([s['slug'] for s in data['series']['species']],
                         ['apis-mellifera', 'vespa-velutina'])
        # 1-7 March carries the whole complete reading: shares of that week
        s10 = next(b for b in data['series']['buckets'] if b['bucket'] == 'S10')
        self.assertAlmostEqual(s10['shares']['vespa-velutina'], 7 / 21, places=3)

    def test_warns_when_few_readings_are_complete(self):
        self.reading(self.trap, date(2025, 3, 8), 7, bycatch=False)
        self.reading(self.trap, date(2025, 3, 15), 7, bycatch=False)
        data = self.stat('traps-species', self.MARCH).data
        self.assertTrue(any('toutes les espèces' in w for w in data['warnings']))
        self.assertIsNone(data['rows'][0]['share'])


class RankingTests(ThreeTrapsTestCase):
    def test_ranks_visible_traps_by_rate(self):
        busy = self.make_trap(latitude=50.51, longitude=4.51, address='Rue du Rucher 3')
        self.reading(busy, date(2025, 3, 15), 140)
        rows = self.stat('traps-ranking', self.MARCH, user=self.stranger_user).data['rows']
        # The stranger sees the public traps only: not the group's, not the harp
        self.assertEqual([row['id'] for row in rows], [busy.id, self.trap.id])
        self.assertEqual(rows[0]['address'], 'Rue du Rucher 3')
        self.assertAlmostEqual(rows[0]['rate'], 70, places=1)
        owner_rows = self.stat('traps-ranking', self.MARCH, user=self.owner_user).data['rows']
        self.assertEqual(len(owner_rows), 4)

    def test_order_by_catches_and_too_little_effort(self):
        short = self.make_trap(latitude=50.51, longitude=4.51)
        self.install(short, date(2025, 3, 12))
        short.events.filter(performed_at=at(date(2025, 3, 1))).delete()
        self.reading(short, date(2025, 3, 14), 30)  # two days: no rate
        rows = self.stat('traps-ranking', {**self.MARCH, 'order': 'hornets'}).data['rows']
        self.assertEqual(rows[0]['id'], self.harp.id)
        by_rate = self.stat('traps-ranking', self.MARCH).data['rows']
        self.assertEqual(by_rate[-1]['id'], short.id)
        self.assertIsNone(by_rate[-1]['rate'])
        self.assertEqual(self.stat('traps-ranking', {**self.MARCH, 'order': 'x'}).status_code, 400)
