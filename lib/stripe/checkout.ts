import Stripe from 'stripe'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

/**
 * Creates a Stripe checkout session for subscription.
 */
export async function createCheckoutSession(
  teamId: string,
  tier: 'PRO' | 'BUSINESS' | 'ENTERPRISE',
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const serviceClient = createSupabaseServiceRoleClient()

  // Get or create Stripe customer
  const { data: subscription } = await serviceClient
    .from('app.team_subscriptions')
    .select('stripe_customer_id')
    .eq('team_id', teamId)
    .single()

  let customerId = subscription?.stripe_customer_id

  if (!customerId) {
    // Get team and user info
    const { data: team } = await serviceClient.from('app.teams').select('name').eq('id', teamId).single()
    const { data: user } = await serviceClient.from('app.users').select('email').eq('id', userId).single()

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: {
        team_id: teamId,
        user_id: userId,
      },
    })

    customerId = customer.id

    // Update team subscription with customer ID
    await serviceClient
      .from('app.team_subscriptions')
      .upsert({
        team_id: teamId,
        stripe_customer_id: customerId,
      })
  }

  // Get price ID for tier (you'll need to configure these in Stripe)
  let priceId: string
  if (tier === 'PRO') {
    priceId = process.env.STRIPE_PRO_PRICE_ID!
  } else if (tier === 'BUSINESS') {
    priceId = process.env.STRIPE_BUSINESS_PRICE_ID!
  } else {
    priceId = process.env.STRIPE_ENTERPRISE_PRICE_ID!
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      team_id: teamId,
      tier,
      user_id: userId,
    },
  })

  return session.url || ''
}

/**
 * Creates a Stripe checkout session for credit top-up.
 */
export async function createTopupCheckoutSession(
  teamId: string,
  stripePriceId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const serviceClient = createSupabaseServiceRoleClient()

  // Get or create Stripe customer
  const { data: subscription } = await serviceClient
    .from('app.team_subscriptions')
    .select('stripe_customer_id')
    .eq('team_id', teamId)
    .single()

  let customerId = subscription?.stripe_customer_id

  if (!customerId) {
    const { data: user } = await serviceClient.from('app.users').select('email').eq('id', userId).single()

    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: {
        team_id: teamId,
        user_id: userId,
      },
    })

    customerId = customer.id

    await serviceClient
      .from('app.team_subscriptions')
      .upsert({
        team_id: teamId,
        stripe_customer_id: customerId,
      })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      team_id: teamId,
      type: 'topup',
      user_id: userId,
    },
  })

  return session.url || ''
}

/**
 * Creates a Stripe customer portal session.
 */
export async function createPortalSession(teamId: string, returnUrl: string): Promise<string> {
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: subscription } = await serviceClient
    .from('app.team_subscriptions')
    .select('stripe_customer_id')
    .eq('team_id', teamId)
    .single()

  if (!subscription?.stripe_customer_id) {
    throw new Error('No Stripe customer found')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: returnUrl,
  })

  return session.url
}

