import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    // RBAC check (uses regular client with RLS internally)
    await requireTeamMember(params.teamId)

    // Data query uses service role since RLS may restrict
    // cross-table reads for non-admin members
    const supabase = createSupabaseServiceRoleClient()

    const { data: locations } = await supabase
      .schema('app')
      .from('locations')
      .select('*')
      .eq('team_id', params.teamId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    return NextResponse.json({ locations: locations || [] })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/locations', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}
