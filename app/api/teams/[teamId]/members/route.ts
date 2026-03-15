import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    // RBAC check (uses regular client with RLS internally)
    await requireTeamMember(params.teamId)

    // Data query uses service role to join across users table
    // (RLS on app.users prevents one user from seeing another's row)
    const supabase = createSupabaseServiceRoleClient()

    const { data: memberships } = await supabase
      .schema('app')
      .from('team_memberships')
      .select('*, user:users(id, email, display_name, avatar_url)')
      .eq('team_id', params.teamId)

    const members = (memberships || []).map((m: any) => ({
      id: m.user.id,
      email: m.user.email,
      display_name: m.user.display_name,
      avatar_url: m.user.avatar_url,
      role: m.role,
      joined_at: m.created_at,
      digest_frequency: m.digest_frequency,
    }))

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Members route error:', error.message, error.stack)
    captureRouteError(error, { route: '/api/teams/[teamId]/members', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}
