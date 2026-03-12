import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: subscription } = await supabase
      .schema('app')
      .from('team_subscriptions')
      .select('*')
      .eq('team_id', params.teamId)
      .single()

    const { data: balance } = await supabase
      .schema('app')
      .from('team_credit_balances')
      .select('balance')
      .eq('team_id', params.teamId)
      .single()

    const { data: topupProducts } = await supabase
      .schema('app')
      .from('credit_topup_products')
      .select('*')
      .eq('is_active', true)

    return NextResponse.json({
      subscription: subscription || null,
      creditBalance: balance?.balance || 0,
      topupProducts: topupProducts || [],
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/billing', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

