import io
import json
import uuid
from datetime import date
from functools import wraps
import jwt
import qrcode
import qrcode.image.svg
from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Sum, Q
from .reliability import reliable_mutation
from .reliability import rate_limit
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.utils import timezone
from .models import Staff, Space, MenuItem, Bill, BillLine


def authenticated(fn):
    @wraps(fn)
    def wrapped(request, *args, **kwargs):
        try:
            header = request.headers.get('Authorization', '')
            if not header.startswith('Bearer '):
                raise ValueError()
            if settings.API_SIGNING_SECRET:
                claims = jwt.decode(header[7:], settings.API_SIGNING_SECRET, algorithms=['HS256'], audience='billora-api', issuer='billora-web', options={'require': ['exp', 'iat', 'userId']})
                if claims['exp'] - claims['iat'] > 90:
                    raise ValueError()
            else:
                claims = jwt.decode(header[7:], settings.SESSION_SECRET, algorithms=['HS256'], options={'require': ['exp', 'userId']})
            request.owner = uuid.UUID(claims['userId'])
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            return JsonResponse({'error': 'Please sign in.'}, status=401)
        return fn(request, *args, **kwargs)
    return wrapped


@csrf_exempt
@require_POST
@authenticated
def auth_limit(request):
    limited = rate_limit(str(request.owner), 10, scope='auth')
    return limited if limited is not None else JsonResponse({'allowed': True})


def text(data, key, default=None, limit=100):
    value = data.get(key, default)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f'Enter a valid {key} (up to {limit} characters).')
    return value.strip()


def integer(data, key, low=0, high=100000000, default=None):
    value = data.get(key, default)
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f'{key} must be between {low} and {high}.')
    return value


def owned(model, owner, identifier):
    try:
        return model.objects.get(owner=owner, pk=uuid.UUID(str(identifier)))
    except (ValueError, model.DoesNotExist):
        raise ValueError('Record not found.')


def bill_data(bill):
    lines = [{'id': line.id, 'description': line.description, 'rate_cents': line.rate_cents, 'quantity': line.quantity} for line in bill.lines.all()]
    subtotal = sum(line['rate_cents'] * line['quantity'] for line in lines)
    tax = (subtotal * bill.tax_percent + 50) // 100
    return {'id': str(bill.id), 'number': 'BILL-' + str(bill.id)[:8].upper(), 'space_id': str(bill.space_id), 'space_name': bill.space.name, 'kind': bill.space.kind, 'staff_name': bill.staff.name if bill.staff else '', 'guest': bill.guest, 'check_in': bill.check_in, 'check_out': bill.check_out, 'status': bill.status, 'payment_method': bill.payment_method, 'created_at': bill.created_at, 'paid_at': bill.paid_at, 'tax_percent': bill.tax_percent, 'subtotal_cents': subtotal, 'tax_cents': tax, 'total_cents': subtotal + tax, 'lines': lines}


@require_GET
@authenticated
def workspace(request):
    owner = request.owner
    base = Bill.objects.filter(owner=owner)
    history = base.filter(status='paid').order_by('-created_at', '-id')
    before = request.GET.get('before')
    if before:
        try:
            anchor = owned(Bill, owner, before)
        except ValueError:
            return JsonResponse({'error': 'Invalid history cursor.'}, status=400)
        history = history.filter(Q(created_at__lt=anchor.created_at) | Q(created_at=anchor.created_at, id__lt=anchor.id))
    recent = list(history.select_related('space', 'staff').prefetch_related('lines')[:51])
    next_cursor = str(recent[49].id) if len(recent) > 50 else None
    open_bills = list(base.filter(status='open').select_related('space', 'staff').prefetch_related('lines').order_by('-created_at'))
    stats = base.aggregate(outstanding=Sum('total_cents', filter=Q(status='open'), default=0), collected=Sum('total_cents', filter=Q(status='paid'), default=0))
    return JsonResponse({'spaces': list(Space.objects.filter(owner=owner).values()), 'staff': list(Staff.objects.filter(owner=owner).values()), 'menu': list(MenuItem.objects.filter(owner=owner).values()), 'bills': [bill_data(b) for b in open_bills + recent[:50]], 'next_cursor': next_cursor, 'stats': stats})


