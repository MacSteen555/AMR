import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { fetchCompetitorReviews } from '@/lib/serp/competitorReviews'
import { generateCompetitorReport } from '@/lib/competitive/generateReport'
import { captureRouteError } from '@/lib/sentry'

export const maxDuration = 300

/**
 * POST /api/cron/competitive-sync
 *
 * Runs daily. Finds competitors whose latest competitive_run is older than
 * 14 days (or who have no runs yet but have location_ids set), syncs their
 * reviews, and generates a new competitive report.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createSupabaseServiceRoleClient()
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  // Get all active competitors
  const { data: allCompetitors, error: fetchError } = await serviceClient
    .schema('app')
    .from('competitors')
    .select('id, team_id, place_id, name, location_ids')
    .is('deleted_at', null)

  if (fetchError) {
    captureRouteError(fetchError, { route: '/api/cron/competitive-sync' })
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 })
  }

  if (!allCompetitors || allCompetitors.length === 0) {
    return NextResponse.json({ message: 'No active competitors', processed: 0 })
  }

  // Find which competitors are due: latest run older than 14 days (or no run at all)
  const competitorIds = allCompetitors.map((c) => c.id)
  const { data: recentRuns } = await serviceClient
    .schema('app')
    .from('competitive_runs')
    .select('competitor_ids, created_at')
    .gte('created_at', fourteenDaysAgo.toISOString())

  // Build set of competitor IDs that have a recent run
  const hasRecentRun = new Set<string>()
  for (const run of recentRuns || []) {
    for (const cid of run.competitor_ids || []) {
      if (competitorIds.includes(cid)) {
        hasRecentRun.add(cid)
      }
    }
  }

  // Filter to competitors that are due and have locations configured
  const dueCompetitors = allCompetitors.filter(
    (c) => !hasRecentRun.has(c.id) && c.place_id && c.location_ids && c.location_ids.length > 0
  )

  if (dueCompetitors.length === 0) {
    return NextResponse.json({ message: 'No competitors due for reports', processed: 0 })
  }

  const results: Array<{
    competitorId: string
    name: string
    status: 'success' | 'failed'
    error?: string
  }> = []

  let succeeded = 0
  let failed = 0

  // Process sequentially to avoid SerpAPI rate limits
  for (const competitor of dueCompetitors) {
    try {
      // Sync reviews
      await serviceClient
        .schema('app')
        .from('competitors')
        .update({ last_serp_sync_status: 'syncing', last_serp_sync_error: null })
        .eq('id', competitor.id)

      await fetchCompetitorReviews(competitor.place_id, competitor.id)

      await serviceClient
        .schema('app')
        .from('competitors')
        .update({
          last_serp_sync_at: new Date().toISOString(),
          last_serp_sync_status: 'success',
        })
        .eq('id', competitor.id)

      // Generate report (finds previous run internally for delta comparison)
      await generateCompetitorReport(serviceClient, competitor, competitor.location_ids)

      succeeded++
      results.push({ competitorId: competitor.id, name: competitor.name, status: 'success' })
    } catch (error: any) {
      failed++

      try {
        await serviceClient
          .schema('app')
          .from('competitors')
          .update({ last_serp_sync_status: 'error', last_serp_sync_error: error.message })
          .eq('id', competitor.id)
      } catch (_) {}

      captureRouteError(error, {
        route: '/api/cron/competitive-sync',
        teamId: competitor.team_id,
      })

      results.push({
        competitorId: competitor.id,
        name: competitor.name,
        status: 'failed',
        error: error.message,
      })
    }
  }

  return NextResponse.json({
    processed: dueCompetitors.length,
    succeeded,
    failed,
    results,
  })
}
