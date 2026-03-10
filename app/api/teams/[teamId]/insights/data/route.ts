import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ReviewRow {
  rating: number
  comment: string | null
  review_date: string
  reply_status: string
  replied_at: string | null
  location_id: string
}

interface LocationInfo {
  id: string
  name: string
}

function computeTeamAnalytics(
  reviews: ReviewRow[],
  locations: LocationInfo[],
  periodStart: string,
  periodEnd: string,
) {
  const repliedStatuses = ['posted', 'synced_external']

  if (reviews.length === 0) {
    return {
      kpis: {
        totalReviews: 0,
        averageRating: 0,
        responseRate: 0,
        averageResponseTimeHours: null,
        positivePercent: 0,
        negativePercent: 0,
        locationCount: locations.length,
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
      perLocation: [],
      replyGap: [],
      reviewVelocity: { heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)), peakDay: 'Mon', peakHour: 12 },
    }
  }

  const totalReviews = reviews.length
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
  const repliedReviews = reviews.filter(r => repliedStatuses.includes(r.reply_status))
  const responseRate = (repliedReviews.length / totalReviews) * 100

  const responseTimes = repliedReviews
    .filter(r => r.replied_at)
    .map(r => {
      const reviewDate = new Date(r.review_date).getTime()
      const replyDate = new Date(r.replied_at!).getTime()
      return (replyDate - reviewDate) / (1000 * 60 * 60)
    })
    .filter(h => h >= 0 && h < 8760)
  const averageResponseTimeHours = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null

  const positive = reviews.filter(r => r.rating >= 4).length
  const neutral = reviews.filter(r => r.rating === 3).length
  const negative = reviews.filter(r => r.rating <= 2).length

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
  }))

  // Per-location breakdown
  const locationMap = new Map(locations.map(l => [l.id, l.name]))

  // Monthly time series
  const monthBuckets = new Map<string, ReviewRow[]>()
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    monthBuckets.set(key, [])
    cursor.setMonth(cursor.getMonth() + 1)
  }
  for (const r of reviews) {
    const d = new Date(r.review_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthBuckets.has(key)) monthBuckets.get(key)!.push(r)
  }
  const sortedMonths = [...monthBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const ratingOverTime = sortedMonths.map(([month, bucket]) => {
    const data: any = {
      month,
      averageRating: bucket.length > 0
        ? Math.round((bucket.reduce((s, r) => s + r.rating, 0) / bucket.length) * 100) / 100
        : null,
      count: bucket.length,
    }

    // Per-location
    for (const loc of locations) {
      const locReviews = bucket.filter(r => r.location_id === loc.id)
      data[loc.name] = locReviews.length > 0
        ? Math.round((locReviews.reduce((s, r) => s + r.rating, 0) / locReviews.length) * 100) / 100
        : null
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

  const responseRateOverTime = sortedMonths.map(([month, bucket]) => {
    const replied = bucket.filter(r => repliedStatuses.includes(r.reply_status)).length
    const data: any = {
      month,
      rate: bucket.length > 0 ? Math.round((replied / bucket.length) * 10000) / 100 : null,
      replied,
      total: bucket.length,
    }

    // Per-location
    for (const loc of locations) {
      const locReviews = bucket.filter(r => r.location_id === loc.id)
      const locReplied = locReviews.filter(r => repliedStatuses.includes(r.reply_status)).length
      data[loc.name] = locReviews.length > 0
        ? Math.round((locReplied / locReviews.length) * 10000) / 100
        : null
    }
    return data
  })

  const perLocationMap = new Map<string, ReviewRow[]>()
  for (const r of reviews) {
    if (!perLocationMap.has(r.location_id)) perLocationMap.set(r.location_id, [])
    perLocationMap.get(r.location_id)!.push(r)
  }

  const perLocation = [...perLocationMap.entries()].map(([locId, locReviews]) => {
    const locReplied = locReviews.filter(r => repliedStatuses.includes(r.reply_status))
    return {
      locationId: locId,
      locationName: locationMap.get(locId) || 'Unknown',
      totalReviews: locReviews.length,
      averageRating: Math.round((locReviews.reduce((s, r) => s + r.rating, 0) / locReviews.length) * 100) / 100,
      responseRate: Math.round((locReplied.length / locReviews.length) * 10000) / 100,
    }
  }).sort((a, b) => b.totalReviews - a.totalReviews)

  // Reply gap — unanswered reviews with rating <= 3
  const unanswered = reviews.filter(r =>
    !['posted', 'synced_external', 'dismissed'].includes(r.reply_status) && r.rating <= 3
  )

  const replyGap = unanswered
    .map(r => ({
      reviewDate: r.review_date,
      rating: r.rating,
      comment: r.comment?.slice(0, 120) || null,
      daysSince: Math.floor((Date.now() - new Date(r.review_date).getTime()) / (1000 * 60 * 60 * 24)),
      locationId: r.location_id || null,
      locationName: r.location_id ? (locationMap.get(r.location_id) || null) : null,
    }))
    .sort((a, b) => a.rating - b.rating || b.daysSince - a.daysSince)
    .slice(0, 20)

  // Review velocity — day-of-week × hour-of-day heatmap
  const velocityMap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const r of reviews) {
    const d = new Date(r.review_date)
    velocityMap[d.getUTCDay()][d.getUTCHours()]++
  }

  const dayTotals = velocityMap.map(row => row.reduce((s, v) => s + v, 0))
  const hourTotals = velocityMap.reduce((totals, row) => row.map((v, h) => totals[h] + v), Array(24).fill(0) as number[])

  const reviewVelocity = {
    heatmap: velocityMap,
    peakDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      dayTotals.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0)
    ],
    peakHour: hourTotals.reduce((maxH, v, h, arr) => v > arr[maxH] ? h : maxH, 0),
  }

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
      locationCount: locations.length,
    },
    ratingOverTime,
    volumeOverTime,
    responseRateOverTime,
    ratingDistribution,
    sentimentBreakdown: { positive, neutral, negative },
    perLocation,
    replyGap,
    reviewVelocity,
  }
}

