import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCompetitiveGroupSchema } from '@/lib/validation/schemas'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: groups } = await supabase
      .schema('app')
      .from('competitive_groups')
      .select('*')
      .eq('team_id', params.teamId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    return NextResponse.json({ groups: groups || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const user = await requireUser()
    const body = await request.json()
    const data = createCompetitiveGroupSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // Check if this is the first group — make it default
    const { count } = await supabase
      .schema('app')
      .from('competitive_groups')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', params.teamId)

    const isFirst = (count ?? 0) === 0

    const { data: group, error } = await supabase
      .schema('app')
      .from('competitive_groups')
      .insert({
        team_id: params.teamId,
        created_by_user_id: user.id,
        name: data.name,
        owned_location_ids: data.owned_location_ids,
        competitor_ids: data.competitor_ids,
        is_default: isFirst,
      })
      .select()
      .single()

    if (error || !group) {
      throw new Error(`Failed to create group: ${error?.message}`)
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
