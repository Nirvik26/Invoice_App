import uuid
from django.db import models
from django.db.models import Q


class Owned(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.UUIDField(db_index=True)
    class Meta:
        abstract = True


class Staff(Owned):
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=50)
    active = models.BooleanField(default=True)


class Space(Owned):
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=20, choices=[('restaurant', 'Restaurant'), ('hotel', 'Hotel'), ('homestay', 'Homestay')])
    capacity = models.PositiveIntegerField(default=2)
    rate_cents = models.PositiveIntegerField(default=0)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'name'], name='unique_space_name')]


class MenuItem(Owned):
    name = models.CharField(max_length=100)
    price_cents = models.PositiveIntegerField()
    category = models.CharField(max_length=50, default='Kitchen')


class Bill(Owned):
    space = models.ForeignKey(Space, on_delete=models.PROTECT)
    staff = models.ForeignKey(Staff, on_delete=models.PROTECT, null=True)
    guest = models.CharField(max_length=100, blank=True)
    check_in = models.DateField(null=True)
    check_out = models.DateField(null=True)
    tax_percent = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, default='open')
    payment_method = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True)
    subtotal_cents = models.BigIntegerField(default=0)
    total_cents = models.BigIntegerField(default=0)
    class Meta:
        indexes = [models.Index(fields=['owner', 'status', '-created_at', '-id'], name='bill_owner_history_idx')]
        constraints = [models.UniqueConstraint(fields=['space'], condition=Q(status='open'), name='one_open_bill_per_space')]


class BillLine(models.Model):
    bill = models.ForeignKey(Bill, related_name='lines', on_delete=models.CASCADE)
    description = models.CharField(max_length=200)
    rate_cents = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()


class BusinessSettings(Owned):
    business_name = models.CharField(max_length=100, blank=True)
    receipt_note = models.CharField(max_length=300, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner'], name='one_settings_per_owner')]


class Widget(Owned):
    title = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=[('qr', 'QR image'), ('note', 'Notice'), ('link', 'Link')])
    content = models.CharField(max_length=1000, blank=True)
    url = models.URLField(max_length=1000, blank=True)
    image_data = models.TextField(blank=True)
    enabled = models.BooleanField(default=True)
    public = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = ['position', 'id']


class Mutation(Owned):
    key = models.UUIDField()
    fingerprint = models.CharField(max_length=64)
    response = models.JSONField(default=dict)
    status_code = models.PositiveSmallIntegerField(default=200)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'key'], name='mutation_owner_key_unique')]


class AuditEvent(Owned):
    action = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True)
    request_id = models.CharField(max_length=36)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=['owner', '-created_at'], name='audit_owner_time_idx')]
