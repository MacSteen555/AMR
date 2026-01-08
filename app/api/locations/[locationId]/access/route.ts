import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createLocationAccessSchema } from '@/lib/validation/schemas'

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
  try {
    const { location } = await requireLocationAccess(params.locationId)
    await requireTeamAdmin(location.team_id)

    const body = await request.json()
    const data = createLocationAccessSchema.parse(body)

    const supabase = createSupabaseServerClient()

    const { error } = await supabase.from('app.location_access').upsert(
      {
        team_id: location.team_id,
        location_id: params.locationId,
        user_id: data.user_id,
        can_manage: data.can_manage,
      },
      {
        onConflict: 'location_id,user_id',
      }
    )

    if (error) {
      throw new Error(`Failed to grant access: ${error.message}`)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

