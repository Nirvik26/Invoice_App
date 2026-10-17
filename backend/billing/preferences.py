import base64
import io
import json
import warnings
from urllib.parse import urlparse
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.db import transaction
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import BusinessSettings, Widget
from .views import authenticated, owned, text
from .reliability import reliable_mutation

MAX_IMAGE_BYTES = 2 * 1024 * 1024


def clean_image(value):
    if not isinstance(value, str) or len(value) > MAX_IMAGE_BYTES * 4 // 3 + 100:
        raise ValueError('Choose a PNG, JPEG, or WebP image up to 2 MB.')
    try:
        header, encoded = value.split(',', 1)
        if header not in ['data:image/png;base64', 'data:image/jpeg;base64', 'data:image/webp;base64']:
            raise ValueError()
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError()
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in ['PNG', 'JPEG', 'WEBP'] or source.width * source.height > 4_000_000:
                    raise ValueError()
                source.load()
                output = io.BytesIO()
                # Strip metadata without resizing or blurring QR modules.
                rgba = source.convert('RGBA')
                background = Image.new('RGBA', rgba.size, 'white')
                background.alpha_composite(rgba)
                background.convert('RGB').save(output, format='PNG')
        if output.tell() > MAX_IMAGE_BYTES:
            raise ValueError()
        return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode('ascii')
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError('Use a valid PNG, JPEG, or WebP image up to 2 MB and 4 megapixels.')


def widget_data(widget):
    data = {key: getattr(widget, key) for key in ['id', 'title', 'kind', 'content', 'url', 'enabled', 'public', 'position']}
    data['image_data'] = f'/api/hospitality/widget-image/{widget.id}' if widget.kind == 'qr' else ''
    return data


def preferences_data(owner, public=False):
    profile = BusinessSettings.objects.filter(owner=owner).first()
    widgets = Widget.objects.filter(owner=owner).defer('image_data')
    if public:
        widgets = widgets.filter(public=True, enabled=True)
    return {'business_name': profile.business_name if profile else '', 'receipt_note': profile.receipt_note if profile else '', 'widgets': [widget_data(w) for w in widgets]}


@require_http_methods(['GET'])
def widget_image(request, identifier):
    from .views import authenticated
    widget = Widget.objects.filter(pk=identifier, kind='qr').first()
    if not widget:
        return JsonResponse({'error': 'Image not found.'}, status=404)
    if not (widget.public and widget.enabled):
        @authenticated
        def private_image(request):
            if widget.owner != request.owner:
                return JsonResponse({'error': 'Image not found.'}, status=404)
            return image_response(widget)
        return private_image(request)
    return image_response(widget)


def image_response(widget):
    return HttpResponse(base64.b64decode(widget.image_data.split(',', 1)[1]), content_type='image/png', headers={'Content-Disposition': 'inline; filename="qr-code.png"', 'X-Content-Type-Options': 'nosniff'})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@authenticated
@reliable_mutation
def preferences(request):
    if request.method == 'GET':
        data = preferences_data(request.owner)
        database = settings.DATABASES['default']
        data['database'] = 'Neon PostgreSQL' if str(database.get('HOST', '')).endswith('.neon.tech') else 'PostgreSQL' if database['ENGINE'].endswith('postgresql') else 'Local SQLite'
        return JsonResponse(data)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError('Invalid settings.')
        with transaction.atomic():
            profile, _ = BusinessSettings.objects.get_or_create(owner=request.owner)
            # Serialize widget changes, including limits and ordering, per owner.
            profile = BusinessSettings.objects.select_for_update().get(pk=profile.pk)
            action = data.get('action')
            if action == 'profile':
                for field, limit in [('business_name', 100), ('receipt_note', 300)]:
                    value = data.get(field, '')
                    if not isinstance(value, str) or len(value.strip()) > limit:
                        raise ValueError(f'{field} must be at most {limit} characters.')
                    setattr(profile, field, value.strip())
                profile.save()
            elif action == 'save':
                widget = owned(Widget, request.owner, data['id']) if data.get('id') else Widget(owner=request.owner, position=Widget.objects.filter(owner=request.owner).count())
                if not data.get('id') and Widget.objects.filter(owner=request.owner).count() >= 12:
                    raise ValueError('You can add up to 12 widgets.')
                kind = text(data, 'kind')
                if kind not in ['qr', 'note', 'link']:
                    raise ValueError('Choose QR image, notice, or link.')
                widget.title = text(data, 'title')
                widget.content = data.get('content', '')
                if not isinstance(widget.content, str) or len(widget.content) > 1000:
                    raise ValueError('Description must be at most 1000 characters.')
                widget.url = ''
                if kind == 'link':
                    widget.url = text(data, 'url', limit=1000)
                    parsed = urlparse(widget.url)
                    if parsed.scheme not in ['http', 'https'] or not parsed.hostname or parsed.username or parsed.password:
                        raise ValueError('Use a full http:// or https:// link without credentials.')
                if kind == 'qr':
                    if data.get('image_data'):
                        widget.image_data = clean_image(data['image_data'])
                    elif not widget.image_data:
                        raise ValueError('Upload a QR image first.')
                else:
                    widget.image_data = ''
                for flag in ['enabled', 'public']:
                    if type(data.get(flag)) is not bool:
                        raise ValueError('Invalid visibility setting.')
                    setattr(widget, flag, data[flag])
                widget.kind = kind
                widget.save()
            elif action == 'delete':
                owned(Widget, request.owner, data.get('id')).delete()
            elif action == 'move':
                widget = owned(Widget, request.owner, data.get('id'))
                direction = data.get('direction')
                if direction not in ['up', 'down']:
                    raise ValueError('Invalid direction.')
                widgets = list(Widget.objects.filter(owner=request.owner))
                index = next(i for i, w in enumerate(widgets) if w.id == widget.id)
                target = index + (-1 if direction == 'up' else 1)
                if 0 <= target < len(widgets):
                    widgets[index], widgets[target] = widgets[target], widgets[index]
                for i, w in enumerate(widgets):
                    w.position = i
                Widget.objects.bulk_update(widgets, ['position'])
            else:
                raise ValueError('Unknown settings action.')
        return JsonResponse({'success': True})
    except (ValueError, TypeError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)
