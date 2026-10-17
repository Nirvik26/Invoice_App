# Operating Billora

## Architecture and scope

The web service runs Next.js; the private billing API runs Django/Gunicorn. Invoice/auth records remain owned by Drizzle, and hospitality/settings records by Django. Both can use the same Neon database with different table names. Redis holds shared request counters. No local writable filesystem is required by either production container. Uploaded QR data remains in PostgreSQL, but metadata responses now contain authorized image URLs instead of embedded image bytes.

The production profile is a deployable foundation, not a claim that every business or regulatory requirement is complete. Current settlement is cash for hospitality and Stripe **test mode** for invoices. Staff are a roster, not independent permissioned accounts. Currency remains USD.

## Before deployment

1. Provision Neon/PostgreSQL and Redis on a private network. Preserve/import existing accounts and their UUIDs before migrating hospitality records. Merely changing a database URL does not migrate data.
2. Create an ignored `.env.production`, using `.env.example` as the variable reference. Set `APP_ENV=production`, `DATABASE_URL`, `HOSPITALITY_DATABASE_URL`, `SESSION_SECRET`, a distinct `API_SIGNING_SECRET`, `DJANGO_SECRET_KEY`, `APP_URL=https://your-domain`, and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Generate random 32-byte values using a secret manager; the server-actions key must be base64. Use the same action key and application image across all web replicas. Never commit this file.
3. Use a pooled Neon URL for runtime connections and a direct URL for migrations. Django requires TLS on Neon. Size the aggregate connection budget: web replicas × `DB_POOL_MAX` plus API workers/threads and migration connections must fit the database limit. Default web pool size is 5; Gunicorn starts with 2 workers × 2 threads.
4. Build images: `docker compose --env-file .env.production build`.
5. Run Django migrations as a single release task: `docker compose --env-file .env.production run --rm backend python manage.py migrate`. This is deliberately not part of every worker's startup. The new migrations add totals, request replay keys, audit records, and indexes, and backfill existing bills without deleting them.
6. Apply invoice migrations using the existing `bun run db:upgrade` release command with the direct database URL. For a new database, initialize its invoice schema first (`bun run db:push`); do not run development seeding on real data.
7. Start: `docker compose --env-file .env.production up -d`. The web port binds to loopback. Put an HTTPS reverse proxy/load balancer in front of it. Keep API and Redis ports private. Set a request-body limit of 3 MB and enforce IP-based login/public-endpoint limits at the edge. Set `APP_URL` to the browser origin so API origin checks remain correct behind the proxy.

The API production profile refuses SQLite, missing Redis configuration, debug mode, weak signing secrets, wildcard hosts, and HTTP public URLs. Compose supplies the internal backend hostname. Gunicorn speaks HTTP only on the private network; TLS ends at the trusted public proxy. Django's global SSL redirect is intentionally not enabled for this internal service. `DJANGO_ALLOWED_HOSTS` must match your private service names if deploying outside Compose.

Docker is not installed on the development host used for this change. Image definitions and the CI workflow are provided, but image builds and a real deployment still need to run in Docker/CI. Neon credentials are not yet configured locally.

## Scaling and performance

- API and web instances have no process-local business state. Production throttling uses shared Redis. Mutation replay and audit records are transactionally stored in PostgreSQL.
- A mutation key identifies one intent for 30 days. Retrying the same key and body returns its saved result; reusing it for different data returns 409. A browser retry after a network/server failure retains its key while the component remains mounted. A full browser reload does not preserve an uncertain intent: inspect the current bill before resubmitting.
- Requests within one workspace serialize briefly on its settings record to enforce count limits and idempotency. Different workspaces can write concurrently. This favors financial consistency; monitor contention before increasing write throughput.
- Hospitality history uses a 50-receipt keyset page, with a Load older receipts control. Open bills stay visible, and database aggregates retain accurate lifetime totals across pages. The migration adds an owner/status/time index and stored integer totals.
- Workspace limits are 500 spaces, 500 staff, 1,000 menu items, 100 lines per bill, and 12 widgets. They bound active-workspace payloads; plan explicit larger-workspace pagination before increasing them.
- QR images are fetched independently and lazily by the browser. Every image request checks current owner/public visibility; private images never become permanent public links. Large asset volumes should move to private object storage with short-lived signed URLs.
- The legacy invoice overview still loads its full invoice/client lists; paginate and move its remaining summaries to SQL before targeting large invoice tenants. It no longer refreshes every 5 seconds: it refreshes visible invoice views every 30 seconds, and does not poll during editing or in hospitality/settings.

## Reliability and monitoring

`/api/health` on Next.js is liveness only. Django `/health/live/` is liveness; `/health/ready/` checks the migrated database and cache and returns 503 when unavailable. Monitor readiness, 5xx rate, latency, database connections, Redis memory, and failed Stripe webhook responses.

Set `REQUEST_LOG_LEVEL=INFO` for structured request logs with request ID, route pattern, HTTP method, status, and duration. Route patterns avoid logging guest bearer tokens; never add request bodies, Authorization headers, or database URLs to logs. Forward stderr and request logs to your monitoring platform. Audit events store owner, action, resource ID where supplied, request ID, and timestamp, without uploading images or guest details into the audit record.

Successful hospitality/settings writes have an audit record and persisted replay response in the same transaction. Failed writes do not leave success audit records. Run `python manage.py prune_requests` daily in the backend container to remove replay keys older than 30 days. Audit records and bills are retained; set a retention policy before any future purge.

Per-account authentication attempts are limited to 10/minute before password verification. Hospitality mutations default to 120/minute per owner, configurable with `WRITE_RATE_LIMIT`. Rate-limited responses include `Retry-After`. Redis failures fail closed in production. Public guest menus and invalid JWT traffic require edge IP limits; account-based throttling alone cannot stop distributed abuse or deliberate account lockouts.

## Testing and releases

The GitHub Actions workflow provisions PostgreSQL and Redis, checks migrations, runs backend and invoice integration tests, lints, and builds Next.js. Locally run `bun run backend:test`, `bun run test`, `bun run lint`, and `bun run build`. Use a dedicated migrated `TEST_DATABASE_URL` for invoice integration tests; never point integration tests at production. Django tests also need a dedicated database/user permitted to create their test database.

Deploy the same image digest to all replicas and keep the shared server-action encryption key stable across them. Roll forward database migrations before routing traffic to the new version. Prefer additive schema changes. Roll back application images only when the previous image supports the current schema; do not automatically reverse financial migrations.

## Backups and launch gates

Enable Neon point-in-time recovery and scheduled logical backups. Include both schema families, the audit/replay tables, and widget images. Perform a restore drill into a separate branch/database before launch, checking owner UUIDs, bill totals, and media access. Redis counters are disposable; loss can reset throttles, so restore durable financial data from PostgreSQL, not Redis.

Before accepting real payments or running a multi-staff business, complete: live payment-provider onboarding and webhook reconciliation, refunds/voids and financial audit policy, account recovery/email verification/session revocation, independently authenticated staff with role permissions, jurisdiction-specific tax/currency/receipt requirements, staging load tests with declared traffic targets, security review, and alert/backup ownership. No production traffic capacity has been claimed or load-tested by this change.
