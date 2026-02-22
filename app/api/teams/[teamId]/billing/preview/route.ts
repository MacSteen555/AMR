
import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { createCheckoutSchema } from '@/lib/validation/schemas'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)
    // Validate user session
    await requireUser()

    const body = await request.json()
    const { tier } = createCheckoutSchema.parse(body)

    const serviceClient = createSupabaseServiceRoleClient()
    
    // Get current subscription
    const { data: subscription } = await serviceClient
      .schema('app').from('team_subscriptions')
      .select('stripe_subscription_id, tier, current_period_end')
      .eq('team_id', params.teamId)
      .single()

    if (!subscription) {
      return NextResponse.json({ error: 'No subscription record found' }, { status: 400 })
    }

    // FREE tier users (no Stripe subscription) should go directly to checkout
    if (!subscription.stripe_subscription_id || subscription.tier === 'FREE') {
      return NextResponse.json({
        type: 'new_subscription',
        amount_due_today: null, // Will be calculated at checkout
        message: `Click confirm to proceed to checkout for the ${tier} plan.`,
        effective_date: new Date().toISOString(),
        requires_checkout: true
      })
    }

    // Determine New Price ID
    let newPriceId: string
    if (tier === 'PRO') newPriceId = process.env.STRIPE_PRO_PRICE_ID!
    else if (tier === 'BUSINESS') newPriceId = process.env.STRIPE_BUSINESS_PRICE_ID!
    else newPriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID!

    // Determine Current Price ID (approximate via Tier logic)
    // We don't strictly need currentPriceId for the logic below, we rely on checking downgrade status via Tiers
    
    // Check Upgrade vs Downgrade
    const TIER_ORDER = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']
    const oldIndex = TIER_ORDER.indexOf(subscription.tier)
    const newIndex = TIER_ORDER.indexOf(tier)

    const isDowngrade = newIndex < oldIndex

    if (isDowngrade) {
      // Downgrade: Scheduled for end of period
      return NextResponse.json({
        type: 'downgrade',
        effective_date: subscription.current_period_end,
        amount_due_today: 0,
        message: `Your plan will change to ${tier} on ${new Date(subscription.current_period_end!).toLocaleDateString()}. You will not be charged today.`
      })
    } else {
      // Upgrade: Immediate with proration
      // Calculate proration
      try {
        const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
        const items = [{
          id: sub.items.data[0].id,
          price: newPriceId,
        }]

        // Using any cast to bypass type mismatch if SDK definitions are old, 
        // ensuring we send the correct params for the Stripe API
        const params: any = {
          customer: sub.customer as string,
          subscription: sub.id,
          subscription_items: items,
          subscription_proration_behavior: 'always_invoice',
        }

        const previewInvoice = await stripe.invoices.retrieveUpcoming(params)

        return NextResponse.json({
          type: 'upgrade',
          amount_due_today: previewInvoice.amount_due / 100, // Convert to dollars
          currency: previewInvoice.currency,
          message: `Pay $${previewInvoice.amount_due / 100} today to upgrade immediately.`,
          effective_date: new Date().toISOString()
        })
      } catch (err: any) {
        console.error('Error calculating proration:', err)
        return NextResponse.json({ error: 'Could not calculate proration' }, { status: 500 })
      }
    }

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
