import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateCompetitorLocationsSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'

export async function PATCH(request: Request, { params }: { params: { competitorId: string } }) {
  try {
    await requireUser()
    const supabase = createSupabaseServerClient()

    // Get competitor to verify team access
    const { data: competitor } = await supabase
      .schema('app')
      .from('competitors')
      .select('team_id')
      .eq('id', params.competitorId)
      .single()

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    await requireTeamMember(competitor.team_id)

    const body = await request.json()
    const data = updateCompetitorLocationsSchema.parse(body)

    // Validate location_ids belong to this team
    const { data: validLocations } = await supabase
      .schema('app')
      .from('locations')
      .select('id')
      .eq('team_id', competitor.team_id)
      .in('id', data.location_ids)

    const validIds = new Set((validLocations || []).map((l: any) => l.id))
    const invalidIds = data.location_ids.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'One or more location IDs do not belong to this team.' }, { status: 400 })
    }

    // Update the location_ids array directly on the competitor
    const { error } = await supabase
      .schema('app')
      .from('competitors')
      .update({ location_ids: data.location_ids })
      .eq('id', params.competitorId)

    if (error) {
      throw new Error(`Failed to update locations: ${error.message}`)
    }

    return NextResponse.json({ location_ids: data.location_ids })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/competitors/[competitorId]/locations' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
