import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewRow {
  rating: number
  comment: string | null
  review_date: string
  reply_status: string
  replied_at: string | null
  location_id: string
  reviewer_name: string | null
  themes: string[] | null
}

interface LocationInfo {
  id: string
  name: string
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Parse a review_date timestamp or YYYY-MM-DD string into epoch ms (UTC) */
function toEpoch(dateStr: string): number {
  return new Date(dateStr).getTime()
}

/** Filter reviews whose review_date falls within [start, end] inclusive (date strings) */
function filterByPeriod<T extends { review_date: string }>(
  reviews: T[],
  start: string,
  end: string,
): T[] {
  const startMs = toEpoch(start)
  // end is a date like "2026-03-13" — include the whole day
  const endMs = toEpoch(end) + 86400000 - 1
  return reviews.filter(r => {
    const ms = toEpoch(r.review_date)
    return ms >= startMs && ms <= endMs
  })
}

/** Generate YYYY-MM month keys from startDate to endDate (inclusive of both months) */
function generateMonthKeys(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const keys: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const endLimit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  while (cursor <= endLimit) {
    keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return keys
}

/** Get YYYY-MM key for a review date */
function monthKey(reviewDate: string): string {
  const d = new Date(reviewDate)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Expand a period start to the first of its month so charts show full months */
function expandToMonthStart(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// ─── KPI computation ─────────────────────────────────────────────────────────

const REPLIED_STATUSES = ['posted', 'synced_external']

interface PeriodKPIs {
  totalReviews: number
  averageRating: number
  responseRate: number
  averageResponseTimeHours: number | null
  positivePercent: number
  negativePercent: number
}

function computeKPIs(reviews: Array<{ rating: number; reply_status: string; replied_at: string | null; review_date: string }>): PeriodKPIs {
  if (reviews.length === 0) {
    return { totalReviews: 0, averageRating: 0, responseRate: 0, averageResponseTimeHours: null, positivePercent: 0, negativePercent: 0 }
  }

  const n = reviews.length
  const averageRating = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / n) * 100) / 100
  const replied = reviews.filter(r => REPLIED_STATUSES.includes(r.reply_status))
  const responseRate = Math.round((replied.length / n) * 10000) / 100

  const responseTimes = replied
    .filter(r => r.replied_at)
    .map(r => (toEpoch(r.replied_at!) - toEpoch(r.review_date)) / 3600000)
    .filter(h => h >= 0 && h < 8760)
  const averageResponseTimeHours = responseTimes.length > 0
    ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
    : null

  const positive = reviews.filter(r => r.rating >= 4).length
  const negative = reviews.filter(r => r.rating <= 2).length

  return {
    totalReviews: n,
    averageRating,
    responseRate,
    averageResponseTimeHours,
    positivePercent: Math.round((positive / n) * 10000) / 100,
    negativePercent: Math.round((negative / n) * 10000) / 100,
  }
}

function computeComparison(current: PeriodKPIs, previous: PeriodKPIs) {
  const deltaPct = (curr: number, prev: number): number | null =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

  return {
    totalReviews: { current: current.totalReviews, previous: previous.totalReviews, deltaPercent: deltaPct(current.totalReviews, previous.totalReviews) },
    averageRating: { current: current.averageRating, previous: previous.averageRating, delta: Math.round((current.averageRating - previous.averageRating) * 100) / 100 },
    responseRate: { current: current.responseRate, previous: previous.responseRate, deltaPercent: deltaPct(current.responseRate, previous.responseRate) },
    averageResponseTimeHours: {
      current: current.averageResponseTimeHours,
      previous: previous.averageResponseTimeHours,
      deltaPercent: current.averageResponseTimeHours != null && previous.averageResponseTimeHours != null
        ? deltaPct(current.averageResponseTimeHours, previous.averageResponseTimeHours)
        : null,
    },
  }
}

// ─── Theme extraction ────────────────────────────────────────────────────────

function computeThemeMentions(
  reviews: Array<{ themes: string[] | null; rating: number }>,
): Array<{ label: string; count: number; sentiment: 'positive' | 'negative' }> {
  const posMap = new Map<string, number>()
  const negMap = new Map<string, number>()

  for (const r of reviews) {
    if (!r.themes) continue
    const map = r.rating >= 4 ? posMap : negMap
    for (const t of r.themes) {
      map.set(t, (map.get(t) || 0) + 1)
    }
  }

  const results: Array<{ label: string; count: number; sentiment: 'positive' | 'negative' }> = []

  for (const [label, count] of posMap) {
    results.push({ label, count, sentiment: 'positive' })
  }
  for (const [label, count] of negMap) {
    results.push({ label, count, sentiment: 'negative' })
  }

  return results.sort((a, b) => b.count - a.count)
}

// ─── Analytics computation ───────────────────────────────────────────────────

function computeAnalytics(
  reviews: ReviewRow[],
  locations: LocationInfo[],
  periodStart: string,
  periodEnd: string,
) {
  const kpis = computeKPIs(reviews)

  if (reviews.length === 0) {
    return {
      kpis: { ...kpis, locationCount: locations.length },
      ratingOverTime: [],
      responseRateOverTime: [],
      ratingDistribution: [5, 4, 3, 2, 1].map(rating => ({ rating, count: 0 })),
      volumeOverTime: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      perLocation: [],
      replyGap: [],
    }
  }

  // Rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
  }))

  // Monthly time series
  const monthKeys = generateMonthKeys(periodStart, periodEnd)
  const monthBuckets = new Map<string, ReviewRow[]>(monthKeys.map(k => [k, []]))

  for (const r of reviews) {
    const key = monthKey(r.review_date)
    if (monthBuckets.has(key)) monthBuckets.get(key)!.push(r)
  }

  const sortedMonths = monthKeys.map(k => [k, monthBuckets.get(k)!] as [string, ReviewRow[]])

  const ratingOverTime = sortedMonths.map(([month, bucket]) => {
    const data: Record<string, any> = {
      month,
      averageRating: bucket.length > 0
        ? Math.round((bucket.reduce((s, r) => s + r.rating, 0) / bucket.length) * 100) / 100
        : null,
      count: bucket.length,
    }
    // Per-location breakdown for multi-location teams
    if (locations.length > 1) {
      for (const loc of locations) {
        const locBucket = bucket.filter(r => r.location_id === loc.id)
        data[loc.name] = locBucket.length > 0
          ? Math.round((locBucket.reduce((s, r) => s + r.rating, 0) / locBucket.length) * 100) / 100
          : null
      }
    }
    return data
  })

  const responseRateOverTime = sortedMonths.map(([month, bucket]) => {
    const replied = bucket.filter(r => REPLIED_STATUSES.includes(r.reply_status)).length
    const data: Record<string, any> = {
      month,
      rate: bucket.length > 0 ? Math.round((replied / bucket.length) * 10000) / 100 : null,
      replied,
      total: bucket.length,
    }
    if (locations.length > 1) {
      for (const loc of locations) {
        const locBucket = bucket.filter(r => r.location_id === loc.id)
        const locReplied = locBucket.filter(r => REPLIED_STATUSES.includes(r.reply_status)).length
        data[loc.name] = locBucket.length > 0
          ? Math.round((locReplied / locBucket.length) * 10000) / 100
          : null
      }
    }
    return data
  })

  const volumeOverTime = sortedMonths.map(([month, bucket]) => ({
    month,
    total: bucket.length,
    positive: bucket.filter(r => r.rating >= 4).length,
    neutral: bucket.filter(r => r.rating === 3).length,
    negative: bucket.filter(r => r.rating <= 2).length,
  }))

  // Per-location stats
  const locationMap = new Map(locations.map(l => [l.id, l.name]))
  const perLocationMap = new Map<string, ReviewRow[]>()
  for (const r of reviews) {
    if (!perLocationMap.has(r.location_id)) perLocationMap.set(r.location_id, [])
    perLocationMap.get(r.location_id)!.push(r)
  }

  const perLocation = [...perLocationMap.entries()].map(([locId, locReviews]) => {
    const locReplied = locReviews.filter(r => REPLIED_STATUSES.includes(r.reply_status))
    return {
      locationId: locId,
      locationName: locationMap.get(locId) || 'Unknown',
      totalReviews: locReviews.length,
      averageRating: Math.round((locReviews.reduce((s, r) => s + r.rating, 0) / locReviews.length) * 100) / 100,
      responseRate: Math.round((locReplied.length / locReviews.length) * 10000) / 100,
    }
  }).sort((a, b) => b.totalReviews - a.totalReviews)

  // Reply gap — unanswered reviews with low ratings
  const replyGap = reviews
    .filter(r => !['posted', 'synced_external', 'dismissed'].includes(r.reply_status) && r.rating <= 3)
    .map(r => ({
      reviewDate: r.review_date,
      rating: r.rating,
      comment: r.comment?.slice(0, 120) || null,
      daysSince: Math.floor((Date.now() - toEpoch(r.review_date)) / 86400000),
      locationId: r.location_id || null,
      locationName: r.location_id ? (locationMap.get(r.location_id) || null) : null,
    }))
    .sort((a, b) => a.rating - b.rating || b.daysSince - a.daysSince)
    .slice(0, 20)

  return {
    kpis: { ...kpis, locationCount: locations.length },
    ratingOverTime,
    responseRateOverTime,
    volumeOverTime,
    sentimentBreakdown: {
      positive: reviews.filter(r => r.rating >= 4).length,
      neutral: reviews.filter(r => r.rating === 3).length,
      negative: reviews.filter(r => r.rating <= 2).length,
    },
    ratingDistribution,
    perLocation,
    replyGap,
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get('period_start')
    const periodEnd = searchParams.get('period_end')
    const locationParam = searchParams.get('location')
    const previousStart = searchParams.get('previous_start')
    const previousEnd = searchParams.get('previous_end')

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 400 })
    }

    // Expand to first-of-month so chart months are fully populated
    const chartStart = expandToMonthStart(periodStart)

    const supabase = createSupabaseServiceRoleClient()

    // ── Fetch locations ──────────────────────────────────────────────────────
    let locations: LocationInfo[] = []

    if (locationParam) {
      const { data: loc, error: locError } = await supabase
        .schema('app')
        .from('locations')
        .select('id, name')
        .eq('id', locationParam)
        .eq('team_id', params.teamId)
        .single()

      if (locError || !loc) {
        return NextResponse.json({ error: 'Location not found in this team' }, { status: 404 })
      }
      locations = [loc]
    } else {
      const { data: locs } = await supabase
        .schema('app')
        .from('locations')
        .select('id, name')
        .eq('team_id', params.teamId)

      locations = locs || []
    }

    if (locations.length === 0) {
      return NextResponse.json({
        analytics: computeAnalytics([], [], periodStart, periodEnd),
        comparison: undefined,
        themeMentions: [],
      })
    }

    const locationIds = locations.map(l => l.id)

    // ── Fetch reviews covering both current and previous periods ─────────────
    const fetchStart = previousStart && previousStart < chartStart ? previousStart : chartStart

    let query = supabase
      .schema('app')
      .from('google_reviews')
      .select('rating, comment, review_date, reply_status, replied_at, location_id, reviewer_name, themes')
      .gte('review_date', fetchStart)
      .lte('review_date', periodEnd)
      .order('review_date', { ascending: true })
      .limit(10000)

    if (locationParam) {
      query = query.eq('location_id', locationParam)
    } else {
      query = query.in('location_id', locationIds)
    }

    const { data: allReviews, error } = await query

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`)
    }

    const all = (allReviews || []) as ReviewRow[]

    // ── Filter by current period ─────────────────────────────────────────────
    const currentReviews = filterByPeriod(all, chartStart, periodEnd)
    const analytics = computeAnalytics(currentReviews, locations, chartStart, periodEnd)
    const themeMentions = computeThemeMentions(currentReviews)

    // ── Comparison with previous period ──────────────────────────────────────
    let comparison = undefined
    if (previousStart && previousEnd) {
      const prevReviews = filterByPeriod(all, previousStart, previousEnd)
      comparison = computeComparison(computeKPIs(currentReviews), computeKPIs(prevReviews))
    }

    return NextResponse.json({ analytics, comparison, themeMentions })
  } catch (error: any) {
    if (error.message === 'Not a team member') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/insights/data', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
