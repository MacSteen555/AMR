import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateCompetitiveGroupSchema } from '@/lib/validation/schemas'

export async function PATCH(request: Request, { params }: { params: { teamId: string; groupId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const body = await request.json()
    const data = updateCompetitiveGroupSchema.parse(body)

    const supabase = createSupabaseServerClient()

    const { data: group, error } = await supabase
      .schema('app')
      .from('competitive_groups')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.groupId)
      .eq('team_id', params.teamId)
      .select()
      .single()

    if (error || !group) {
      throw new Error(`Failed to update group: ${error?.message}`)
    }

    return NextResponse.json({ group })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { teamId: string; groupId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .schema('app')
      .from('competitive_groups')
      .delete()
      .eq('id', params.groupId)
      .eq('team_id', params.teamId)

    if (error) {
      throw new Error(`Failed to delete group: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
