import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { fetchCompetitorReviews } from '@/lib/serp/competitorReviews'
import { generateCompetitorReport } from '@/lib/competitive/generateReport'
import { captureRouteError } from '@/lib/sentry'

export const maxDuration = 300

/**
 * POST /api/competitors/[competitorId]/setup
 *
 * Called internally after adding a competitor. Authenticated via CRON_SECRET
 * (not user session). Fetches reviews from SerpAPI, then generates the
 * initial competitive report.
 */
export async function POST(
  request: Request,
  { params }: { params: { competitorId: string } }
) {
  const serviceClient = createSupabaseServiceRoleClient()

  try {
    // ── 1. Verify CRON_SECRET auth ───────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Get competitor from DB ────────────────────────────────────────
    const { data: competitor, error: compError } = await serviceClient
      .schema('app')
      .from('competitors')
      .select('id, team_id, name, place_id, location_ids')
      .eq('id', params.competitorId)
      .single()

    if (compError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    if (!competitor.place_id) {
      return NextResponse.json({ error: 'Competitor has no place_id' }, { status: 400 })
    }

    // ── 3. Set sync status to 'syncing' ──────────────────────────────────
    await serviceClient
      .schema('app')
      .from('competitors')
      .update({
        last_serp_sync_status: 'syncing',
        last_serp_sync_error: null,
      })
      .eq('id', params.competitorId)

    try {
      // ── 4. Fetch competitor reviews via SerpAPI ──────────────────────────
      const { totalFetched, totalUpserted } = await fetchCompetitorReviews(
        competitor.place_id,
        params.competitorId
      )

      // ── 5. Update sync status to 'success' ──────────────────────────────
      await serviceClient
        .schema('app')
        .from('competitors')
        .update({
          last_serp_sync_at: new Date().toISOString(),
          last_serp_sync_status: 'success',
        })
        .eq('id', params.competitorId)

      // ── 6. Get location IDs from competitor row ────
      const locationIds: string[] = competitor.location_ids || []

      if (locationIds.length === 0) {
        return NextResponse.json({
          success: true,
          reviewsFetched: totalFetched,
          reviewsUpserted: totalUpserted,
          report: null,
          message: 'Reviews synced but no locations linked; skipped report generation.',
        })
      }

      // ── 7. Generate competitive report ───────
      const report = await generateCompetitorReport(
        serviceClient,
        { id: competitor.id, team_id: competitor.team_id, name: competitor.name },
        locationIds,
      )

      return NextResponse.json({
        success: true,
        reviewsFetched: totalFetched,
        reviewsUpserted: totalUpserted,
        report,
      })
    } catch (syncError: any) {
      // ── 9. On error: update sync status to 'error' ─────────────────────
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
    captureRouteError(error, {
      route: '/api/competitors/[competitorId]/setup',
      extra: { competitorId: params?.competitorId },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
