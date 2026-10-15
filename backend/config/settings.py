import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / '.env.local')
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', os.environ.get('SESSION_SECRET', ''))
if not SECRET_KEY:
    raise RuntimeError('Set DJANGO_SECRET_KEY and SESSION_SECRET in .env.local')
SESSION_SECRET = os.environ.get('SESSION_SECRET', '')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
ROOT_URLCONF = 'config.urls'
INSTALLED_APPS = ['billing']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.middleware.common.CommonMiddleware']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('HOSPITALITY_DB_PATH', BASE_DIR / 'db.sqlite3'), 'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20}}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
PUBLIC_APP_URL = os.environ.get('PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')
DATA_UPLOAD_MAX_MEMORY_SIZE = 65536
