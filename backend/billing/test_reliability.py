import json
import time
import uuid
from unittest.mock import patch
import jwt
from django.core.cache import cache
from django.test import TestCase, override_settings
from .models import Space, Bill, BillLine, AuditEvent


@override_settings(SESSION_SECRET='test-session-secret-with-32-characters', API_SIGNING_SECRET='', PRODUCTION=False)
class ReliabilityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = uuid.uuid4()
        self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + jwt.encode({'userId': str(self.owner), 'exp': time.time()+3600}, 'test-session-secret-with-32-characters', algorithm='HS256')

    def post(self, data, key):
        return self.client.post('/api/command/', json.dumps(data), content_type='application/json', HTTP_IDEMPOTENCY_KEY=str(key))

    def test_replay_and_conflicting_intent(self):
        key = uuid.uuid4()
        data = {'action': 'space', 'kind': 'restaurant', 'name': 'Table 1'}
        self.assertEqual(self.post(data, key).status_code, 200)
        replay = self.post(data, key)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay['Idempotency-Replayed'], 'true')
        self.assertEqual(Space.objects.count(), 1)
        self.assertEqual(AuditEvent.objects.count(), 1)
        self.assertEqual(self.post({**data, 'name': 'Changed'}, key).status_code, 409)

    def test_failed_mutation_can_be_corrected(self):
        key = uuid.uuid4()
        self.assertEqual(self.post({'action': 'space', 'name': ''}, key).status_code, 400)
        self.assertEqual(AuditEvent.objects.count(), 0)
        self.assertEqual(self.post({'action': 'space', 'kind': 'hotel', 'name': 'Room'}, key).status_code, 200)

    @override_settings(WRITE_RATE_LIMIT=1)
    def test_shared_limit_and_retry_after(self):
        self.post({'action': 'staff', 'name': 'Asha'}, uuid.uuid4())
        response = self.post({'action': 'staff', 'name': 'Sam'}, uuid.uuid4())
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response['Retry-After'], '60')

    def test_history_pagination_and_lifetime_stats(self):
        space = Space.objects.create(owner=self.owner, name='Room', kind='hotel')
        for _ in range(61):
            bill = Bill.objects.create(owner=self.owner, space=space, status='paid', subtotal_cents=100, total_cents=100)
            BillLine.objects.create(bill=bill, description='Night', rate_cents=100, quantity=1)
        first = self.client.get('/api/workspace/').json()
        self.assertEqual(len(first['bills']), 50)
        self.assertEqual(first['stats']['collected'], 6100)
        second = self.client.get('/api/workspace/', {'before': first['next_cursor']}).json()
        self.assertEqual(len(second['bills']), 11)
        self.assertIsNone(second['next_cursor'])
        self.assertFalse({b['id'] for b in first['bills']} & {b['id'] for b in second['bills']})

    @override_settings(API_SIGNING_SECRET='separate-service-secret-with-32-characters')
    def test_service_tokens_require_audience_and_short_lifetime(self):
        self.assertEqual(self.client.get('/api/workspace/').status_code, 401)
        def token(audience, seconds):
            return jwt.encode({'userId': str(self.owner), 'iat': int(time.time()), 'exp': int(time.time())+seconds, 'iss': 'billora-web', 'aud': audience}, 'separate-service-secret-with-32-characters', algorithm='HS256')
        for audience, seconds in [('wrong', 60), ('billora-api', 1000)]:
            self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + token(audience, seconds)
            self.assertEqual(self.client.get('/api/workspace/').status_code, 401)
        self.client.defaults['HTTP_AUTHORIZATION'] = 'Bearer ' + token('billora-api', 60)
        self.assertEqual(self.client.get('/api/workspace/').status_code, 200)

    def test_health_and_request_id(self):
        response = self.client.get('/health/ready/')
        self.assertEqual(response.status_code, 200)
        uuid.UUID(response['X-Request-ID'])
        with patch('config.health.cache.get', return_value=None):
            self.assertEqual(self.client.get('/health/ready/').status_code, 503)

    def test_authentication_attempts_are_limited(self):
        for _ in range(10):
            self.assertEqual(self.client.post('/api/auth-limit/').status_code, 200)
        self.assertEqual(self.client.post('/api/auth-limit/').status_code, 429)
