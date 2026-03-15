import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET() {
  try {
    const user = await requireUser()
    const supabase = createSupabaseServerClient()

    // Get teams with memberships
    const { data: memberships } = await supabase
      .schema('app')
      .from('team_memberships')
      .select('*, team:teams(*)')
      .eq('user_id', user.id)

    const teams = (memberships || []).map((m: any) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
    }))

    // Get active team subscription and credit balance for each team
    const teamsWithBilling = await Promise.all(
      teams.map(async (team) => {
        const { data: subscription } = await supabase
          .schema('app')
          .from('team_subscriptions')
          .select('*')
          .eq('team_id', team.id)
          .single()

        const { data: balance } = await supabase
          .schema('app')
          .from('team_credit_balances')
          .select('balance')
          .eq('team_id', team.id)
          .single()

        const monthlyCredits = subscription?.monthly_credits || 5
        const creditBalance = balance?.balance || 0

        return {
          ...team,
          subscription: subscription || null,
          creditBalance,
          reviewsManaged: Math.max(0, monthlyCredits - creditBalance),
        }
      })
    )

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      teams: teamsWithBilling,
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/me' })
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

