import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await requireUser()
    await requireTeamMember(params.teamId)

    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .schema('app')
      .from('team_memberships')
      .select('digest_frequency, digest_last_sent_at')
      .eq('team_id', params.teamId)
      .eq('user_id', user.id)
      .single()

    if (error) throw new Error(`Failed to fetch digest preference: ${error.message}`)

    return NextResponse.json({
      frequency: data.digest_frequency,
      lastSentAt: data.digest_last_sent_at,
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/digest-preference', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await requireUser()
    await requireTeamMember(params.teamId)

    const body = await request.json()
    const { frequency } = body

    if (!['off', 'daily', 'weekly'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency. Must be off, daily, or weekly.' }, { status: 400 })
    }

    // Tier gate: check if the team's subscription allows the requested frequency
    if (frequency !== 'off') {
      const supabase = createSupabaseServiceRoleClient()
      const { data: sub } = await supabase
        .schema('app')
        .from('team_subscriptions')
        .select('tier')
        .eq('team_id', params.teamId)
        .single()

      const tier = sub?.tier || 'FREE'

      if (tier === 'FREE') {
        return NextResponse.json({ error: 'Email digests are not available on the Free plan.' }, { status: 403 })
      }
      if (frequency === 'daily' && !['BUSINESS', 'ENTERPRISE'].includes(tier)) {
        return NextResponse.json({ error: 'Daily digests require a Business or Enterprise plan.' }, { status: 403 })
      }
    }

    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase
      .schema('app')
      .from('team_memberships')
      .update({ digest_frequency: frequency })
      .eq('team_id', params.teamId)
      .eq('user_id', user.id)

    if (error) throw new Error(`Failed to update digest preference: ${error.message}`)

    return NextResponse.json({ frequency })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/digest-preference', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
