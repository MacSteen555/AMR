# Stripe Implementation Testing Guide

This guide explains how to test the Stripe billing implementation on the `jg-stripe-implementation` branch.

## Prerequisites

- Node.js 18+
- Stripe CLI installed ([Installation Guide](https://stripe.com/docs/stripe-cli))
- Access to the Stripe test dashboard

## 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Stripe API Keys (use TEST keys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Stripe Webhook Secret (obtained from Stripe CLI - see step 3)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Stripe Price IDs (create these in your Stripe Dashboard)
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx

# App URL (for redirect URLs)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 2. Create Stripe Products & Prices

In your [Stripe Test Dashboard](https://dashboard.stripe.com/test/products):

1. **Create Products** for each tier:
   - PRO ($10/month)
   - BUSINESS ($25/month)
   - ENTERPRISE ($99/month)

2. **Create Recurring Prices** for each product (monthly billing)

3. **Copy the Price IDs** (starts with `price_`) to your `.env.local`

## 3. Set Up Stripe CLI for Local Webhooks

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (scoop)
scoop install stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

### Login to Stripe

```bash
stripe login
```

### Forward Webhooks to Local Server

In a **separate terminal**, run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will output a webhook signing secret like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Copy this secret** to your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

> **Important:** Keep this terminal running while testing. The webhook secret changes each time you restart `stripe listen`.

## 4. Database Setup

Ensure your database has the required tables:

- `app.team_subscriptions` - Stores subscription state
- `app.team_credit_transactions` - Credit transaction log
- `app.team_credit_balances` - Current credit balances
- `app.stripe_events` - Webhook idempotency tracking
- `app.subscription_plans` - Plan definitions (credits, features)

### Required: subscription_plans Data

Insert the plan definitions:

```sql
INSERT INTO app.subscription_plans (tier, monthly_credits, insights_enabled, competitive_enabled) VALUES
  ('FREE', 5, false, false),
  ('PRO', 25, true, false),
  ('BUSINESS', 50, true, true),
  ('ENTERPRISE', 1000, true, true);
```

### Required: Database Trigger

Ensure this trigger exists for automatic balance updates:

```sql
-- The trigger should update team_credit_balances when team_credit_transactions is inserted
-- Check with: SELECT * FROM information_schema.triggers WHERE event_object_table = 'team_credit_transactions';
```

## 5. Start the Development Server

```bash
npm run dev
```

## 6. Testing Scenarios

### Test 1: New Subscription (FREE → PRO)

1. Create a new team (starts with FREE tier, 5 credits)
2. Navigate to `/teams/{teamId}/billing`
3. Click "Upgrade" on PRO plan
4. Complete Stripe Checkout using test card: `4242 4242 4242 4242`
5. **Expected:**
   - Redirected to success page
   - Team now has PRO tier
   - Credits: 5 (free) + 25 (PRO) = **30 credits**
   - Webhook logs show `checkout.session.completed`

### Test 2: Upgrade (PRO → BUSINESS)

1. With a PRO subscription, click "Upgrade" on BUSINESS
2. Confirm the prorated charge
3. **Expected:**
   - Subscription updated immediately
   - Credits: existing + 50 (BUSINESS) = **80 credits** (or whatever the sum is)
   - Webhook logs show `invoice.payment_succeeded` with `billing_reason: subscription_update`

### Test 3: Downgrade (BUSINESS → PRO)

1. With a BUSINESS subscription, click "Downgrade" on PRO
2. Confirm the scheduled change
3. **Expected:**
   - Message: "Your plan will change to PRO on {end_of_period_date}"
   - Subscription remains BUSINESS until period end
   - No immediate credit change
   - Stripe Dashboard shows a subscription schedule

### Test 4: Cancel Subscription

1. Click "Cancel Plan" on an active subscription
2. Confirm cancellation
3. **Expected:**
   - Status changes to "canceling"
   - Message shows when access ends
   - At period end: resets to FREE tier with 5 credits

### Test 5: Reactivate Canceled Subscription

1. With a "canceling" subscription, click "Keep Plan"
2. **Expected:**
   - Cancellation is reversed
   - Status returns to "active"

## 7. Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

## 8. Debugging

### View Webhook Events

In the Stripe CLI terminal, you'll see events like:
```
2026-02-01 10:30:00   --> checkout.session.completed [evt_xxx]
2026-02-01 10:30:01   --> customer.subscription.created [evt_xxx]
2026-02-01 10:30:01   --> invoice.payment_succeeded [evt_xxx]
```

### Check Server Logs

Look for `[Stripe Webhook]` and `[Credits]` prefixed logs:
```
[Stripe Webhook] Processing event: checkout.session.completed (evt_xxx)
[Stripe Webhook] Checkout completed - teamId: xxx, tier: PRO
[Credits] Granting 50 credits for period xxx to xxx
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Missing signature" error | Ensure `stripe listen` is running and `STRIPE_WEBHOOK_SECRET` matches |
| Credits not updating | Check if `trg_credit_tx_apply_balance` trigger exists |
| NULL period dates | Webhook race condition - timestamps should now be preserved |
| Double credits | Fixed - trigger handles balance, code no longer manually updates |

### Useful Stripe CLI Commands

```bash
# Trigger a specific event
stripe trigger checkout.session.completed

# View recent events
stripe events list --limit 10

# Resend a webhook event
stripe events resend evt_xxxxxxxxxxxxx
```

## 9. Key Files

| File | Purpose |
|------|---------|
| `lib/stripe/webhook.ts` | Webhook event handlers |
| `lib/stripe/checkout.ts` | Checkout session creation, upgrade/downgrade logic |
| `lib/billing/credits.ts` | Credit granting with idempotency |
| `app/api/stripe/webhook/route.ts` | Webhook endpoint |
| `app/api/teams/[teamId]/billing/` | Billing API routes |
| `app/teams/[teamId]/billing/page.tsx` | Billing UI |

## 10. Webhook Events Handled

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutCompleted` | Sync subscription, grant initial credits |
| `customer.subscription.created` | `handleSubscriptionUpdated` | Sync subscription state |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Sync subscription state |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Reset to FREE, set 5 credits |
| `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded` | Grant credits on renewal/upgrade |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Set status to `past_due` |
