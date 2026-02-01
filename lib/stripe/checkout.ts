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

  console.log(`[Checkout] Creating session for team ${teamId} -> ${tier}`)

  // 1. Determine price ID
  let priceId: string
  if (tier === 'PRO') {
    priceId = process.env.STRIPE_PRO_PRICE_ID!
  } else if (tier === 'BUSINESS') {
    priceId = process.env.STRIPE_BUSINESS_PRICE_ID!
  } else {
    priceId = process.env.STRIPE_ENTERPRISE_PRICE_ID!
  }

  // 2. Get current subscription/customer info
  const { data: subscription } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('team_id', teamId)
    .single()

  let customerId = subscription?.stripe_customer_id

  // 3. CHECK FOR EXISTING ACTIVE SUBSCRIPTION TO UPDATE
  // If user already has an active subscription, we just update it instead of creating a new checkout
  if (subscription?.stripe_subscription_id && (subscription.status === 'active' || subscription.status === 'trialing')) {
    try {
      console.log(`[Checkout] Found active subscription ${subscription.stripe_subscription_id}, checking for update...`)
      
      const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
      
      if (sub.status === 'active' || sub.status === 'trialing') {
        const item = sub.items.data[0]
        const currentPriceId = item.price.id
        
        if (currentPriceId === priceId) {
          console.log(`[Checkout] Already on this plan, no update needed`)
          return successUrl // Already on this plan
        }

        // Determine if Upgrade or Downgrade
        // We fetch prices to compare amounts to be sure, or use tier logic from caller?
        // Let's trust the Price IDs environment check we did above.
        // But to be safe, let's compare amounts from the retrieved prices.
        const newPriceObj = await stripe.prices.retrieve(priceId)
        
        const currentAmount = item.price.unit_amount || 0
        const newAmount = newPriceObj.unit_amount || 0
        const isDowngrade = newAmount < currentAmount

        if (isDowngrade) {
           console.log(`[Checkout] Downgrade detected (${currentAmount} -> ${newAmount}). Scheduling for end of period.`)
           
           // Check if there is already a schedule
           if (sub.schedule) {
             // If existing schedule, we might need to release it or update it?
             // Simplest is to release current schedule and create new one, or update phases.
             // For now, let's just create a schedule from the subscription.
             // Note: If sub.schedule exists, we should update that schedule.
             const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id
             
             await stripe.subscriptionSchedules.update(scheduleId, {
                end_behavior: 'release', // Release subscription at end of schedule? No, we want to change phases.
                phases: [
                  {
                    items: [{ price: currentPriceId, quantity: 1 }],
                    start_date: 'now',
                    end_date: sub.current_period_end, // Finish current period
                  },
                  {
                    items: [{ price: priceId, quantity: 1 }], // Switch to new plan
                    iterations: 1, // Or undefined for infinite? undefined usually implies standard recurring
                  }
                ]
             })
           } else {
             // Create a schedule from the subscription
             await stripe.subscriptionSchedules.create({
               from_subscription: sub.id,
             })
             
             // The schedule is created with one phase (current). We need to update it to add the next phase?
             // Actually, when creating from subscription, it preserves current phase.
             // We can update it immediately after to append the new phase.
             // OR: We can just update the subscription with `proration_behavior: 'none'`?
             // No, `proration_behavior: 'none'` just means "don't create pending invoice items", but it changes the plan IMMEDIATELY.
             // We want "end of period" change.
             // So we must use Update Subscription with `cancel_at_period_end`? No, that cancels.
             // The canonical way is Subscription Schedule.
             
             // Update the newly created schedule
             // Retrieve it first? `create` returns it.
             // Actually, easier: Update Subscription directly with `cancel_at_period_end: false` (just in case)
             // AND `items`... wait. Stripe's `update` doesn't support "at_period_end" for items directly without schedule.
             
             // Let's retry the Schedule logic.
             // 1. Create schedule from sub
             const schedule = await stripe.subscriptionSchedules.create({
               from_subscription: sub.id,
             })
             
             // 2. Update schedule to set the NEXT phase
             await stripe.subscriptionSchedules.update(schedule.id, {
               phases: [
                 {
                   items: [{ price: currentPriceId, quantity: 1 }],
                   start_date: schedule.current_phase?.start_date,
                   end_date: sub.current_period_end,
                 },
                 {
                   items: [{ price: priceId, quantity: 1 }],
                   // No end_date implies infinite (standard subscription behavior)
                 }
               ]
             })
           }

           console.log(`[Checkout] Successfully scheduled downgrade to ${tier} at ${sub.current_period_end}`)
           return successUrl

        } else {
          // Upgrade: Immediate
           console.log(`[Checkout] Upgrade detected (${currentAmount} -> ${newAmount}). Invoicing immediately.`)
           await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [{
              id: item.id,
              price: priceId,
            }],
            proration_behavior: 'always_invoice', // Charge immediately for upgrades
          })
          console.log(`[Checkout] Successfully updated subscription to ${tier}`)
          return successUrl // Return success URL directly (frontend will redirect)
        }
      }
    } catch (error) {
      console.error(`[Checkout] Error updating existing subscription:`, error)
      // Fall through to create new session if update fails
    }
  }

  // 4. Create New Customer if needed
  if (!customerId) {
    console.log(`[Checkout] No customer ID found, creating new customer...`)
    const { data: team } = await serviceClient.schema('app').from('teams').select('name').eq('id', teamId).single()
    const { data: user } = await serviceClient.schema('app').from('users').select('email').eq('id', userId).single()

    const customer = await stripe.customers.create({
      email: user?.email,
      name: team?.name || 'Team Subscription',
      metadata: {
        team_id: teamId,
      },
    })
    customerId = customer.id

    // Save customer ID immediately
    await serviceClient
      .schema('app').from('team_subscriptions')
      .upsert({
        team_id: teamId,
        stripe_customer_id: customerId,
      }, { onConflict: 'team_id' })
  }

  // 5. Create Checkout Session (for new subscriptions or re-subscribing)
  console.log(`[Checkout] Creating new Stripe Checkout session for customer ${customerId}`)
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId, // CRITICAL: Reuse existing customer ID to avoid duplicates
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
    allow_promotion_codes: true,
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
    .schema('app').from('team_subscriptions')
    .select('stripe_customer_id')
    .eq('team_id', teamId)
    .single()

  let customerId = subscription?.stripe_customer_id

  if (!customerId) {
    const { data: user } = await serviceClient.schema('app').from('users').select('email').eq('id', userId).single()

    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: {
        team_id: teamId,
        user_id: userId,
      },
    })

    customerId = customer.id

    await serviceClient
      .schema('app').from('team_subscriptions')
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
    .schema('app').from('team_subscriptions')
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

