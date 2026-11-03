# Deploying the portfolio demo

A low-cost setup for a public showcase: Next.js on Vercel, PostgreSQL on Neon.

## 1. Database

1. Create a Neon project and copy the **pooled** connection string.
2. With `DATABASE_URL` set to the **direct** string in `.env.local`, run `bun run db:push` and then `bun run db:upgrade`.
3. Do not run `bun run db:seed` here. It wipes every table. The demo workspace seeds itself on first use.

## 2. Vercel

Import the repository, then set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | your production origin, e.g. `https://billora.yourname.dev` |
| `STRIPE_SECRET_KEY` | Stripe **test** key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | signing secret of a test-mode webhook pointing at `/api/stripe/webhook` |
| `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` | `true` / `true` |
| `CRON_SECRET` | random string; Vercel Cron sends it as a Bearer token |

`NEXT_PUBLIC_DEMO_MODE` is read at build time, so redeploy after changing it.

`vercel.json` schedules `/api/demo/reset` daily at 04:00 UTC. It deletes and recreates only the `demo@billora.app` workspace, so visitor edits disappear overnight and real accounts are untouched.

## 3. Known limitation: the Django service

Sign-in throttling calls the Django API (`DJANGO_API_URL`). With `APP_ENV=production` it **fails closed** when that service is unreachable, so password sign-in is blocked unless Django and Redis are deployed too. The demo button skips that check, so the demo works either way. The hospitality module also needs Django. For a Next.js-only showcase, deploy without `APP_ENV=production`, or deploy the backend per [production.md](production.md).

## 4. Verify

1. Open `/sign-in` and click **Try the live demo**.
2. Open an invoice and run a payment with Stripe test card `4242 4242 4242 4242`.
3. Call `/api/demo/reset` with `Authorization: Bearer $CRON_SECRET` and confirm the workspace resets.
