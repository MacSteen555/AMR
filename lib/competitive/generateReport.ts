import { competitiveRun, type PeriodWindow } from '@/lib/openai/insights'

const TIMEFRAMES: Array<{ id: PeriodWindow; days?: number; months?: number; years?: number }> = [
  { id: '30d', days: 30 },
  { id: '90d', days: 90 },
  { id: '6m', months: 6 },
  { id: '1y', years: 1 },
]

/**
 * Generates a competitive report for a single competitor vs its linked locations.
 *
 * 1. Fetches owned location reviews from app.google_reviews (up to 400/loc, last 1 year)
 * 2. Fetches competitor reviews from app.competitor_reviews (up to 400, last 1 year)
 * 3. Finds the most recent previous run for delta comparison
 * 4. Runs competitiveRun() for 4 timeframes (30d, 90d, 6m, 1y) concurrently
 * 5. Inserts the result into app.competitive_runs
 */
export async function generateCompetitorReport(
  serviceClient: any, // SupabaseClient
  competitor: { id: string; team_id: string; name: string },
  locationIds: string[],
): Promise<{ id: string }> {
  const now = new Date()
  const endStr = now.toISOString().split('T')[0]
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const maxStartStr = oneYearAgo.toISOString().split('T')[0]

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
        .gte('review_date', maxStartStr)
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
    .gte('review_date', maxStartStr)
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
  let previousRunData: any = null
  const { data: prevRun } = await serviceClient
    .schema('app')
    .from('competitive_runs')
    .select('data')
    .contains('competitor_ids', [competitor.id])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  previousRunData = prevRun?.data || null

  // ── 4. Run competitive analysis for 4 timeframes concurrently ────────────
  const analysisData: Record<string, any> = {}

  await Promise.all(
    TIMEFRAMES.map(async (tf) => {
      const start = new Date()
      if (tf.days) start.setDate(start.getDate() - tf.days)
      if (tf.months) start.setMonth(start.getMonth() - tf.months)
      if (tf.years) start.setFullYear(start.getFullYear() - tf.years)
      const startStr = start.toISOString().split('T')[0]

      const filterReviews = (rawReviews: any[]) =>
        rawReviews.filter((r) => r.date >= startStr).slice(0, 200)

      const filteredOwned = ownedLocationReviews.map((loc) => ({
        name: loc.name,
        reviews: filterReviews(loc.reviews),
      }))

      const filteredComp = competitorReviews.map((comp) => ({
        name: comp.name,
        reviews: filterReviews(comp.reviews),
      }))

      const prevMetrics = previousRunData?.[tf.id]
        ? {
            competitivePositionScore: previousRunData[tf.id].competitivePositionScore,
            marketMomentum: previousRunData[tf.id].marketMomentum,
            ownedAverageRating: previousRunData[tf.id].ownedAverageRating,
            competitorAverageRating: previousRunData[tf.id].competitorAverageRating,
            threatAlerts: previousRunData[tf.id].threatAlerts?.map((t: any) => t.title) || [],
            topStrengths: previousRunData[tf.id].competitiveStrengths?.map((s: any) => s.theme) || [],
            topWeaknesses: previousRunData[tf.id].competitiveWeaknesses?.map((w: any) => w.theme) || [],
          }
        : undefined

      analysisData[tf.id] = await competitiveRun({
        ownedLocations: filteredOwned,
        competitors: filteredComp,
        periodStart: startStr,
        periodEnd: endStr,
        periodWindow: tf.id,
        previousMetrics: prevMetrics,
      })
    })
  )

  // ── 5. Insert into competitive_runs ──────────────────────────────────────
  const { data: run, error } = await serviceClient
    .schema('app')
    .from('competitive_runs')
    .insert({
      team_id: competitor.team_id,
      owned_location_ids: locationIds,
      competitor_ids: [competitor.id],
      data: analysisData,
      model: 'gpt-5.2',
    })
    .select('id')
    .single()

  if (error || !run) {
    throw new Error(`Failed to save competitive run: ${error?.message}`)
  }

  return { id: run.id }
}
