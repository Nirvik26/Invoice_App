import json
import logging
import time
import uuid
from django.http import JsonResponse
from django.core.exceptions import RequestDataTooBig

logger = logging.getLogger('billora.requests')


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.monotonic()
        try:
            request.request_id = str(uuid.UUID(request.headers.get('X-Request-ID', '')))
        except ValueError:
            request.request_id = str(uuid.uuid4())
        try:
            response = self.get_response(request)
        except RequestDataTooBig:
            response = JsonResponse({'error': 'Request too large.'}, status=413)
        response['X-Request-ID'] = request.request_id
        response['Cache-Control'] = 'no-store'
        match = request.resolver_match
        # Route patterns, never bearer links, query strings, headers, or bodies.
        logger.info(json.dumps({'request_id': request.request_id, 'method': request.method, 'route': match.route if match else 'unmatched', 'status': response.status_code, 'duration_ms': round((time.monotonic()-started)*1000)}))
        return response


def server_error(request):
    return JsonResponse({'error': 'An unexpected error occurred.', 'request_id': getattr(request, 'request_id', '')}, status=500)
