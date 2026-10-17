import json
import time
import uuid
import jwt
from django.test import TestCase, override_settings
from .models import Space, Staff, MenuItem, Bill


@override_settings(SESSION_SECRET='test-secret-with-at-least-thirty-two-characters')
class BillingTests(TestCase):
    def setUp(self):
        self.owner = uuid.uuid4()
        self.other = uuid.uuid4()
        self.login(self.owner)
        self.table = Space.objects.create(owner=self.owner, name='Table 1', kind='restaurant')
        self.staff = Staff.objects.create(owner=self.owner, name='Asha', role='Server')
        self.menu = MenuItem.objects.create(owner=self.owner, name='Tea', price_cents=275)

    def login(self, owner):
        self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + jwt.encode({'userId': str(owner), 'exp': time.time() + 3600}, 'test-secret-with-at-least-thirty-two-characters', algorithm='HS256')

    def command(self, action, **data):
        return self.client.post('/api/command/', json.dumps({'action': action, **data}), content_type='application/json')

    def open(self, space=None, **kwargs):
        response = self.command('open', space_id=str((space or self.table).id), **kwargs)
        self.assertEqual(response.status_code, 200, response.content)
        return Bill.objects.get(space=space or self.table)

    def test_restaurant_cash_receipt_and_immutability(self):
        bill = self.open(staff_id=str(self.staff.id), tax_percent=13)
        self.assertEqual(self.command('settle', bill_id=str(bill.id), payment_method='cash').status_code, 400)
        self.assertEqual(self.command('add', bill_id=str(bill.id), menu_id=str(self.menu.id), quantity=3).status_code, 200)
        result = self.client.get('/api/workspace/').json()['bills'][0]
        self.assertEqual(result['subtotal_cents'], 825)
        self.assertEqual(result['tax_cents'], 107)
        self.assertEqual(result['total_cents'], 932)
        self.assertEqual(self.command('settle', bill_id=str(bill.id), payment_method='card').status_code, 400)
        self.assertEqual(self.command('settle', bill_id=str(bill.id), payment_method='cash').status_code, 200)
        for action in ['add', 'remove', 'settle']:
            self.assertEqual(self.command(action, bill_id=str(bill.id)).status_code, 400)
        bill.refresh_from_db()
        self.assertEqual(bill.status, 'paid')
        self.assertIsNotNone(bill.paid_at)
        self.assertEqual(self.command('open', space_id=str(self.table.id)).status_code, 200)

    def test_lodging_dates_and_snapshot(self):
        for kind in ['hotel', 'homestay']:
            room = Space.objects.create(owner=self.owner, name=kind, kind=kind, rate_cents=12550)
            self.assertEqual(self.command('open', space_id=str(room.id), check_in='2026-10-15', check_out='2026-10-14').status_code, 400)
            bill = self.open(room, check_in='2026-10-15', check_out='2026-10-18', guest='Guest')
            line = bill.lines.get()
            self.assertEqual(line.quantity * line.rate_cents, 37650)
            room.rate_cents = 99999
            room.save()
            line.refresh_from_db()
            self.assertEqual(line.rate_cents, 12550)
            self.assertEqual(self.command('remove', bill_id=str(bill.id), line_id=line.id).status_code, 400)

    def test_tenant_isolation(self):
        bill = self.open()
        self.login(self.other)
        self.assertEqual(self.client.get('/api/workspace/').json(), {'spaces': [], 'staff': [], 'menu': [], 'bills': [], 'next_cursor': None, 'stats': {'outstanding': 0, 'collected': 0}})
        self.assertEqual(self.command('open', space_id=str(self.table.id)).status_code, 400)
        self.assertEqual(self.command('add', bill_id=str(bill.id), menu_id=str(self.menu.id), quantity=1).status_code, 400)
        self.assertEqual(self.command('staff_toggle', id=str(self.staff.id)).status_code, 400)
        foreign = Space.objects.create(owner=self.other, name='Foreign', kind='restaurant')
        self.assertEqual(self.command('open', space_id=str(foreign.id), staff_id=str(self.staff.id)).status_code, 400)

    def test_duplicate_open_invalid_quantities_and_auth(self):
        bill = self.open()
        self.assertEqual(self.command('open', space_id=str(self.table.id)).status_code, 409)
        for quantity in [0, -1, 101, 1.5, True, '1']:
            self.assertEqual(self.command('add', bill_id=str(bill.id), menu_id=str(self.menu.id), quantity=quantity).status_code, 400)
        self.client.defaults.clear()
        self.assertEqual(self.client.get('/api/workspace/').status_code, 401)
        self.assertEqual(self.command('space', name='Unauthorized', kind='hotel').status_code, 401)
        self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + jwt.encode({'userId': str(self.owner), 'exp': 1}, 'test-secret-with-at-least-thirty-two-characters', algorithm='HS256')
        self.assertEqual(self.client.get('/api/workspace/').status_code, 401)

    def test_public_qr_excludes_private_data(self):
        self.open(guest='Private guest name', staff_id=str(self.staff.id))
        self.client.defaults.clear()
        response = self.client.get(f'/api/guest/{self.table.token}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['menu'][0]['price_cents'], 275)
        self.assertNotIn('Private guest name', response.content.decode())
        self.assertNotIn('Asha', response.content.decode())
        self.assertNotIn(str(self.owner), response.content.decode())
        svg = self.client.get(f'/api/qr/{self.table.token}/')
        self.assertEqual(svg.status_code, 200)
        self.assertIn(b'<svg', svg.content)
        self.assertEqual(self.client.post(f'/api/guest/{self.table.token}/').status_code, 405)
        self.assertEqual(self.client.get(f'/api/guest/{uuid.uuid4()}/').status_code, 404)
