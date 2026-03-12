import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { stripe } from '@/lib/stripe'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)
    const serviceClient = createSupabaseServiceRoleClient()

    // Get subscription
    const { data: subscription } = await serviceClient
      .schema('app').from('team_subscriptions')
      .select('stripe_subscription_id')
      .eq('team_id', params.teamId)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription to reactivate' }, { status: 400 })
    }

    // Check if subscription has a schedule attached
    const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ['schedule']
    })

    // If there's a schedule, release it first
    if (sub.schedule) {
      const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id
      console.log(`[API] Releasing subscription schedule ${scheduleId} before reactivating`)
      await stripe.subscriptionSchedules.release(scheduleId)
    }

    // Undo cancellation
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Error reactivating subscription:', error)
    captureRouteError(error, { route: '/api/teams/[teamId]/billing/reactivate', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
