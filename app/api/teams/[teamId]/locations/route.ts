import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: locations } = await supabase
      .schema('app')
      .from('locations')
      .select('*')
      .eq('team_id', params.teamId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    return NextResponse.json({ locations: locations || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

