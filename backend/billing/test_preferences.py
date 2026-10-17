import base64
import io
import json
import time
import uuid
import jwt
from PIL import Image
from django.test import TestCase, override_settings
from .models import Widget, Space
from .preferences import clean_image
from config.database import postgres_database


@override_settings(SESSION_SECRET='settings-test-secret-at-least-32-characters')
class PreferencesTests(TestCase):
    def setUp(self):
        self.owner = uuid.uuid4()
        self.authenticate(self.owner)

    def authenticate(self, owner):
        token = jwt.encode({'userId': str(owner), 'exp': time.time() + 3600}, 'settings-test-secret-at-least-32-characters', algorithm='HS256')
        self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + token

    def post(self, **data):
        return self.client.post('/api/settings/', json.dumps(data), content_type='application/json')

    def image(self):
        output = io.BytesIO()
        Image.new('RGBA', (20, 20), (0, 0, 0, 0)).save(output, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()

    def create(self, **kwargs):
        payload = {'action': 'save', 'kind': 'note', 'title': 'Notice', 'content': 'Welcome', 'enabled': True, 'public': False}
        payload.update(kwargs)
        return self.post(**payload)

    def test_image_round_trip_and_validation(self):
        self.assertEqual(self.create(kind='qr', image_data=self.image()).status_code, 200)
        widget = self.client.get('/api/settings/').json()['widgets'][0]
        self.assertTrue(widget['image_data'].startswith('/api/hospitality/widget-image/'))
        response = self.client.get(f'/api/widget-image/{widget["id"]}/')
        self.assertEqual(response.status_code, 200)
        image = Image.open(io.BytesIO(response.content))
        self.assertEqual(image.getpixel((0, 0)), (255, 255, 255))
        for invalid in ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,bm90IGFuIGltYWdl', 'data:image/png;base64,!!!!', 'x' * 3_000_000]:
            with self.assertRaises(ValueError):
                clean_image(invalid)
        self.assertEqual(self.create(kind='qr').status_code, 400)
        self.client.defaults.clear()
        self.assertEqual(self.client.get(f'/api/widget-image/{widget["id"]}/').status_code, 401)

    def test_private_public_and_hidden_widgets(self):
        space = Space.objects.create(owner=self.owner, name='Test table', kind='restaurant')
        self.create(title='Private instructions')
        self.create(title='Public QR', kind='qr', image_data=self.image(), public=True)
        self.create(title='Hidden notice', enabled=False, public=True)
        self.post(action='profile', business_name='Test cafe', receipt_note='Thank you')
        self.client.defaults.clear()
        self.assertEqual(self.client.get('/api/settings/').status_code, 401)
        self.assertEqual(self.create().status_code, 401)
        preferences = self.client.get(f'/api/guest/{space.token}/').json()['preferences']
        self.assertEqual(preferences['business_name'], 'Test cafe')
        self.assertEqual([w['title'] for w in preferences['widgets']], ['Public QR'])
        self.assertNotIn('database', preferences)

    def test_owner_scope_for_all_mutations(self):
        self.create()
        identifier = str(Widget.objects.get().id)
        self.authenticate(uuid.uuid4())
        self.assertEqual(self.client.get('/api/settings/').json()['widgets'], [])
        self.assertEqual(self.create(id=identifier, title='Changed').status_code, 400)
        self.assertEqual(self.post(action='move', id=identifier, direction='up').status_code, 400)
        self.assertEqual(self.post(action='delete', id=identifier).status_code, 400)
        self.assertEqual(Widget.objects.get().title, 'Notice')

    def test_order_edit_delete_and_limit(self):
        self.create(title='First')
        self.create(title='Second')
        second = Widget.objects.get(title='Second')
        self.post(action='move', id=str(second.id), direction='up')
        self.assertEqual(list(Widget.objects.values_list('title', flat=True)), ['Second', 'First'])
        self.assertEqual(self.create(id=str(second.id), title='Edited').status_code, 200)
        self.assertEqual(self.post(action='delete', id=str(second.id)).status_code, 200)
        for i in range(11):
            self.assertEqual(self.create(title=f'Widget {i}').status_code, 200)
        self.assertEqual(self.create(title='Too many').status_code, 400)

    def test_safe_links_and_payload_validation(self):
        for url in ['javascript:alert(1)', 'data:text/html,abc', 'https://user:password@example.com', '/relative']:
            self.assertEqual(self.create(kind='link', url=url).status_code, 400)
        self.assertEqual(self.create(kind='link', url='https://example.com/menu').status_code, 200)
        self.assertEqual(self.create(public='true').status_code, 400)
        self.assertEqual(self.post(action='profile', business_name='X' * 101).status_code, 400)
        self.assertNotIn('PASSWORD', self.client.get('/api/settings/').content.decode())

    def test_neon_database_configuration(self):
        database = postgres_database('postgresql://owner:example@demo-pooler.neon.tech/neondb?channel_binding=require')
        self.assertEqual(database['OPTIONS']['sslmode'], 'require')
        self.assertEqual(database['OPTIONS']['channel_binding'], 'require')
        self.assertTrue(database['DISABLE_SERVER_SIDE_CURSORS'])
        self.assertEqual(database['CONN_MAX_AGE'], 0)
        verified = postgres_database('postgresql://owner:example@demo.neon.tech/neondb?sslmode=verify-full')
        self.assertEqual(verified['OPTIONS']['sslmode'], 'verify-full')
        with self.assertRaises(ValueError):
            postgres_database('sqlite:///example.db')
