import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

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
    }))

    return NextResponse.json({ members })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

