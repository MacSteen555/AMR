import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { fetchCompetitorReviews } from '@/lib/serp/competitorReviews'

export async function POST(request: Request, { params }: { params: { competitorId: string } }) {
  try {
    const user = await requireUser()
    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get competitor
    const { data: competitor } = await supabase
      .from('app.competitors')
      .select('place_id, team_id')
      .eq('id', params.competitorId)
      .single()

    if (!competitor || !competitor.place_id) {
      return NextResponse.json({ error: 'Competitor or place_id not found' }, { status: 404 })
    }

    // Verify team access
    await requireTeamMember(competitor.team_id)

    // Sync reviews
    const { totalFetched, totalUpserted } = await fetchCompetitorReviews(
      competitor.place_id,
      params.competitorId
    )

    // Update competitor sync status
    await serviceClient
      .from('app.competitors')
      .update({
        last_serp_sync_at: new Date().toISOString(),
        last_serp_sync_status: 'success',
      })
      .eq('id', params.competitorId)

    return NextResponse.json({ fetched: totalFetched, upserted: totalUpserted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

