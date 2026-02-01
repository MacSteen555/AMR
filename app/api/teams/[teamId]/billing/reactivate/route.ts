import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { stripe } from '@/lib/stripe'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

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

    // Undo cancellation
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Error reactivating subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
