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
    class Meta:
        constraints = [models.UniqueConstraint(fields=['space'], condition=Q(status='open'), name='one_open_bill_per_space')]


class BillLine(models.Model):
    bill = models.ForeignKey(Bill, related_name='lines', on_delete=models.CASCADE)
    description = models.CharField(max_length=200)
    rate_cents = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
