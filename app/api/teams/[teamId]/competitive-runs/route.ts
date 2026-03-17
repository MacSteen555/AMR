import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireUser()
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const competitorId = searchParams.get('competitorId')

    let query = supabase
      .schema('app')
      .from('competitive_runs')
      .select('id, competitor_ids, created_at, data, owned_location_ids, model')
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (competitorId) {
      query = query.contains('competitor_ids', [competitorId])
    }

    const { data: runs } = await query

    return NextResponse.json({ runs: runs || [] })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/competitive-runs', teamId: params?.teamId })
    const status = error.message?.includes('Unauthorized') || error.message?.includes('not a member') ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
