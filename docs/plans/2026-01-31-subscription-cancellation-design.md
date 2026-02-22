# Subscription Cancellation Feature Design

**Date:** 2026-01-31
**Status:** Approved for Implementation

## Overview

Allow users to cancel their paid subscription, keeping access until the end of their billing period, then automatically downgrading to FREE tier with 5 credits.

## Requirements

1. Cancel button on billing page
2. Confirmation popup explaining they keep access until period end
3. Banner notification on billing page if subscription is set to cancel
4. Cancel at end of billing period (not immediate)
5. Reset credits to 5 when subscription actually ends

## User Flow

### Cancellation Flow

1. User clicks "Cancel Plan" button on billing page
2. Confirmation dialog appears:
   - "Your [BUSINESS] plan will remain active until [Feb 28, 2026]"
   - "You'll keep all features and credits until then"
   - "After that, you'll be on the FREE plan with 5 credits"
   - "Keep Plan" vs "Cancel Plan" buttons
3. On confirm, call `/api/teams/[teamId]/billing/cancel`
4. Backend cancels Stripe subscription with `cancel_at_period_end: true`
5. Stripe sends `customer.subscription.updated` webhook
6. Webhook updates `team_subscriptions.status` to `'canceling'`
7. Yellow banner appears on billing page: "Your plan will end on [date]"

### When Period Ends

1. Stripe sends `customer.subscription.deleted` webhook
2. Webhook handler sets tier to FREE, monthly_credits to 0
3. Webhook handler hard resets credit balance to 5
4. User is now on FREE tier with 5 credits

### Optional: Reactivation

1. User clicks "Reactivate Plan" in banner
2. Call `/api/teams/[teamId]/billing/reactivate`
3. Backend updates Stripe: `cancel_at_period_end: false`
4. Stripe sends `customer.subscription.updated` webhook
5. Webhook updates status back to `'active'`
6. Banner disappears

## Technical Implementation

### Frontend Changes

**File:** `app/teams/[teamId]/billing/page.tsx`

**1. Cancel Button**
- Add below "Manage Billing" button
- Show only if `status === 'active' && tier !== 'FREE'`
- Red/destructive styling
- Opens confirmation dialog

**2. Cancellation Banner**
- Show at top of page content if `status === 'canceling'`
- Yellow background with border
- Text: "Your {tier} plan will end on {formatDate(current_period_end)}. You'll have full access until then."
- Optional "Reactivate Plan" button

**3. Confirmation Dialog**
- Use browser `confirm()` or custom modal
- Shows current tier, end date, what happens after
- "Keep Plan" vs "Cancel Plan" buttons

**4. API Handlers**
```typescript
const handleCancelPlan = async () => {
  const confirmed = confirm(`Your ${currentTier} plan will remain active...`)
  if (confirmed) {
    await apiPost(`/api/teams/${teamId}/billing/cancel`, {})
    await loadBilling() // Refresh to show banner
  }
}

const handleReactivate = async () => {
  await apiPost(`/api/teams/${teamId}/billing/reactivate`, {})
  await loadBilling()
}
```

### Backend Changes

**1. Cancel Endpoint**

**File:** `app/api/teams/[teamId]/billing/cancel/route.ts` (NEW)

```typescript
export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  await requireTeamAdmin(params.teamId)
  const serviceClient = createSupabaseServiceRoleClient()

  // Get subscription
  const { data: subscription } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('stripe_subscription_id')
    .eq('team_id', params.teamId)
    .single()

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  // Cancel at period end
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  return NextResponse.json({ success: true })
}
```

**2. Reactivate Endpoint**

**File:** `app/api/teams/[teamId]/billing/reactivate/route.ts` (NEW)

```typescript
export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  await requireTeamAdmin(params.teamId)
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: subscription } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('stripe_subscription_id')
    .eq('team_id', params.teamId)
    .single()

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription to reactivate' }, { status: 400 })
  }

  // Undo cancellation
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  })

  return NextResponse.json({ success: true })
}
```

**3. Webhook Updates**

**File:** `lib/stripe/webhook.ts`

**Update `handleSubscriptionUpdated`:**
```typescript
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // ... existing code to find team ...

  // Check if subscription is set to cancel
  const status = subscription.cancel_at_period_end
    ? 'canceling'
    : (subscription.status === 'active' || subscription.status === 'trialing')
      ? 'active'
      : 'past_due'

  await updateTeamSubscription(teamSub.team_id, subscription)

  // Update status separately to handle 'canceling' state
  await serviceClient
    .schema('app').from('team_subscriptions')
    .update({ status })
    .eq('team_id', teamSub.team_id)
}
```

**Update `handleSubscriptionDeleted`:**
```typescript
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: teamSub } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    // Set to FREE tier
    await serviceClient
      .schema('app').from('team_subscriptions')
      .update({
        tier: 'FREE',
        status: 'canceled',
        stripe_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        monthly_credits: 0,
        insights_enabled: false,
        competitive_enabled: false,
      })
      .eq('team_id', teamSub.team_id)

    // Hard reset credits to 5
    await serviceClient
      .schema('app').from('team_credit_transactions')
      .insert({
        team_id: teamSub.team_id,
        event_type: 'adjustment',
        amount: 5,
        reason: 'Subscription canceled - reset to FREE tier credits',
        actor_user_id: null,
      })

    await serviceClient
      .schema('app').from('team_credit_balances')
      .upsert({
        team_id: teamSub.team_id,
        balance: 5,
        period_start: null,
        period_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
  }
}
```

### Database Changes

**None required** - the `status` field in `team_subscriptions` already accepts strings, so 'canceling' works without migration.

Valid status values:
- `'active'` - Normal paid subscription
- `'canceling'` - Subscription set to cancel at period end
- `'canceled'` - Subscription ended
- `'past_due'` - Payment failed

## API Response Updates

**GET /api/teams/[teamId]/billing** should return:

```typescript
{
  subscription: {
    tier: 'BUSINESS',
    status: 'canceling',  // NEW status
    current_period_end: '2026-02-28T18:46:00.000Z',
    // ... other fields
  },
  creditBalance: 42,
  topupProducts: [...]
}
```

Frontend uses `status === 'canceling'` to show the banner.

## Edge Cases

1. **User cancels then immediately reactivates** - Works, Stripe handles this
2. **Webhook arrives before API response** - Fine, frontend refetches after action
3. **User has credits when subscription ends** - Credits are hard reset to 5 (ignore existing balance)
4. **FREE tier user clicks cancel** - Button not shown (tier !== 'FREE' check)
5. **Multiple webhooks for same cancellation** - Idempotency in webhook handler prevents issues

## Testing Checklist

- [ ] Cancel button appears for paid tiers
- [ ] Cancel button hidden for FREE tier
- [ ] Confirmation dialog shows correct tier and end date
- [ ] Canceling sets status to 'canceling'
- [ ] Banner appears with correct end date
- [ ] Reactivate button works
- [ ] Subscription ends at period end (via webhook)
- [ ] Credits reset to exactly 5 when ended
- [ ] Tier changes to FREE when ended
- [ ] Status changes to 'canceled' when ended

## Rollout Plan

1. Deploy backend changes (API endpoints + webhook updates)
2. Test in Stripe test mode
3. Deploy frontend changes
4. Monitor webhook logs for any issues
5. Announce feature to users

## Success Metrics

- Cancellation rate
- Reactivation rate (how many users undo cancellation)
- Support tickets related to cancellation
- Credits reset correctly (no users stuck without credits)
