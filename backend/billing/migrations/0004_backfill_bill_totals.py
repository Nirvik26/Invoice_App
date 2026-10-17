from django.db import migrations


def backfill(apps, schema_editor):
    Bill = apps.get_model('billing', 'Bill')
    batch = []
    for bill in Bill.objects.prefetch_related('lines').iterator(chunk_size=200):
        subtotal = sum(line.rate_cents * line.quantity for line in bill.lines.all())
        bill.subtotal_cents = subtotal
        bill.total_cents = subtotal + (subtotal * bill.tax_percent + 50) // 100
        batch.append(bill)
        if len(batch) == 200:
            Bill.objects.bulk_update(batch, ['subtotal_cents', 'total_cents'])
            batch = []
    if batch:
        Bill.objects.bulk_update(batch, ['subtotal_cents', 'total_cents'])


class Migration(migrations.Migration):
    dependencies = [('billing', '0003_auditevent_mutation_bill_subtotal_cents_and_more')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
