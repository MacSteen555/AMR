import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { insightsRun } from '@/lib/openai/insights'
import { spendCredits } from '@/lib/billing/credits'
import { runInsightsSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'
import crypto from 'crypto'

const CREDIT_COST: Record<string, number> = { '30d': 3, '90d': 4, '6m': 7, '1y': 10 }

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

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const body = await request.json()
    const { period_window: periodWindow } = runInsightsSchema.parse(body)

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location')

    const serviceClient = createSupabaseServiceRoleClient()

    // Compute date ranges
    const now = new Date()
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

    // Credit cost for the chosen period
    const creditCost = CREDIT_COST[periodWindow]

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

      await spendCredits(
        params.teamId,
        user.id,
        'insight_run',
        creditCost,
        'location',
        locationId,
        idempotencyKey,
        { feature: 'insights' }
      )

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

      return NextResponse.json({ insight: insertedInsight }, { status: 201 })
    }

    // Team-wide run
    await spendCredits(
      params.teamId,
      user.id,
      'insight_run',
      creditCost,
      'team',
      params.teamId,
      idempotencyKey,
      { feature: 'insights' }
    )

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

    return NextResponse.json({ insight: insertedInsight }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error.message.includes('Insufficient credits') || error.message.includes('not enabled')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
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
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}
