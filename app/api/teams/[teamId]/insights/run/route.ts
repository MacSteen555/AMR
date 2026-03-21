import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { insightsRun, insightsRunUnified } from '@/lib/openai/insights'
import { runInsightsSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'

const REPORT_LIMITS: Record<string, number> = { FREE: 0, PRO: 3, BUSINESS: 10, ENTERPRISE: 20 }

const FETCH_WINDOWS: Record<string, { current: number; previous: number; unit: 'days' | 'months' }> = {
  '30d': { current: 30, previous: 30, unit: 'days' },
  '90d': { current: 90, previous: 90, unit: 'days' },
  '6m': { current: 6, previous: 6, unit: 'months' },
  '1y': { current: 12, previous: 0, unit: 'months' },
}

function subtractFromDate(date: Date, amount: number, unit: 'days' | 'months'): Date {
  const result = new Date(date)
  if (unit === 'days') {
    result.setDate(result.getDate() - amount)
  } else {
    result.setMonth(result.getMonth() - amount)
  }
  return result
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Compute the adaptive window for recent trends.
 * Starts at 30 days, widens to 60, then 90 until both
 * current and previous periods have at least 1 review.
 * Max window: 90 days.
 */
function computeAdaptiveWindow(
  reviews: Array<{ review_date: string }>,
  now: Date
): { windowDays: number; currentStart: Date; previousStart: Date; previousEnd: Date } {
  for (const windowDays of [30, 60, 90]) {
    const currentStart = subtractFromDate(now, windowDays, 'days')
    const previousEnd = currentStart
    const previousStart = subtractFromDate(currentStart, windowDays, 'days')

    const currentCount = reviews.filter(r => {
      const d = new Date(r.review_date)
      return d >= currentStart && d <= now
    }).length

    const previousCount = reviews.filter(r => {
      const d = new Date(r.review_date)
      return d >= previousStart && d < previousEnd
    }).length

    if (currentCount > 0 && previousCount > 0) {
      return { windowDays, currentStart, previousStart, previousEnd }
    }
  }

  // Fallback: use 90 days even without comparison data
  const currentStart = subtractFromDate(now, 90, 'days')
  const previousEnd = currentStart
  const previousStart = subtractFromDate(currentStart, 90, 'days')
  return { windowDays: 90, currentStart, previousStart, previousEnd }
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const user = await requireUser()
    await requireTeamMember(params.teamId)

    const body = await request.json()
    const { period_window: periodWindow } = runInsightsSchema.parse(body)

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location')

    const serviceClient = createSupabaseServiceRoleClient()

    // Check tier and report limit
    const { data: subscription } = await serviceClient
      .schema('app').from('team_subscriptions')
      .select('tier')
      .eq('team_id', params.teamId)
      .single()

    const tierName = (subscription?.tier as string) || 'FREE'
    const limit = REPORT_LIMITS[tierName] ?? 0

    if (limit === 0) {
      return NextResponse.json({ error: 'Reports are not available on the FREE tier' }, { status: 402 })
    }

    const { data: balanceRow } = await serviceClient
      .schema('app').from('team_credit_balances')
      .select('reports_generated')
      .eq('team_id', params.teamId)
      .single()

    const currentCount = balanceRow?.reports_generated || 0
    if (currentCount >= limit) {
      return NextResponse.json({ error: `Monthly report limit reached (${currentCount}/${limit})` }, { status: 402 })
    }

    // Compute date ranges
    const now = new Date()

    // Handle 'unified' — single unified report with adaptive window
    if (periodWindow === 'unified') {
      // Get location info if location-scoped
      let locationName: string | null = null
      if (locationId) {
        const { data: loc, error: locError } = await serviceClient
          .schema('app').from('locations').select('id, name, team_id')
          .eq('id', locationId).eq('team_id', params.teamId).single()
        if (locError || !loc) {
          return NextResponse.json({ error: 'Location not found' }, { status: 404 })
        }
        locationName = loc.name
      }

      // Get team name
      const { data: team } = await serviceClient
        .schema('app').from('teams').select('name')
        .eq('id', params.teamId).single()
      const teamName = team?.name || null

      // Fetch ALL reviews for the scope
      let reviewQuery = serviceClient.schema('app').from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .order('review_date', { ascending: false })

      if (locationId) {
        reviewQuery = reviewQuery.eq('location_id', locationId)
      } else {
        const { data: locs } = await serviceClient.schema('app').from('locations').select('id').eq('team_id', params.teamId)
        const locIds = (locs || []).map(l => l.id)
        if (locIds.length > 0) {
          reviewQuery = reviewQuery.in('location_id', locIds)
        } else {
          return NextResponse.json({ insights: [] })
        }
      }

      const { data: reviews } = await reviewQuery
      const allReviews = (reviews || []).map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment,
        review_date: r.review_date, reply_status: r.reply_status, reviewer_name: r.reviewer_name,
      }))

      // Compute adaptive window for recent trends
      const { windowDays, currentStart, previousStart, previousEnd } = computeAdaptiveWindow(allReviews, now)

      const recentReviews = allReviews.filter(r => {
        const d = new Date(r.review_date)
        return d >= currentStart && d <= now
      })
      const previousReviews = allReviews.filter(r => {
        const d = new Date(r.review_date)
        return d >= previousStart && d < previousEnd
      })

      const insightsData = await insightsRunUnified({
        reviews: recentReviews,
        previousReviews,
        allReviews,
        adaptiveWindowDays: windowDays,
        periodStart: toDateStr(currentStart),
        periodEnd: toDateStr(now),
        previousPeriodStart: toDateStr(previousStart),
        previousPeriodEnd: toDateStr(previousEnd),
        scope: locationId ? 'location' : 'team',
        locationName: locationName || undefined,
        teamName: teamName || undefined,
        periodWindow: 'unified',
      })

      const { data: insertedInsight, error } = await serviceClient
        .schema('app')
        .from('insights')
        .insert({
          team_id: locationId ? null : params.teamId,
          location_id: locationId || null,
          period_start: toDateStr(currentStart),
          period_end: toDateStr(now),
          period_window: 'unified',
          kind: 'unified',
          data: insightsData,
          generated_by_user_id: user.id,
          model: 'gpt-5-mini',
        })
        .select()
        .single()

      if (error || !insertedInsight) {
        throw new Error(`Failed to save insights: ${error?.message}`)
      }

      // Increment reports_generated counter
      const { data: latest } = await serviceClient
        .schema('app').from('team_credit_balances')
        .select('reports_generated')
        .eq('team_id', params.teamId)
        .single()
      await serviceClient
        .schema('app').from('team_credit_balances')
        .update({ reports_generated: (latest?.reports_generated || 0) + 1 })
        .eq('team_id', params.teamId)

      return NextResponse.json({ insight: insertedInsight }, { status: 201 })
    }

    // Handle 'all' — generate all 4 periods concurrently, costs 1 report credit
    if (periodWindow === 'all') {
      // Get location info if location-scoped
      let locationName: string | null = null
      if (locationId) {
        const { data: loc, error: locError } = await serviceClient
          .schema('app').from('locations').select('id, name, team_id')
          .eq('id', locationId).eq('team_id', params.teamId).single()
        if (locError || !loc) {
          return NextResponse.json({ error: 'Location not found' }, { status: 404 })
        }
        locationName = loc.name
      }

      // Fetch all reviews from 1 year ago (covers all periods)
      const oneYearAgo = new Date(now)
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      let reviewQuery = serviceClient.schema('app').from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .gte('review_date', toDateStr(oneYearAgo)).lte('review_date', toDateStr(now))

      if (locationId) {
        reviewQuery = reviewQuery.eq('location_id', locationId)
      } else {
        const { data: locs } = await serviceClient.schema('app').from('locations').select('id').eq('team_id', params.teamId)
        const locIds = (locs || []).map(l => l.id)
        if (locIds.length > 0) {
          reviewQuery = reviewQuery.in('location_id', locIds)
        } else {
          return NextResponse.json({ insights: [] })
        }
      }

      const { data: reviews } = await reviewQuery
      const allReviews = (reviews || []).map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment,
        review_date: r.review_date, reply_status: r.reply_status, reviewer_name: r.reviewer_name,
      }))

      // Run all 4 periods concurrently
      const periods = [
        { key: '30d' as const, current: 30, previous: 30, unit: 'days' as const },
        { key: '90d' as const, current: 90, previous: 90, unit: 'days' as const },
        { key: '6m' as const, current: 6, previous: 6, unit: 'months' as const },
        { key: '1y' as const, current: 12, previous: 0, unit: 'months' as const },
      ]

      const runs = periods.map(async (p) => {
        const cStart = subtractFromDate(now, p.current, p.unit)
        const pStart = p.previous > 0 ? subtractFromDate(cStart, p.previous, p.unit) : cStart

        const currentReviews = allReviews.filter(r => new Date(r.review_date) >= cStart)
        const previousReviews = p.previous > 0
          ? allReviews.filter(r => new Date(r.review_date) >= pStart && new Date(r.review_date) < cStart)
          : []

        const data = await insightsRun({
          reviews: currentReviews,
          previousReviews: p.key === '1y' ? undefined : previousReviews,
          periodStart: toDateStr(cStart),
          periodEnd: toDateStr(now),
          previousPeriodStart: toDateStr(pStart),
          previousPeriodEnd: toDateStr(cStart),
          scope: locationId ? 'location' : 'team',
          locationName: locationName || undefined,
          periodWindow: p.key,
        })

        return { period_window: p.key, period_start: toDateStr(cStart), period_end: toDateStr(now), data }
      })

      const results = await Promise.all(runs)

      const insertData = results.map(r => ({
        team_id: locationId ? null : params.teamId,
        location_id: locationId || null,
        period_start: r.period_start,
        period_end: r.period_end,
        period_window: r.period_window,
        kind: 'standard',
        data: r.data,
        generated_by_user_id: user.id,
        model: 'gpt-5-mini',
      }))

      const { data: inserted, error } = await serviceClient.schema('app').from('insights').insert(insertData).select()
      if (error) throw new Error(`Failed to save insights: ${error.message}`)

      // Increment reports_generated by 1 (all 4 periods = 1 report credit)
      const { data: latest } = await serviceClient
        .schema('app').from('team_credit_balances')
        .select('reports_generated')
        .eq('team_id', params.teamId)
        .single()
      await serviceClient
        .schema('app').from('team_credit_balances')
        .update({ reports_generated: (latest?.reports_generated || 0) + 1 })
        .eq('team_id', params.teamId)

      return NextResponse.json({ insights: inserted }, { status: 201 })
    }

    const window = FETCH_WINDOWS[periodWindow]
    const currentEnd = now
    const currentStart = subtractFromDate(now, window.current, window.unit)
    const previousEnd = currentStart
    const previousStart = window.previous > 0 ? subtractFromDate(currentStart, window.previous, window.unit) : currentStart

    const currentEndStr = toDateStr(currentEnd)
    const currentStartStr = toDateStr(currentStart)
    const previousEndStr = toDateStr(previousEnd)
    const previousStartStr = toDateStr(previousStart)

    // The earliest date we need to fetch reviews from
    const fetchStart = window.previous > 0 ? previousStartStr : currentStartStr

    if (locationId) {
      // Location-scoped run
      const { data: loc, error: locError } = await serviceClient
        .schema('app')
        .from('locations')
        .select('id, name, team_id')
        .eq('id', locationId)
        .eq('team_id', params.teamId)
        .single()

      if (locError || !loc) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 })
      }

      // Get reviews for this location covering both current and previous periods
      const { data: reviews } = await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .eq('location_id', locationId)
        .gte('review_date', fetchStart)
        .lte('review_date', currentEndStr)

      const allReviews = (reviews || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        review_date: r.review_date,
        reply_status: r.reply_status,
        reviewer_name: r.reviewer_name,
      }))

      const currentReviews = allReviews.filter((r: any) => new Date(r.review_date) >= currentStart)
      const previousReviews = window.previous > 0
        ? allReviews.filter((r: any) => new Date(r.review_date) >= previousStart && new Date(r.review_date) < currentStart)
        : []

      const insightsData = await insightsRun({
        reviews: currentReviews,
        previousReviews: periodWindow === '1y' ? undefined : previousReviews,
        periodStart: currentStartStr,
        periodEnd: currentEndStr,
        previousPeriodStart: previousStartStr,
        previousPeriodEnd: previousEndStr,
        scope: 'location',
        locationName: loc.name,
        periodWindow: periodWindow,
      })

      const { data: insertedInsight, error } = await serviceClient
        .schema('app')
        .from('insights')
        .insert({
          team_id: null,
          location_id: locationId,
          period_start: currentStartStr,
          period_end: currentEndStr,
          period_window: periodWindow,
          kind: 'standard',
          data: insightsData,
          generated_by_user_id: user.id,
          model: 'gpt-5-mini',
        })
        .select()
        .single()

      if (error || !insertedInsight) {
        throw new Error(`Failed to save insights: ${error?.message}`)
      }

      // Increment reports_generated counter
      const { data: latest } = await serviceClient
        .schema('app').from('team_credit_balances')
        .select('reports_generated')
        .eq('team_id', params.teamId)
        .single()
      await serviceClient
        .schema('app').from('team_credit_balances')
        .update({ reports_generated: (latest?.reports_generated || 0) + 1 })
        .eq('team_id', params.teamId)

      return NextResponse.json({ insight: insertedInsight }, { status: 201 })
    }

    // Team-wide run
    // Get all locations for this team
    const { data: locations } = await serviceClient
      .schema('app')
      .from('locations')
      .select('id')
      .eq('team_id', params.teamId)

    const locationIds = (locations || []).map(l => l.id)

    // Get reviews covering both current and previous periods
    const { data: reviews } = locationIds.length > 0
      ? await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .in('location_id', locationIds)
        .gte('review_date', fetchStart)
        .lte('review_date', currentEndStr)
      : { data: [] }

    const allReviews = (reviews || []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      review_date: r.review_date,
      reply_status: r.reply_status,
      reviewer_name: r.reviewer_name,
    }))

    const currentReviews = allReviews.filter((r: any) => new Date(r.review_date) >= currentStart)
    const previousReviews = window.previous > 0
      ? allReviews.filter((r: any) => new Date(r.review_date) >= previousStart && new Date(r.review_date) < currentStart)
      : []

    const insightsData = await insightsRun({
      reviews: currentReviews,
      previousReviews: periodWindow === '1y' ? undefined : previousReviews,
      periodStart: currentStartStr,
      periodEnd: currentEndStr,
      previousPeriodStart: previousStartStr,
      previousPeriodEnd: previousEndStr,
      scope: 'team',
      periodWindow: periodWindow,
    })

    const { data: insertedInsight, error } = await serviceClient
      .schema('app')
      .from('insights')
      .insert({
        team_id: params.teamId,
        location_id: null,
        period_start: currentStartStr,
        period_end: currentEndStr,
        period_window: periodWindow,
        kind: 'standard',
        data: insightsData,
        generated_by_user_id: user.id,
        model: 'gpt-5-mini',
      })
      .select()
      .single()

    if (error || !insertedInsight) {
      throw new Error(`Failed to save insights: ${error?.message}`)
    }

    // Increment reports_generated counter
    await serviceClient
      .schema('app').from('team_credit_balances')
      .update({ reports_generated: currentCount + 1 })
      .eq('team_id', params.teamId)

    return NextResponse.json({ insight: insertedInsight }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/insights/run', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const periodWindow = searchParams.get('period_window')
    const locationId = searchParams.get('location')
    const scopeAll = searchParams.get('scope') === 'all'

    if (locationId) {
      // Location-scoped: query by location_id
      let query = supabase
        .schema('app')
        .from('insights')
        .select('*')
        .eq('location_id', locationId)
        .order('generated_at', { ascending: false })

      if (periodWindow) {
        query = query.eq('period_window', periodWindow)
      }

      const { data: insights } = await query

      return NextResponse.json({ insights: insights || [] })
    }

    if (scopeAll) {
      // Return ALL insights for the team: team-wide + per-location
      const serviceClient = createSupabaseServiceRoleClient()

      const { data: locations } = await serviceClient
        .schema('app')
        .from('locations')
        .select('id')
        .eq('team_id', params.teamId)

      const locationIds = (locations || []).map(l => l.id)

      // Team-wide insights
      let teamQuery = supabase
        .schema('app')
        .from('insights')
        .select('*')
        .eq('team_id', params.teamId)
        .is('location_id', null)
        .order('generated_at', { ascending: false })

      if (periodWindow) {
        teamQuery = teamQuery.eq('period_window', periodWindow)
      }

      const { data: teamInsights } = await teamQuery

      // Per-location insights
      let locationInsights: any[] = []
      if (locationIds.length > 0) {
        let locQuery = supabase
          .schema('app')
          .from('insights')
          .select('*')
          .in('location_id', locationIds)
          .order('generated_at', { ascending: false })

        if (periodWindow) {
          locQuery = locQuery.eq('period_window', periodWindow)
        }

        const { data: locInsights } = await locQuery
        locationInsights = locInsights || []
      }

      return NextResponse.json({ insights: [...(teamInsights || []), ...locationInsights] })
    }

    // Default: team-wide only (location_id IS NULL)
    let query = supabase
      .schema('app')
      .from('insights')
      .select('*')
      .eq('team_id', params.teamId)
      .is('location_id', null)
      .order('generated_at', { ascending: false })

    if (periodWindow) {
      query = query.eq('period_window', periodWindow)
    }

    const { data: insights } = await query

    return NextResponse.json({ insights: insights || [] })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/insights/run', teamId: params?.teamId })
    if (error.message === 'Not a team member') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
