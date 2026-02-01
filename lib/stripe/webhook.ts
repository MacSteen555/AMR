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

  console.log(`[Stripe Webhook] Processing event: ${event.type} (${event.id})`)

  // Check idempotency
  const { data: existing, error: checkError } = await serviceClient
    .schema('app').from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = not found, which is expected for new events
    console.error(`[Stripe Webhook] Error checking idempotency:`, checkError)
  }

  if (existing) {
    console.log(`[Stripe Webhook] Event already processed: ${event.id}`)
    return
  }

  // Record event for idempotency
  const { error: insertError } = await serviceClient.schema('app').from('stripe_events').insert({
    event_id: event.id,
    payload: event,
  })

  if (insertError) {
    if (insertError.code === '23505') { // Unique violation
      console.log(`[Stripe Webhook] Event inserted by another process (race condition caught): ${event.id}`)
      return
    }
    console.error(`[Stripe Webhook] Error recording event:`, insertError)
    // For other errors, we might want to continue or throw. 
    // If we can't record it, we run the risk of processing it twice later if we crash. 
    // But failing here might be safer to ensure we at least try to process?
    // Current logic was to continue. I'll leave it for non-duplicate errors.
  }

  // Handle event
  try {
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

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error)
    throw error // Re-throw so webhook returns error status
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const serviceClient = createSupabaseServiceRoleClient()
  const teamId = session.metadata?.team_id
  const tier = session.metadata?.tier

  console.log(`[Stripe Webhook] Checkout completed - teamId: ${teamId}, tier: ${tier}, mode: ${session.mode}`)

  if (!teamId) {
    console.error(`[Stripe Webhook] No team_id in checkout session metadata`)
    return
  }

  if (session.mode === 'subscription') {
    // Subscription checkout - this is the PRIMARY handler for new subscriptions
    const subscriptionId = session.subscription as string
    const customerId = session.customer as string

    console.log(`[Stripe Webhook] Subscription checkout - subscriptionId: ${subscriptionId}, customerId: ${customerId}`)

    // First, store the customer ID so subsequent events can find the team
    const { error: customerUpdateError } = await serviceClient
      .schema('app').from('team_subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('team_id', teamId)

    if (customerUpdateError) {
      console.error(`[Stripe Webhook] Error updating customer ID:`, customerUpdateError)
    }

    // Now retrieve and process the subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await updateTeamSubscription(teamId, subscription)

    // Grant initial monthly credits for new subscriptions
    console.log(`[Stripe Webhook] Granting initial credits for new subscription`)
    try {
      await grantMonthlyCredits(teamId)
      console.log(`[Stripe Webhook] Initial credits granted successfully`)
    } catch (error) {
      console.error(`[Stripe Webhook] Error granting initial credits:`, error)
      throw error
    }

  } else if (session.mode === 'payment' && session.metadata?.type === 'topup') {
    // Top-up checkout
    console.log(`[Stripe Webhook] Top-up checkout`)
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const priceId = lineItems.data[0]?.price?.id

    if (priceId) {
      const { data: product, error: productError } = await serviceClient
        .schema('app').from('credit_topup_products')
        .select('credits')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single()

      if (productError) {
        console.error(`[Stripe Webhook] Error finding topup product:`, productError)
        return
      }

      if (product) {
        const { error: txError } = await serviceClient.schema('app').from('team_credit_transactions').insert({
          team_id: teamId,
          event_type: 'topup',
          amount: product.credits,
          reason: 'Credit top-up purchase',
          actor_user_id: session.metadata.user_id || null,
        })

        if (txError) {
          console.error(`[Stripe Webhook] Error inserting credit transaction:`, txError)
        } else {
          console.log(`[Stripe Webhook] Added ${product.credits} credits for topup`)
        }
      }
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  console.log(`[Stripe Webhook] Subscription updated - customerId: ${customerId}, status: ${subscription.status}`)

  const { data: teamSub, error } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error) {
    console.log(`[Stripe Webhook] Could not find team by customer ID ${customerId} - may not be linked yet`)
    return
  }

  if (teamSub) {
    console.log(`[Stripe Webhook] Updating subscription for team: ${teamSub.team_id}`)
    await updateTeamSubscription(teamSub.team_id, subscription)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  console.log(`[Stripe Webhook] Subscription deleted - customerId: ${customerId}`)

  const { data: teamSub } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    console.log(`[Stripe Webhook] Canceling subscription for team: ${teamSub.team_id}`)
    
    // 1. Reset subscription to FREE
    const { error } = await serviceClient
      .schema('app').from('team_subscriptions')
      .update({
        tier: 'FREE',
        status: 'canceled',
        stripe_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        monthly_credits: 5, // Free tier allowance
        insights_enabled: false,
        competitive_enabled: false,
      })
      .eq('team_id', teamSub.team_id)

    if (error) {
      console.error(`[Stripe Webhook] Error canceling subscription:`, error)
    }

    // 2. Hard reset credits to 5 (Design Requirement)
    
    // Insert adjustment record
    await serviceClient
      .schema('app').from('team_credit_transactions')
      .insert({
        team_id: teamSub.team_id,
        event_type: 'adjustment',
        amount: 5,
        reason: 'Subscription canceled - reset to FREE tier credits',
        actor_user_id: null,
      })

    // Force balance update
    await serviceClient
      .schema('app').from('team_credit_balances')
      .upsert({
        team_id: teamSub.team_id,
        balance: 5,
        period_start: null,
        period_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
      
     console.log(`[Stripe Webhook] Reset team ${teamSub.team_id} to FREE tier with 5 credits`)
  }
}

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  console.log(`[Stripe Webhook] Invoice payment succeeded - customerId: ${customerId}, subscription: ${invoice.subscription}, billing_reason: ${invoice.billing_reason}`)

  const { data: teamSub } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('team_id, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!teamSub) {
    console.log(`[Stripe Webhook] No team found for customer ${customerId}`)
    return
  }

  // FIX: Handle case where invoice.subscription is undefined (proration invoices)
  // If invoice has a subscription, use it; otherwise use the team's current subscription
  const subscriptionId = invoice.subscription
    ? (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id)
    : teamSub.stripe_subscription_id

  if (subscriptionId) {
    console.log(`[Stripe Webhook] Syncing subscription ${subscriptionId} before granting credits...`)

    // 1. Force update subscription from Stripe to ensure DB has latest plan
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      await updateTeamSubscription(teamSub.team_id, subscription)
      console.log(`[Stripe Webhook] Subscription synced successfully`)
    } catch (err) {
      console.error(`[Stripe Webhook] Error syncing subscription during invoice payment:`, err)
      // Throw to ensure we retry webhook if sync fails, rather than granting wrong credits
      throw err
    }

    // 2. Grant credits on regular billing cycles AND subscription updates (upgrades/downgrades)
    // Skip ONLY subscription_create to prevent duplicate grants during initial subscription setup
    // (initial credits are granted via checkout.session.completed)
    if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update') {
      const isUpgrade = invoice.billing_reason === 'subscription_update'
      console.log(`[Stripe Webhook] Billing event detected (${invoice.billing_reason}) - granting monthly credits for team: ${teamSub.team_id}`)
      try {
        await grantMonthlyCredits(teamSub.team_id, isUpgrade)
        console.log(`[Stripe Webhook] Credits granted successfully`)
      } catch (error) {
        console.error(`[Stripe Webhook] Error granting credits:`, error)
        throw error
      }
    } else {
      console.log(`[Stripe Webhook] Skipping credit grant for billing_reason: ${invoice.billing_reason} (only grant on subscription_cycle or subscription_update)`)
    }
  } else {
    console.log(`[Stripe Webhook] No subscription ID found for invoice payment`)
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const serviceClient = createSupabaseServiceRoleClient()

  console.log(`[Stripe Webhook] Invoice payment failed - customerId: ${customerId}`)

  const { data: teamSub } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('team_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (teamSub) {
    const { error } = await serviceClient
      .schema('app').from('team_subscriptions')
      .update({
        status: 'past_due',
      })
      .eq('team_id', teamSub.team_id)

    if (error) {
      console.error(`[Stripe Webhook] Error updating to past_due:`, error)
    }
  }
}

async function updateTeamSubscription(teamId: string, subscription: Stripe.Subscription) {
  const serviceClient = createSupabaseServiceRoleClient()

  // Determine tier from price ID
  const priceId = subscription.items.data[0]?.price.id
  console.log(`[Stripe Webhook] updateTeamSubscription - teamId: ${teamId}, priceId: ${priceId}`)

  const isPro = priceId === process.env.STRIPE_PRO_PRICE_ID
  const isBusiness = priceId === process.env.STRIPE_BUSINESS_PRICE_ID
  const isEnterprise = priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID

  console.log(`[Stripe Webhook] Price check - PRO: ${isPro}, BUSINESS: ${isBusiness}, ENTERPRISE: ${isEnterprise}`)
  console.log(`[Stripe Webhook] Env prices - PRO: ${process.env.STRIPE_PRO_PRICE_ID}, BUSINESS: ${process.env.STRIPE_BUSINESS_PRICE_ID}, ENTERPRISE: ${process.env.STRIPE_ENTERPRISE_PRICE_ID}`)

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
    console.warn(`[Stripe Webhook] Unknown price ID: ${priceId}, defaulting to FREE`)
  }

  console.log(`[Stripe Webhook] Determined tier: ${tierString}`)

  // Get plan details from subscription_plans table
  const { data: plan, error: planError } = await serviceClient
    .schema('app').from('subscription_plans')
    .select('*')
    .eq('tier', tierString)
    .single()

  if (planError) {
    console.error(`[Stripe Webhook] Error fetching plan for tier ${tierString}:`, planError)
  }

  console.log(`[Stripe Webhook] Plan details:`, plan)

  // Safe date conversion helper
  const toISO = (timestamp: number | null | undefined) => {
    if (!timestamp) return null
    try {
      return new Date(timestamp * 1000).toISOString()
    } catch (e) {
      console.error(`[Stripe Webhook] Invalid timestamp: ${timestamp}`, e)
      return null
    }
  }

  const updateData = {
    team_id: teamId,
    tier: tierString,
    status: subscription.cancel_at_period_end 
      ? 'canceling' 
      : (subscription.status === 'active' || subscription.status === 'trialing') 
        ? 'active' 
        : 'past_due',
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    current_period_start: toISO(subscription.current_period_start),
    current_period_end: toISO(subscription.current_period_end),
    monthly_credits: plan?.monthly_credits || 0,
    insights_enabled: plan?.insights_enabled || false,
    competitive_enabled: plan?.competitive_enabled || false,
  }

  console.log(`[Stripe Webhook] Raw timestamps - start: ${subscription.current_period_start}, end: ${subscription.current_period_end}`)
  console.log(`[Stripe Webhook] Upserting team_subscriptions:`, updateData)

  const { error: upsertError } = await serviceClient
    .schema('app').from('team_subscriptions')
    .upsert(updateData, { onConflict: 'team_id' })

  if (upsertError) {
    console.error(`[Stripe Webhook] Error upserting subscription:`, upsertError)
    throw upsertError
  }

  console.log(`[Stripe Webhook] Successfully updated subscription for team ${teamId} to tier ${tierString}`)
}
