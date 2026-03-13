import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateTeamMemberSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; userId: string } }
) {
  try {
    await requireTeamAdmin(params.teamId)
    const body = await request.json()
    const data = updateTeamMemberSchema.parse(body)

    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .schema('app')
      .from('team_memberships')
      .update({ role: data.role })
      .eq('team_id', params.teamId)
      .eq('user_id', params.userId)

    if (error) {
      throw new Error(`Failed to update member: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/members/[userId]', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

