import { unifiedCompetitiveRun } from '@/lib/openai/insights'

/**
 * Generates a unified competitive report for a single competitor vs its linked locations.
 *
 * 1. Fetches owned location reviews from app.google_reviews (up to 400/loc, last 6 months)
 * 2. Fetches competitor reviews from app.competitor_reviews (up to 400, last 6 months)
 * 3. Finds the most recent previous run for delta comparison
 * 4. Runs unifiedCompetitiveRun() once with all reviews
 * 5. Inserts the result into app.competitive_runs
 */
export async function generateCompetitorReport(
  serviceClient: any, // SupabaseClient
  competitor: { id: string; team_id: string; name: string },
  locationIds: string[],
): Promise<{ id: string }> {
  const now = new Date()
  const endStr = now.toISOString().split('T')[0]
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const startStr = sixMonthsAgo.toISOString().split('T')[0]

  // ── 1. Fetch owned location reviews ──────────────────────────────────────
  const { data: ownedLocations } = await serviceClient
    .schema('app')
    .from('locations')
    .select('id, name')
    .in('id', locationIds)
    .eq('team_id', competitor.team_id)

  const ownedLocationReviews = await Promise.all(
    (ownedLocations || []).map(async (loc: any) => {
      const { data: reviews } = await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('rating, comment, review_date, reviewer_name, reply_status')
        .eq('location_id', loc.id)
        .gte('review_date', startStr)
        .lte('review_date', endStr)
        .order('review_date', { ascending: false })
        .limit(400)

      return {
        name: loc.name,
        reviews: (reviews || []).map((r: any) => ({
          rating: r.rating,
          comment: r.comment,
          date: r.review_date,
          reviewer_name: r.reviewer_name || null,
          owner_response: r.reply_status === 'posted' || r.reply_status === 'synced_external',
        })),
      }
    })
  )

  // ── 2. Fetch competitor reviews ──────────────────────────────────────────
  const { data: compReviews } = await serviceClient
    .schema('app')
    .from('competitor_reviews')
    .select('rating, comment, review_date, reviewer_name, owner_response')
    .eq('competitor_id', competitor.id)
    .gte('review_date', startStr)
    .lte('review_date', endStr)
    .order('review_date', { ascending: false })
    .limit(400)

  const competitorReviews = [
    {
      name: competitor.name,
      reviews: (compReviews || []).map((r: any) => ({
        rating: r.rating,
        comment: r.comment,
        date: r.review_date,
        reviewer_name: r.reviewer_name || null,
        owner_response: !!(r.owner_response),
      })),
    },
  ]

  // ── 3. Fetch previous run for delta comparison ─────────────────────────
  const { data: prevRun } = await serviceClient
    .schema('app')
    .from('competitive_runs')
    .select('data')
    .contains('competitor_ids', [competitor.id])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousRunData = prevRun?.data?.unified || null

  const prevMetrics = previousRunData
    ? {
        competitivePositionScore: previousRunData.competitivePositionScore,
        marketMomentum: previousRunData.marketMomentum,
        ownedAverageRating: previousRunData.ownedAverageRating,
        competitorAverageRating: previousRunData.competitorAverageRating,
        threatAlerts: previousRunData.threatAlerts?.map((t: any) => t.title) || [],
        topStrengths: previousRunData.competitiveStrengths?.map((s: any) => s.theme) || [],
        topWeaknesses: previousRunData.competitiveWeaknesses?.map((w: any) => w.theme) || [],
      }
    : undefined

  // ── 4. Run unified competitive analysis ──────────────────────────────────
  const result = await unifiedCompetitiveRun({
    ownedLocations: ownedLocationReviews,
    competitors: competitorReviews,
    periodStart: startStr,
    periodEnd: endStr,
    previousMetrics: prevMetrics,
  })

  // ── 5. Insert into competitive_runs ──────────────────────────────────────
  const { data: run, error } = await serviceClient
    .schema('app')
    .from('competitive_runs')
    .insert({
      team_id: competitor.team_id,
      owned_location_ids: locationIds,
      competitor_ids: [competitor.id],
      data: { unified: result },
      model: 'gpt-5.2',
    })
    .select('id')
    .single()

  if (error || !run) {
    throw new Error(`Failed to save competitive run: ${error?.message}`)
  }

  return { id: run.id }
}
