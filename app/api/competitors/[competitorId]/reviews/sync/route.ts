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
      .schema('app')
      .from('competitors')
      .select('place_id, team_id, last_serp_sync_at')
      .eq('id', params.competitorId)
      .single()

    if (!competitor || !competitor.place_id) {
      return NextResponse.json({ error: 'Competitor or place_id not found' }, { status: 404 })
    }

    // Verify team access
    await requireTeamMember(competitor.team_id)

    // Rate Limiting Check (1 update per week)
    if (competitor.last_serp_sync_at) {
      const lastSync = new Date(competitor.last_serp_sync_at)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      if (lastSync > oneWeekAgo) {
        const nextAvailable = new Date(lastSync)
        nextAvailable.setDate(lastSync.getDate() + 7)
        return NextResponse.json(
          { error: `You can only sync reviews once per week. Next sync available on ${nextAvailable.toLocaleDateString()}` },
          { status: 429 }
        )
      }
    }

    // Update to syncing
    await serviceClient
      .schema('app')
      .from('competitors')
      .update({
        last_serp_sync_status: 'syncing',
        last_serp_sync_error: null,
      })
      .eq('id', params.competitorId)

    try {
      // Sync reviews
      const { totalFetched, totalUpserted } = await fetchCompetitorReviews(
        competitor.place_id,
        params.competitorId
      )

      // Update competitor sync status
      await serviceClient
        .schema('app')
        .from('competitors')
        .update({
          last_serp_sync_at: new Date().toISOString(),
          last_serp_sync_status: 'success',
        })
        .eq('id', params.competitorId)

      return NextResponse.json({ fetched: totalFetched, upserted: totalUpserted })
    } catch (syncError: any) {
      await serviceClient
        .schema('app')
        .from('competitors')
        .update({
          last_serp_sync_status: 'error',
          last_serp_sync_error: syncError.message,
        })
        .eq('id', params.competitorId)

      throw syncError
    }


  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