@csrf_exempt
@require_POST
@authenticated
@reliable_mutation
def command(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError('Expected an object.')
        action = data.get('action')
        owner = request.owner
        with transaction.atomic():
            limits = {'space': (Space, 500), 'staff': (Staff, 500), 'menu': (MenuItem, 1000)}
            if action in limits:
                model, limit = limits[action]
                if model.objects.filter(owner=owner).count() >= limit:
                    raise ValueError(f'This workspace supports up to {limit} {action} records.')
            if action == 'space':
                kind = text(data, 'kind')
                if kind not in ['restaurant', 'hotel', 'homestay']:
                    raise ValueError('Choose a valid space type.')
                Space.objects.create(owner=owner, name=text(data, 'name'), kind=kind, capacity=integer(data, 'capacity', 1, 100, 2), rate_cents=integer(data, 'rate_cents', default=0))
            elif action == 'staff':
                Staff.objects.create(owner=owner, name=text(data, 'name'), role=text(data, 'role', 'Server', 50))
            elif action == 'staff_toggle':
                person = owned(Staff, owner, data.get('id'))
                person.active = not person.active
                person.save(update_fields=['active'])
            elif action == 'menu':
                MenuItem.objects.create(owner=owner, name=text(data, 'name'), category=text(data, 'category', 'Kitchen', 50), price_cents=integer(data, 'price_cents', 1, 1000000))
            elif action == 'open':
                space = owned(Space, owner, data.get('space_id'))
                staff = owned(Staff, owner, data['staff_id']) if data.get('staff_id') else None
                if staff and not staff.active:
                    raise ValueError('Choose an active staff member.')
                check_in = check_out = None
                if space.kind != 'restaurant':
                    check_in = date.fromisoformat(text(data, 'check_in'))
                    check_out = date.fromisoformat(text(data, 'check_out'))
                    if not 1 <= (check_out - check_in).days <= 365:
                        raise ValueError('A stay must be between 1 and 365 nights.')
                    if space.rate_cents <= 0:
                        raise ValueError('A room needs a nightly rate.')
                bill = Bill.objects.create(owner=owner, space=space, staff=staff, guest=text(data, 'guest', 'Walk-in'), check_in=check_in, check_out=check_out, tax_percent=integer(data, 'tax_percent', 0, 100, 0))
                if check_in:
                    BillLine.objects.create(bill=bill, description=f'{space.name} · nightly stay', rate_cents=space.rate_cents, quantity=(check_out-check_in).days)
            elif action in ['add', 'remove', 'settle']:
                bill = owned(Bill, owner, data.get('bill_id'))
                bill = Bill.objects.select_for_update().get(pk=bill.id)
                if bill.status != 'open':
                    raise ValueError('Settled bills cannot be changed.')
                if action == 'add':
                    item = owned(MenuItem, owner, data.get('menu_id'))
                    if bill.lines.count() >= 100:
                        raise ValueError('A bill can contain up to 100 lines.')
                    BillLine.objects.create(bill=bill, description=item.name, rate_cents=item.price_cents, quantity=integer(data, 'quantity', 1, 100))
                elif action == 'remove':
                    # Lodging charges remain fixed; only menu extras may be removed.
                    line = bill.lines.get(pk=integer(data, 'line_id', 1))
                    if '· nightly stay' in line.description:
                        raise ValueError('The nightly stay charge cannot be removed.')
                    line.delete()
                else:
                    method = text(data, 'payment_method')
                    if method != 'cash':
                        raise ValueError('Only a received cash payment can be recorded here.')
                    if bill_data(bill)['total_cents'] <= 0:
                        raise ValueError('Add charges before settling.')
                    bill.status = 'paid'
                    bill.payment_method = method
                    bill.paid_at = timezone.now()
                    bill.save(update_fields=['status', 'payment_method', 'paid_at'])
            else:
                raise ValueError('Unknown action.')
            if action in ['open', 'add', 'remove']:
                totals = bill_data(bill)
                bill.subtotal_cents = totals['subtotal_cents']
                bill.total_cents = totals['total_cents']
                bill.save(update_fields=['subtotal_cents', 'total_cents'])
        return JsonResponse({'success': True})
    except IntegrityError:
        return JsonResponse({'error': 'This name already exists or this space already has an open bill.'}, status=409)
    except (ValueError, TypeError, BillLine.DoesNotExist) as exc:
        return JsonResponse({'error': str(exc) or 'Invalid request.'}, status=400)


@require_GET
def guest(request, token):
    from .preferences import preferences_data
    space = Space.objects.filter(token=token).first()
    if not space:
        return JsonResponse({'error': 'Menu not found.'}, status=404)
    # Public QR only exposes the menu, never a guest name, folio, or staff roster.
    return JsonResponse({'name': space.name, 'kind': space.kind, 'menu': list(MenuItem.objects.filter(owner=space.owner).values('id', 'name', 'category', 'price_cents')), 'preferences': preferences_data(space.owner, public=True)})


@require_GET
def qr(request, token):
    if not Space.objects.filter(token=token).exists():
        return JsonResponse({'error': 'Code not found.'}, status=404)
    code = qrcode.make(f'{settings.PUBLIC_APP_URL}/guest/{token}', image_factory=qrcode.image.svg.SvgPathImage, border=4)
    output = io.BytesIO()
    code.save(output)
    return HttpResponse(output.getvalue(), content_type='image/svg+xml', headers={'Content-Disposition': 'inline; filename="billora-menu.svg"'})
