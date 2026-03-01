import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ReviewRow {
  rating: number
  comment: string | null
  review_date: string
  reply_status: string
  replied_at: string | null
}

function computeAnalytics(reviews: ReviewRow[], periodStart: string, periodEnd: string) {
  if (reviews.length === 0) {
    return {
      kpis: {
        totalReviews: 0,
        averageRating: 0,
        responseRate: 0,
        averageResponseTimeHours: null,
        positivePercent: 0,
        negativePercent: 0,
      },
      ratingOverTime: [],
      volumeOverTime: [],
      responseRateOverTime: [],
      ratingDistribution: [
        { rating: 5, count: 0 },
        { rating: 4, count: 0 },
        { rating: 3, count: 0 },
        { rating: 2, count: 0 },
        { rating: 1, count: 0 },
      ],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    }
  }

  const totalReviews = reviews.length
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews

  const repliedStatuses = ['posted', 'synced_external']
  const repliedReviews = reviews.filter(r => repliedStatuses.includes(r.reply_status))
  const responseRate = (repliedReviews.length / totalReviews) * 100

  const responseTimes = repliedReviews
    .filter(r => r.replied_at)
    .map(r => {
      const reviewDate = new Date(r.review_date).getTime()
      const replyDate = new Date(r.replied_at!).getTime()
      return (replyDate - reviewDate) / (1000 * 60 * 60)
    })
    .filter(h => h >= 0 && h < 8760) // exclude outliers > 1 year
  const averageResponseTimeHours = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null

  const positive = reviews.filter(r => r.rating >= 4).length
  const neutral = reviews.filter(r => r.rating === 3).length
  const negative = reviews.filter(r => r.rating <= 2).length

  // Rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
  }))

  // Group reviews by month for time series
  const monthBuckets = new Map<string, ReviewRow[]>()
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  // Pre-fill all months in range
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    monthBuckets.set(key, [])
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const r of reviews) {
    const d = new Date(r.review_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthBuckets.has(key)) {
      monthBuckets.get(key)!.push(r)
    }
  }

  const sortedMonths = [...monthBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const ratingOverTime = sortedMonths.map(([month, bucket]) => ({
    month,
    averageRating: bucket.length > 0
      ? Math.round((bucket.reduce((s, r) => s + r.rating, 0) / bucket.length) * 100) / 100
      : null,
    count: bucket.length,
  }))

  const volumeOverTime = sortedMonths.map(([month, bucket]) => ({
    month,
    total: bucket.length,
    positive: bucket.filter(r => r.rating >= 4).length,
    neutral: bucket.filter(r => r.rating === 3).length,
    negative: bucket.filter(r => r.rating <= 2).length,
  }))

  const responseRateOverTime = sortedMonths.map(([month, bucket]) => {
    const replied = bucket.filter(r => repliedStatuses.includes(r.reply_status)).length
    return {
      month,
      rate: bucket.length > 0 ? Math.round((replied / bucket.length) * 10000) / 100 : null,
      replied,
      total: bucket.length,
    }
  })

  return {
    kpis: {
      totalReviews,
      averageRating: Math.round(avgRating * 100) / 100,
      responseRate: Math.round(responseRate * 100) / 100,
      averageResponseTimeHours: averageResponseTimeHours !== null
        ? Math.round(averageResponseTimeHours * 10) / 10
        : null,
      positivePercent: Math.round((positive / totalReviews) * 10000) / 100,
      negativePercent: Math.round((negative / totalReviews) * 10000) / 100,
    },
    ratingOverTime,
    volumeOverTime,
    responseRateOverTime,
    ratingDistribution,
    sentimentBreakdown: { positive, neutral, negative },
  }
}

export async function GET(request: Request, { params }: { params: { locationId: string } }) {
  try {
    const { location } = await requireLocationAccess(params.locationId)

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get('period_start')
    const periodEnd = searchParams.get('period_end')

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceRoleClient()

    // Get team's tier
    const teamId = (location as any).team?.id || (location as any).team_id
    const { data: subscription } = teamId ? await supabase
      .schema('app')
      .from('team_subscriptions')
      .select('tier')
      .eq('team_id', teamId)
      .single() : { data: null }

    const tier = subscription?.tier || 'FREE'

    const { data: reviews, error } = await supabase
      .schema('app')
      .from('google_reviews')
      .select('rating, comment, review_date, reply_status, replied_at')
      .eq('location_id', params.locationId)
      .gte('review_date', periodStart)
      .lte('review_date', periodEnd)
      .order('review_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`)
    }

    const analytics = computeAnalytics(reviews || [], periodStart, periodEnd)

    return NextResponse.json({ analytics, tier, teamId })
  } catch (error: any) {
    if (error.message === 'Not a team member' || error.message === 'No access to location') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
