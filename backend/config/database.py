import dj_database_url


def postgres_database(url):
    database = dj_database_url.parse(url, conn_max_age=0)
    if database['ENGINE'] != 'django.db.backends.postgresql':
        raise ValueError('HOSPITALITY_DATABASE_URL must be a PostgreSQL URL.')
    # Neon transaction poolers cannot retain server-side cursors between requests.
    database['DISABLE_SERVER_SIDE_CURSORS'] = True
    if str(database.get('HOST', '')).endswith('.neon.tech'):
        options = database.setdefault('OPTIONS', {})
        if options.get('sslmode') not in ['require', 'verify-ca', 'verify-full']:
            options['sslmode'] = 'require'
    return database
