# Billora

A hospitality billing workspace built with Next.js, React, Django/Python, and Bun. Existing invoices, proposals, and Stripe test payments remain available.

## Hospitality billing

The default workspace now includes Restaurant, Hotel, Homestay, Staff, QR codes, and Bills & receipts.

- Add tables and rooms, capacity, nightly rates, menu items, and service extras.
- Open a table bill or check in a guest with check-in/out dates. Nightly charges are calculated automatically and snapshotted.
- Assign active staff, add menu items with quantities, remove extras, and calculate per-bill tax in integer cents.
- Record received cash, close a bill, free the table/room, and print the immutable receipt.
- Download real SVG QR codes for each table/room. Codes open a mobile guest menu at `/guest/<token>`; they never expose guest names or folios. Ordering is handled by staff.
- Existing invoice/proposal payments continue using Stripe test Checkout. Hospitality settlement currently records **cash only**; a QR menu is not a payment-provider QR.

Django owns hospitality data, settings, and widgets in PostgreSQL when `HOSPITALITY_DATABASE_URL` is set, or in `backend/db.sqlite3` otherwise. Existing authentication, clients, invoices, proposals, and Stripe integrations retain their PostgreSQL/Drizzle backend. This is an additive backend, not a migration of existing invoice data. Hospitality receipts appear under **Bills & receipts**, not the legacy invoice list. Staff records are an assignment roster, not separate login accounts or payroll.

### Start Django

Requires Python 3.10+ (tested with 3.13) and Bun 1.4.3.

```powershell
bun install --frozen-lockfile
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
bun run backend:migrate

# Run both backend and frontend together:
bun run dev:all
# Or run with: python scripts/dev.py (or .\run-dev.bat on Windows)
```

On macOS/Linux use `backend/.venv/bin/python` for the pip command. Alternatively, run backend (`bun run backend:dev`) and frontend (`bun run dev`) in separate terminals. Set the same strong `SESSION_SECRET` for both services; Django reads the root `.env.local`. Next.js proxies authenticated requests with a signed, expiring bearer token, and Django scopes every private query to its owner UUID. No database credentials or session tokens reach guest QR pages.

Set `PUBLIC_APP_URL` to your reachable frontend origin **before printing QR codes**. The localhost default works only on the development computer. Set `DJANGO_API_URL` when Django is deployed elsewhere. Keep Django behind a private network/TLS proxy, and use a production WSGI server instead of `runserver`. SQLite uses immediate transactions and a unique active-bill constraint; back up its database file. Currency is USD throughout the current app.

The authenticated `/hospitality` route also opens billing directly. Signing in still requires the existing PostgreSQL database. If login fails with a PostgreSQL password error, correct `DATABASE_URL`; the new Django database does not replace existing accounts.

### Backend API and checks

- `GET /api/workspace/`: owner's tables, rooms, staff, menu, and bills.
- `POST /api/command/`: validated space/staff/menu creation, staff activation, open/add/remove/settle commands.
- `GET /api/guest/<token>/`: public menu only.
- `GET /api/qr/<token>/`: generated SVG code pointing to the guest menu.

```powershell
bun run backend:check
bun run backend:test
bun run test
bun run lint
bun x tsc --noEmit
bun run build
```

Backend tests cover owner isolation, expired tokens, duplicate open bills, room-night pricing, invalid quantities, rounding, cash settlement, immutable receipts, and guest privacy. Existing invoice integration tests below require a separate PostgreSQL test database.

## Proposals and payments

- Create proposals with scope, line items, tax, payment terms, and up to 12 percentage-based milestones.
- Publish a private review link. Clients can comment, request changes, or approve a specific revision.
- Each saved revision preserves its original scope, pricing, and milestones in the activity history. Accepted proposals are immutable.
- Acceptance creates exactly one invoice, including the agreed payment schedule. Concurrent or repeated approvals cannot create a second invoice.
- Collect deposits and subsequent installments through **Stripe hosted Checkout in test mode**. Card information never enters this app.
- Signed Stripe webhooks record confirmed payments and update balances. Checkout redirects alone never mark an invoice paid.
- Payment attempts survive interrupted requests, reuse provider idempotency keys, and prevent concurrent checkouts for the same installment.
- Invoice lists, payment history, and revenue totals reflect partial payments. Open workspace and invoice pages refresh periodically.

Milestones are paid in order when the client and issuer agree the work is complete; this release does not gate payments on a separate milestone-release action. A private proposal link is a bearer credential: anyone holding it can respond. Approval records the entered name, consent, revision, and timestamp; it is not identity verification or a digital-signature service.

## Local setup

1. Install dependencies with `bun install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local`; supply a working `DATABASE_URL` and a strong `SESSION_SECRET`.
3. For an **existing Billora database**, run `bun run db:upgrade`. The additive migration preserves existing users, clients, invoices, and line items.
4. For a **new empty database**, run `bun run db:push` first, then `bun run db:upgrade`.
5. Run `bun run dev` and sign in or create an account.

The previous `/invoice/INV-…` links are intentionally no longer public. Copy replacement private links from invoice details. Existing invoices marked Paid retain their legacy balance without inventing payment-provider records.

`bun run db:seed` resets the database to demo data. Use it only with a disposable development database.

## Stripe test configuration

Add these to `.env.local` and restart the app:

