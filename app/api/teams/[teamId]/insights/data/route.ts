import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

function extractKeywordThemes(
  reviews: Array<{ comment: string | null; rating: number; review_date: string }>,
  periodStart: string,
  periodEnd: string,
): Array<{ theme: string; count: number; avgRating: number; trend: 'up' | 'down' | 'stable' }> {
  const STOP_WORDS = new Set([
    'the','a','an','is','was','were','are','been','be','have','has','had','do','does','did',
    'will','would','could','should','may','might','shall','can','need','dare','ought','used',
    'to','of','in','for','on','with','at','by','from','as','into','through','during','before',
    'after','above','below','between','out','off','over','under','again','further','then','once',
    'here','there','when','where','why','how','all','both','each','few','more','most','other',
    'some','such','no','nor','not','only','own','same','so','than','too','very','just','because',
    'but','and','or','if','while','about','up','it','its','i','my','me','we','our','you','your',
    'they','their','them','he','she','his','her','this','that','these','those','what','which',
    'who','whom','get','got','really','also','much','even','back','still','well','way','like',
    'one','two','three','go','going','went','come','came','make','made','know','say','said',
    'take','took','see','saw','think','thought','give','gave','tell','told','good','great',
    'nice','bad','place','time','always','never','every','been','being','would','could',
  ])

  const themeMap = new Map<string, { count: number; ratings: number[]; dates: Date[] }>()

  for (const r of reviews) {
    if (!r.comment) continue
    const words = r.comment.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      if (!themeMap.has(bigram)) themeMap.set(bigram, { count: 0, ratings: [], dates: [] })
      const entry = themeMap.get(bigram)!
      entry.count++
      entry.ratings.push(r.rating)
      entry.dates.push(new Date(r.review_date))
    }
  }

  const midDate = new Date((new Date(periodStart).getTime() + new Date(periodEnd).getTime()) / 2)

  return [...themeMap.entries()]
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([theme, v]) => {
      const avgRating = v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
      const firstHalf = v.dates.filter(d => d < midDate).length
      const secondHalf = v.dates.filter(d => d >= midDate).length
      const trend: 'up' | 'down' | 'stable' =
        secondHalf > firstHalf * 1.3 ? 'up' :
        secondHalf < firstHalf * 0.7 ? 'down' : 'stable'
      return { theme, count: v.count, avgRating: Math.round(avgRating * 10) / 10, trend }
    })
}

interface ReviewRow {
  rating: number
  comment: string | null
  review_date: string
  reply_status: string
  replied_at: string | null
  location_id: string
  reviewer_name: string | null
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
        sentimentMomentum: null,
        anonymousRatio: 0,
        anonymousNegativeCount: 0,
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
      keywordThemes: [],
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

  const keywordThemes = extractKeywordThemes(reviews, periodStart, periodEnd)

  // Sentiment momentum — compare first-half avg rating to second-half
  const midDate = new Date((new Date(periodStart).getTime() + new Date(periodEnd).getTime()) / 2)
  const firstHalfReviews = reviews.filter(r => new Date(r.review_date) < midDate)
  const secondHalfReviews = reviews.filter(r => new Date(r.review_date) >= midDate)

  const firstAvg = firstHalfReviews.length > 0 ? firstHalfReviews.reduce((s, r) => s + r.rating, 0) / firstHalfReviews.length : null
  const secondAvg = secondHalfReviews.length > 0 ? secondHalfReviews.reduce((s, r) => s + r.rating, 0) / secondHalfReviews.length : null

  const sentimentMomentum = firstAvg !== null && secondAvg !== null
    ? Math.round((secondAvg - firstAvg) * 100) / 100
    : null

  // Anonymous review ratio
  const anonymousReviews = reviews.filter(r => !r.reviewer_name || r.reviewer_name === 'Anonymous' || r.reviewer_name.trim() === '')
  const anonymousRatio = totalReviews > 0 ? Math.round((anonymousReviews.length / totalReviews) * 10000) / 100 : 0
  const anonymousNegativeCount = anonymousReviews.filter(r => r.rating <= 2).length

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
      sentimentMomentum,
      anonymousRatio,
      anonymousNegativeCount,
    },
    ratingOverTime,
    volumeOverTime,
    responseRateOverTime,
    ratingDistribution,
    sentimentBreakdown: { positive, neutral, negative },
    perLocation,
    replyGap,
    reviewVelocity,
    keywordThemes,
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
        sentimentMomentum: null,
        anonymousRatio: 0,
        anonymousNegativeCount: 0,
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
      keywordThemes: [],
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

  const keywordThemes = extractKeywordThemes(reviews, periodStart, periodEnd)

  // Sentiment momentum — compare first-half avg rating to second-half
  const midDate = new Date((new Date(periodStart).getTime() + new Date(periodEnd).getTime()) / 2)
  const firstHalfReviews = reviews.filter(r => new Date(r.review_date) < midDate)
  const secondHalfReviews = reviews.filter(r => new Date(r.review_date) >= midDate)

  const firstAvg = firstHalfReviews.length > 0 ? firstHalfReviews.reduce((s, r) => s + r.rating, 0) / firstHalfReviews.length : null
  const secondAvg = secondHalfReviews.length > 0 ? secondHalfReviews.reduce((s, r) => s + r.rating, 0) / secondHalfReviews.length : null

  const sentimentMomentum = firstAvg !== null && secondAvg !== null
    ? Math.round((secondAvg - firstAvg) * 100) / 100
    : null

  // Anonymous review ratio
  const anonymousReviews = reviews.filter(r => !r.reviewer_name || r.reviewer_name === 'Anonymous' || r.reviewer_name.trim() === '')
  const anonymousRatio = totalReviews > 0 ? Math.round((anonymousReviews.length / totalReviews) * 10000) / 100 : 0
  const anonymousNegativeCount = anonymousReviews.filter(r => r.rating <= 2).length

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
      sentimentMomentum,
      anonymousRatio,
      anonymousNegativeCount,
    },
    ratingOverTime,
    volumeOverTime,
    responseRateOverTime,
    ratingDistribution,
    sentimentBreakdown: { positive, neutral, negative },
    replyGap,
    reviewVelocity,
    keywordThemes,
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
        .select('rating, comment, review_date, reply_status, replied_at, reviewer_name')
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
      .select('rating, comment, review_date, reply_status, replied_at, location_id, reviewer_name')
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
    captureRouteError(error, { route: '/api/teams/[teamId]/insights/data', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
