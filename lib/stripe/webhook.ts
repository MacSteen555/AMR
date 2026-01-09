import Stripe from 'stripe'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { grantMonthlyCredits } from '@/lib/billing/credits'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * Handles Stripe webhook events with idempotency.
 */
export async function handleStripeWebhook(
  payload: string | Buffer,
  signature: string
): Promise<void> {
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  const serviceClient = createSupabaseServiceRoleClient()

  // Check idempotency
  const { data: existing } = await serviceClient
    .from('app.stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existing) {
    return // Already processed
  }

  // Record event
  await serviceClient.from('app.stripe_events').insert({
    event_id: event.id,
    payload: event,
  })

  // Handle event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const serviceClient = createSupabaseServiceRoleClient()
  const teamId = session.metadata?.team_id

  if (!teamId) {
    return
  }

  if (session.mode === 'subscription') {
    // Subscription checkout
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    await updateTeamSubscription(teamId, subscription)
  } else if (session.mode === 'payment' && session.metadata?.type === 'topup') {
    // Top-up checkout
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const priceId = lineItems.data[0]?.price?.id

    if (priceId) {
      const { data: product } = await serviceClient
        .from('app.credit_topup_products')
        .select('credits')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single()

      if (product) {
        await serviceClient.from('app.team_credit_transactions').insert({
          team_id: teamId,
          event_type: 'topup',
          amount: product.credits,
          reason: 'Credit top-up purchase',
          actor_user_id: session.metadata.user_id || null,
        })
      }
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: teamSub } = await serviceClient
    .from('app.team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    await updateTeamSubscription(teamSub.team_id, subscription)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: teamSub } = await serviceClient
    .from('app.team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    await serviceClient
      .from('app.team_subscriptions')
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
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: teamSub } = await serviceClient
    .from('app.team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub && invoice.subscription) {
    // Grant monthly credits
    await grantMonthlyCredits(teamSub.team_id)
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: teamSub } = await serviceClient
    .from('app.team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    await serviceClient
      .from('app.team_subscriptions')
      .update({
        status: 'past_due',
      })
      .eq('team_id', teamSub.team_id)
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Handle one-time payments if needed
  // This might be used for top-ups depending on your integration
}

async function updateTeamSubscription(teamId: string, subscription: Stripe.Subscription) {
  const serviceClient = createSupabaseServiceRoleClient()

  // Determine tier from price ID
  const priceId = subscription.items.data[0]?.price.id
  const isPro = priceId === process.env.STRIPE_PRO_PRICE_ID
  const isBusiness = priceId === process.env.STRIPE_BUSINESS_PRICE_ID
  const isEnterprise = priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID

  // Determine tier string
  let tierString: string
  if (isEnterprise) {
    tierString = 'ENTERPRISE'
  } else if (isBusiness) {
    tierString = 'BUSINESS'
  } else if (isPro) {
    tierString = 'PRO'
  } else {
    tierString = 'FREE'
  }

  // Get plan details
  const { data: plan } = await serviceClient
    .from('app.subscription_plans')
    .select('*')
    .eq('tier', tierString)
    .single()

  await serviceClient
    .from('app.team_subscriptions')
    .upsert({
      team_id: teamId,
      tier: tierString as any,
      status: subscription.status === 'active' ? 'active' : ('past_due' as any),
      stripe_subscription_id: subscription.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      monthly_credits: plan?.monthly_credits || 0,
      insights_enabled: plan?.insights_enabled || false,
      competitive_enabled: plan?.competitive_enabled || false,
    })
}