```dotenv
APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward events locally:

```sh
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the signing secret printed by that listener. On a hosted test deployment, configure the same endpoint in Stripe and use that endpoint's signing secret. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Use Stripe's [test card numbers](https://docs.stripe.com/testing), such as `4242 4242 4242 4242`, with a future expiry and any three-digit CVC. No real funds move. Live keys are deliberately rejected. All payments belong to the configured test Stripe account; this is not a multi-merchant Stripe Connect integration.

Without the test key, webhook secret, and app URL, invoices remain viewable and show that online payments are not configured. `APP_URL` must be the app's canonical origin and use HTTPS outside localhost.

## Portfolio walkthrough

1. Add a client, then open **Proposals → New proposal**.
2. Enter the scope and pricing; keep the default 30% deposit / 70% final-delivery schedule or add custom milestones totaling 100%.
3. Save the draft and choose **Publish & copy review link**. Share the link manually; the app does not send email.
4. Open Client preview, enter a test name, and request a change.
5. Back in the workspace, edit the proposal, save a new revision, and publish it. Refresh the client page to see the revision.
6. Confirm approval in the client portal. Follow **View invoice & pay** to the generated invoice.
7. With Stripe configured, pay the deposit in hosted test checkout. Verify the remaining balance and payment history update, then pay the final installment.

## Verification

```sh
npm test
bun run lint
bun run build
```

Integration tests require an **isolated, migrated PostgreSQL database**. They do not read `.env.local` and clean up only their own fixtures:

```powershell
$env:TEST_DATABASE_URL='postgresql://user:password@localhost:5432/billora_test'
bun run test:integration
```

These tests exercise revision conflicts, tenant isolation, concurrent approvals, interrupted checkout requests, duplicate/out-of-order events, expired/failed retries, and full settlement. They use a fake Stripe transport with the real database; verify a hosted Stripe test checkout separately after supplying keys.

If a checkout was created but its response could not be recorded, requests retry the same payment attempt. An unresolved attempt older than 23 hours is blocked to avoid reuse after Stripe's idempotency retention window. Reconcile its `paymentId` metadata in Stripe and replay the verified event before resolving it; do not simply delete a pending attempt.

## Settings, widgets, and uploaded QR codes

Open **Settings** in the sidebar or go to `/settings`. Save a business name and guest message, then add up to 12 widgets:

- **QR image:** upload a PNG, JPEG, or WebP (up to 2 MB / 4 megapixels), preview, replace, or download it.
- **Notice:** display text such as opening hours, Wi-Fi instructions, or team reminders.
- **Link:** add an HTTP(S) link, such as your website or booking page.

Widgets can be edited, reordered, hidden, and removed. They appear on the hospitality dashboard. Public guest-menu visibility is **off by default** and must be explicitly enabled for each widget. Hidden widgets are also hidden from guest menus. Business name and guest message are public on guest menus. Uploaded QR images are validated, flattened onto white without resizing, stripped of metadata, and persisted in the backend database; no temporary filesystem or third-party upload service is required. These are user-supplied images: confirm that the code scans to the intended destination. Payment QR uploads do not automatically verify or settle a bill.

After pulling the update, install the new Python dependencies and run `bun run backend:migrate`. Existing SQLite records remain in place.

## Connecting your Neon PostgreSQL database

The current app uses two database configurations:

- `DATABASE_URL`: existing invoices, clients, proposals, payments, and login accounts (Next.js/Drizzle).
- `HOSPITALITY_DATABASE_URL`: hospitality billing, settings, and uploaded widgets (Django). If unset, Django retains the existing local SQLite database.

Copy the PostgreSQL connection URL from your Neon project's **Connect** panel into `.env.local`. Do not put credentials in the Settings UI, a widget, a public environment variable, or source control. Both services may use the same Neon database: Django's tables have the `billing_` prefix. Keep `sslmode=require` (or stronger verification) in the connection URL. The Django adapter requires TLS for Neon, preserves channel binding parameters, disables server-side cursors for pooled connections, and avoids persistent connections.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-HOST.neon.tech/neondb?sslmode=require
HOSPITALITY_DATABASE_URL=postgresql://USER:PASSWORD@YOUR-HOST.neon.tech/neondb?sslmode=require
```

For a **new empty Neon database**, run:

```powershell
bun run db:push
bun run db:upgrade
bun run backend:migrate
bun run dev:all
```

For an existing initialized invoice database, use `bun run db:upgrade` and `bun run backend:migrate`; don't run demo seeding. Use Neon's direct connection URL for schema migrations. Restart both services after changing environment variables. Settings shows the connected hospitality database type without exposing credentials.

Changing URLs does **not** move existing data. Preserve the existing PostgreSQL accounts and their UUIDs when migrating invoices; Django owner IDs refer to those accounts. Before switching Django off SQLite, back it up and export its `billing` records using Django `dumpdata --output` while the old configuration is still active; migrate the new target, then import with `loaddata`. Do not load exports over existing conflicting records. A new empty database starts with no previous accounts, widgets, or bills. `HOSPITALITY_DB_PATH` intentionally overrides the PostgreSQL URL for isolated local testing; leave it unset for Neon.

Connection configuration follows [Neon's Django guide](https://neon.com/blog/python-django-and-neons-serverless-postgres). Actual Neon connectivity requires your private connection URL; creating a project in the console alone does not connect this repository.

## Production architecture and operations

See [the production runbook](docs/production.md) for deployment, Neon/Redis configuration, scaling limits, migrations, backups, monitoring, and remaining launch requirements. Dockerfiles, Compose, and a PostgreSQL/Redis CI workflow are included.

Hospitality writes now support persistent idempotency keys and audit events. Bill history is paginated while lifetime totals stay accurate. QR uploads are returned as independently authorized image URLs instead of embedded blobs in metadata responses. Production uses distinct short-lived API tokens and shared throttling; development retains the existing local configuration.
