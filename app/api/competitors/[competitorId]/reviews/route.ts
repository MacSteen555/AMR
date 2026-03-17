import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(request: Request, { params }: { params: { competitorId: string } }) {
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

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    const { data: reviews } = await supabase
      .schema('app')
      .from('competitor_reviews')
      .select('id, rating, reviewer_name, comment, review_date, owner_response')
      .eq('competitor_id', params.competitorId)
      .order('review_date', { ascending: false })
      .limit(limit)

    return NextResponse.json({ reviews: reviews || [] })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/competitors/[competitorId]/reviews' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
