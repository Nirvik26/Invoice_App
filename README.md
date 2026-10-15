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

Django owns hospitality data in `backend/db.sqlite3`. Existing authentication, clients, invoices, proposals, and Stripe integrations retain their PostgreSQL/Drizzle backend. This is an additive backend, not a migration of existing invoice data. Hospitality receipts appear under **Bills & receipts**, not the legacy invoice list. Staff records are an assignment roster, not separate login accounts or payroll.

### Start Django

Requires Python 3.10+ (tested with 3.13) and Bun 1.4.3.

```powershell
bun install --frozen-lockfile
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
bun run backend:migrate
bun run backend:dev
```

On macOS/Linux use `backend/.venv/bin/python` for the pip command. In another terminal, run `bun run dev`. Set the same strong `SESSION_SECRET` for both services; Django reads the root `.env.local`. Next.js proxies authenticated requests with a signed, expiring bearer token, and Django scopes every private query to its owner UUID. No database credentials or session tokens reach guest QR pages.

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
