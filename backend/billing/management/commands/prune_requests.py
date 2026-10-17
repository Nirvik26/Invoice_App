from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.models import Mutation


class Command(BaseCommand):
    help = 'Remove replay keys older than 30 days. Never deletes bills or audit records.'

    def handle(self, *args, **options):
        count, _ = Mutation.objects.filter(created_at__lt=timezone.now()-timedelta(days=30)).delete()
        self.stdout.write(f'Removed {count} expired request keys.')