function computeLocationAnalytics(reviews: Omit<ReviewRow, 'location_id'>[], periodStart: string, periodEnd: string) {
  const repliedStatuses = ['posted', 'synced_external']

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
      replyGap: [],
      reviewVelocity: { heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)), peakDay: 'Mon', peakHour: 12 },
    }
  }

  const totalReviews = reviews.length
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
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

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
  }))

  // Group reviews by month for time series
  const monthBuckets = new Map<string, Omit<ReviewRow, 'location_id'>[]>()
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
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

  // Reply gap — unanswered reviews with rating <= 3
  const unanswered = reviews.filter(r =>
    !['posted', 'synced_external', 'dismissed'].includes(r.reply_status) && r.rating <= 3
  )

  const replyGap = unanswered
    .map(r => ({
      reviewDate: r.review_date,
      rating: r.rating,
      comment: r.comment?.slice(0, 120) || null,
      daysSince: Math.floor((Date.now() - new Date(r.review_date).getTime()) / (1000 * 60 * 60 * 24)),
      locationId: null,
      locationName: null,
    }))
    .sort((a, b) => a.rating - b.rating || b.daysSince - a.daysSince)
    .slice(0, 20)

  // Review velocity — day-of-week × hour-of-day heatmap
  const velocityMap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const r of reviews) {
    const d = new Date(r.review_date)
    velocityMap[d.getUTCDay()][d.getUTCHours()]++
  }

  const dayTotals = velocityMap.map(row => row.reduce((s, v) => s + v, 0))
  const hourTotals = velocityMap.reduce((totals, row) => row.map((v, h) => totals[h] + v), Array(24).fill(0) as number[])

  const reviewVelocity = {
    heatmap: velocityMap,
    peakDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      dayTotals.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0)
    ],
    peakHour: hourTotals.reduce((maxH, v, h, arr) => v > arr[maxH] ? h : maxH, 0),
  }

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
    replyGap,
    reviewVelocity,
  }
}

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get('period_start')
    const periodEnd = searchParams.get('period_end')
    const locationParam = searchParams.get('location')

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceRoleClient()

    // Location-scoped path
    if (locationParam) {
      // Verify the location belongs to this team
      const { data: location, error: locError } = await supabase
        .schema('app')
        .from('locations')
        .select('id, name')
        .eq('id', locationParam)
        .eq('team_id', params.teamId)
        .single()

      if (locError || !location) {
        return NextResponse.json({ error: 'Location not found in this team' }, { status: 404 })
      }

      const { data: reviews, error } = await supabase
        .schema('app')
        .from('google_reviews')
        .select('rating, comment, review_date, reply_status, replied_at')
        .eq('location_id', locationParam)
        .gte('review_date', periodStart)
        .lte('review_date', periodEnd)
        .order('review_date', { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch reviews: ${error.message}`)
      }

      const analytics = computeLocationAnalytics(reviews || [], periodStart, periodEnd)

      return NextResponse.json({ analytics })
    }

    // Team-wide path
    const { data: locations } = await supabase
      .schema('app')
      .from('locations')
      .select('id, name')
      .eq('team_id', params.teamId)

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        analytics: computeTeamAnalytics([], [], periodStart, periodEnd),
      })
    }

    const locationIds = locations.map(l => l.id)

    const { data: reviews, error } = await supabase
      .schema('app')
      .from('google_reviews')
      .select('rating, comment, review_date, reply_status, replied_at, location_id')
      .in('location_id', locationIds)
      .gte('review_date', periodStart)
      .lte('review_date', periodEnd)
      .order('review_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`)
    }

    const analytics = computeTeamAnalytics(reviews || [], locations, periodStart, periodEnd)

    return NextResponse.json({ analytics })
  } catch (error: any) {
    if (error.message === 'Not a team member') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
