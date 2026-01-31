import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)
    const serviceClient = createSupabaseServiceRoleClient()

    // Get subscription
    const { data: subscription, error } = await serviceClient
      .schema('app')
      .from('team_subscriptions')
      .select('stripe_subscription_id, tier')
      .eq('team_id', params.teamId)
      .single()

    if (error || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (subscription.tier === 'FREE') {
      return NextResponse.json({ error: 'Cannot cancel FREE tier' }, { status: 400 })
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Cancel at period end
    const updatedSub = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    console.log(`[Cancel] Subscription ${updatedSub.id} set to cancel at ${updatedSub.cancel_at}`)

    return NextResponse.json({
      success: true,
      cancel_at: updatedSub.cancel_at,
    })
  } catch (error: any) {
    console.error('[Cancel] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
