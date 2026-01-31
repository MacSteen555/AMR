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
      .select('stripe_subscription_id, status')
      .eq('team_id', params.teamId)
      .single()

    if (error || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription to reactivate' }, { status: 400 })
    }

    if (subscription.status !== 'canceling') {
      return NextResponse.json({ error: 'Subscription is not set to cancel' }, { status: 400 })
    }

    // Undo cancellation
    const updatedSub = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    console.log(`[Reactivate] Subscription ${updatedSub.id} reactivated`)

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('[Reactivate] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
