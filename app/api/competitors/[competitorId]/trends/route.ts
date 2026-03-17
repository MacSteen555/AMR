import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

/**
 * GET /api/competitors/[competitorId]/trends
 *
 * Returns monthly rating/volume aggregates for the competitor and
 * the owned locations it competes against, over the last 12 months.
 * Used for granular line charts on the Metrics tab.
 */
export async function GET(request: Request, { params }: { params: { competitorId: string } }) {
  try {
    await requireUser()
    const supabase = createSupabaseServerClient()

    const { data: competitor } = await supabase
      .schema('app')
      .from('competitors')
      .select('team_id, location_ids')
      .eq('id', params.competitorId)
      .single()

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    await requireTeamMember(competitor.team_id)

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const cutoff = oneYearAgo.toISOString()

    // Fetch competitor reviews (last 12 months)
    const { data: compReviews } = await supabase
      .schema('app')
      .from('competitor_reviews')
      .select('rating, review_date')
      .eq('competitor_id', params.competitorId)
      .gte('review_date', cutoff)
      .order('review_date', { ascending: true })

    // Fetch owned location reviews (last 12 months)
    const locationIds: string[] = competitor.location_ids || []
    let ownedReviews: Array<{ rating: number; review_date: string }> = []

    if (locationIds.length > 0) {
      const { data } = await supabase
        .schema('app')
        .from('google_reviews')
        .select('rating, review_date')
        .in('location_id', locationIds)
        .gte('review_date', cutoff)
        .order('review_date', { ascending: true })

      ownedReviews = data || []
    }

    // Aggregate by month
    function aggregateByMonth(reviews: Array<{ rating: number; review_date: string }>) {
      const buckets: Record<string, { sum: number; count: number }> = {}
      for (const r of reviews) {
        if (!r.review_date || r.rating == null) continue
        const month = r.review_date.substring(0, 7) // YYYY-MM
        if (!buckets[month]) buckets[month] = { sum: 0, count: 0 }
        buckets[month].sum += r.rating
        buckets[month].count += 1
      }
      return buckets
    }

    const compMonthly = aggregateByMonth(compReviews || [])
    const ownedMonthly = aggregateByMonth(ownedReviews)

    // Merge into a sorted timeline
    const allMonths = new Set([...Object.keys(compMonthly), ...Object.keys(ownedMonthly)])
    const timeline = Array.from(allMonths)
      .sort()
      .map(month => ({
        month,
        youRating: ownedMonthly[month]
          ? parseFloat((ownedMonthly[month].sum / ownedMonthly[month].count).toFixed(2))
          : null,
        youVolume: ownedMonthly[month]?.count || 0,
        themRating: compMonthly[month]
          ? parseFloat((compMonthly[month].sum / compMonthly[month].count).toFixed(2))
          : null,
        themVolume: compMonthly[month]?.count || 0,
      }))

    return NextResponse.json({ timeline })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/competitors/[competitorId]/trends' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
