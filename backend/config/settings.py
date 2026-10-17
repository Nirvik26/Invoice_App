import os
from pathlib import Path
from dotenv import load_dotenv
from .database import postgres_database

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / '.env.local')
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', os.environ.get('SESSION_SECRET', ''))
if not SECRET_KEY:
    raise RuntimeError('Set DJANGO_SECRET_KEY and SESSION_SECRET in .env.local')
SESSION_SECRET = os.environ.get('SESSION_SECRET', '')
PRODUCTION = os.environ.get('APP_ENV') == 'production'
API_SIGNING_SECRET = os.environ.get('API_SIGNING_SECRET', '')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
ROOT_URLCONF = 'config.urls'
INSTALLED_APPS = ['billing']
MIDDLEWARE = ['config.middleware.RequestContextMiddleware', 'django.middleware.security.SecurityMiddleware', 'django.middleware.common.CommonMiddleware']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('HOSPITALITY_DB_PATH', BASE_DIR / 'db.sqlite3'), 'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20}}}
if os.environ.get('HOSPITALITY_DATABASE_URL') and not os.environ.get('HOSPITALITY_DB_PATH'):
    DATABASES['default'] = postgres_database(os.environ['HOSPITALITY_DATABASE_URL'])
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
PUBLIC_APP_URL = os.environ.get('PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')
DATA_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024
WRITE_RATE_LIMIT = int(os.environ.get('WRITE_RATE_LIMIT', '120'))
REDIS_URL = os.environ.get('REDIS_URL', '')
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}} if REDIS_URL else {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
LOGGING = {'version': 1, 'disable_existing_loggers': False, 'handlers': {'console': {'class': 'logging.StreamHandler'}}, 'loggers': {'billora.requests': {'handlers': ['console'], 'level': os.environ.get('REQUEST_LOG_LEVEL', 'WARNING'), 'propagate': False}}}
if PRODUCTION:
    if DEBUG or DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql' or not REDIS_URL:
        raise RuntimeError('Production requires DEBUG=false, PostgreSQL, and REDIS_URL.')
    if min(len(SECRET_KEY), len(SESSION_SECRET), len(API_SIGNING_SECRET)) < 32 or API_SIGNING_SECRET == SESSION_SECRET:
        raise RuntimeError('Production requires strong secrets and a separate API_SIGNING_SECRET.')
    if not PUBLIC_APP_URL.startswith('https://') or '*' in ALLOWED_HOSTS:
        raise RuntimeError('Production requires an HTTPS PUBLIC_APP_URL and explicit allowed hosts.')
