# Digital Heroes

A golf performance and charity draw platform (PRD Level 1, v1.0, March 2026).

## Stack
- React 19 + Vite + TypeScript, Tailwind v4
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Stripe (subscriptions, billing portal, one-off donations)

## One-time setup

1. **New Supabase project** (not a personal/existing one — required by the PRD).
   ```powershell
   supabase login
   supabase link --project-ref YOUR_NEW_PROJECT_REF
   supabase db push
   ```
   This runs `supabase/migrations/20260101000000_init_schema.sql`, which creates every
   table, RLS policy, the `winner-proofs` storage bucket, and seeds four starter charities.

2. **Make yourself an admin.** In the Supabase SQL editor, after you've signed up once
   in the app:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

3. **Stripe.** Create two recurring Prices (monthly, yearly) in test mode, then set secrets:
   ```powershell
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_PRICE_MONTHLY=price_...
   supabase secrets set STRIPE_PRICE_YEARLY=price_...
   supabase secrets set SITE_URL=https://your-app.vercel.app
   supabase functions deploy create-checkout-session
   supabase functions deploy create-donation-session
   supabase functions deploy create-portal-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   In the Stripe dashboard, add a webhook endpoint pointing at
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret:
   ```powershell
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Frontend env.** Copy `.env.example` to `.env.local` and fill in your project's
   URL and anon key (Supabase dashboard -> Project Settings -> API).

## Local development
```powershell
npm install
npm run dev
```

## Deploy
Deploy to a **new** Vercel account (also required by the PRD — not your personal one).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the
Vercel project, then point `SITE_URL` (the Supabase secret) at the deployed URL so
Stripe redirects land back on the live site instead of localhost.

## Notes on scope decisions
- **Draw numbers**: a subscriber's 5 numbers are their 5 most recent Stableford scores
  (1-45). The PRD does not define a separate "pick your numbers" flow, so scores double
  as draw numbers — avoids building a second data-entry UI for the same range.
- **Prize pool**: `PRIZE_POOL_SHARE` (see `src/lib/config.ts`) of every active
  subscriber's monthly-equivalent payment, split 40/35/25 across the three tiers per
  PRD section 07. Uses the real Stripe amount stored on the subscription row.
- **Algorithmic draw**: numbers that appear more often across subscribers' current
  scores are weighted more heavily when the winning numbers are drawn.
