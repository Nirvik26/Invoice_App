import hashlib
import json
import time
import uuid
from functools import wraps
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from .models import BusinessSettings, Mutation, AuditEvent


def rate_limit(identity, limit, scope='write'):
    key = f'limit:{scope}:{identity}:{int(time.time()) // 60}'
    try:
        if cache.add(key, 1, timeout=70):
            count = 1
        else:
            count = cache.incr(key)
        if count > limit:
            return JsonResponse({'error': 'Too many requests. Please try again shortly.'}, status=429, headers={'Retry-After': '60'})
    except Exception:
        if settings.PRODUCTION:
            return JsonResponse({'error': 'Service temporarily unavailable.'}, status=503)
    return None


def reliable_mutation(fn):
    """Commit the mutation, audit record, and replay result in one transaction."""
    @wraps(fn)
    def wrapped(request, *args, **kwargs):
        if request.method != 'POST':
            return fn(request, *args, **kwargs)
        limited = rate_limit(str(request.owner), settings.WRITE_RATE_LIMIT)
        if limited is not None:
            return limited
        raw_key = request.headers.get('Idempotency-Key')
        if not raw_key:
            if settings.PRODUCTION:
                return JsonResponse({'error': 'Idempotency-Key is required.'}, status=400)
            raw_key = str(uuid.uuid4())
        try:
            key = uuid.UUID(raw_key)
            body = json.loads(request.body)
            if not isinstance(body, dict):
                raise ValueError()
        except (ValueError, TypeError):
            return JsonResponse({'error': 'Invalid request or idempotency key.'}, status=400)
        fingerprint = hashlib.sha256((request.path + json.dumps(body, sort_keys=True, separators=(',', ':'))).encode()).hexdigest()
        with transaction.atomic():
            profile, _ = BusinessSettings.objects.get_or_create(owner=request.owner)
            BusinessSettings.objects.select_for_update().get(pk=profile.pk)
            previous = Mutation.objects.filter(owner=request.owner, key=key).first()
            if previous:
                if previous.fingerprint != fingerprint:
                    return JsonResponse({'error': 'This request key was already used for different data.'}, status=409)
                return JsonResponse(previous.response, status=previous.status_code, headers={'Idempotency-Replayed': 'true'})
            response = fn(request, *args, **kwargs)
            if 200 <= response.status_code < 300:
                Mutation.objects.create(owner=request.owner, key=key, fingerprint=fingerprint, response=json.loads(response.content), status_code=response.status_code)
                AuditEvent.objects.create(owner=request.owner, action=f'{request.resolver_match.url_name or "settings"}:{str(body.get("action", ""))[:50]}', resource_id=str(body.get('bill_id') or body.get('id') or body.get('space_id') or '')[:100], request_id=getattr(request, 'request_id', str(uuid.uuid4())))
            return response
    return wrapped
