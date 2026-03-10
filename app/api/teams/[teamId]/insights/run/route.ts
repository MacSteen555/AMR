import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { insightsRun } from '@/lib/openai/insights'
import { spendCredits } from '@/lib/billing/credits'
import { runInsightsSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const body = await request.json()
    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    const absoluteStart = oneYearAgo.toISOString().split('T')[0]
    const absoluteEnd = now.toISOString().split('T')[0]

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location')

    const serviceClient = createSupabaseServiceRoleClient()

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
        3,
        'location',
        locationId,
        idempotencyKey,
        { feature: 'insights' }
      )

      // Get reviews for this location only
      const { data: reviews } = await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .eq('location_id', locationId)
        .gte('review_date', absoluteStart)
        .lte('review_date', absoluteEnd)

      const periods = [
        { key: '30d', subDays: 30 },
        { key: '90d', subDays: 90 },
        { key: '6m', subMonths: 6 },
        { key: '1y', subYears: 1 }
      ]

      const runs = periods.map(async (period) => {
        const pStart = new Date(now)
        if (period.subDays) pStart.setDate(pStart.getDate() - period.subDays)
        if (period.subMonths) pStart.setMonth(pStart.getMonth() - period.subMonths)
        if (period.subYears) pStart.setFullYear(pStart.getFullYear() - period.subYears)

        const periodStartStr = pStart.toISOString().split('T')[0]
        const periodReviews = (reviews || []).filter((r: any) => new Date(r.review_date) >= pStart)

        const insightsData = await insightsRun({
          reviews: periodReviews.map((r: any) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            review_date: r.review_date,
            reply_status: r.reply_status,
            reviewer_name: r.reviewer_name,
          })),
          periodStart: periodStartStr,
          periodEnd: absoluteEnd,
          scope: 'location',
          locationName: loc.name,
          periodWindow: period.key as any,
        })

        return {
          period_window: period.key,
          period_start: periodStartStr,
          period_end: absoluteEnd,
          insightsData
        }
      })

      const results = await Promise.all(runs)

      const insertData = results.map(r => ({
        team_id: null,
        location_id: locationId,
        period_start: r.period_start,
        period_end: r.period_end,
        period_window: r.period_window,
        kind: 'standard',
        data: r.insightsData,
        generated_by_user_id: user.id,
        model: 'gpt-5-mini',
      }))

      const { data: insertedInsights, error } = await serviceClient
        .schema('app')
        .from('insights')
        .insert(insertData)
        .select()

      if (error || !insertedInsights) {
        throw new Error(`Failed to save insights: ${error?.message}`)
      }

      return NextResponse.json({ insights: insertedInsights }, { status: 201 })
    }

    // Team-wide run (original behavior)
    await spendCredits(
      params.teamId,
      user.id,
      'insight_run',
      3,
      'team',
      params.teamId,
      idempotencyKey,
      { feature: 'insights' }
    )

    // Get all reviews for team locations in period
    const { data: locations } = await serviceClient
      .schema('app')
      .from('locations')
      .select('id')
      .eq('team_id', params.teamId)

    const locationIds = (locations || []).map(l => l.id)

    const { data: reviews } = locationIds.length > 0
      ? await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('id, rating, comment, review_date, reply_status, reviewer_name')
        .in('location_id', locationIds)
        .gte('review_date', absoluteStart)
        .lte('review_date', absoluteEnd)
      : { data: [] }

    // Define periods to run concurrently
    const periods = [
      { key: '30d', subDays: 30 },
      { key: '90d', subDays: 90 },
      { key: '6m', subMonths: 6 },
      { key: '1y', subYears: 1 }
    ]

    const runs = periods.map(async (period) => {
      const pStart = new Date(now)
      if (period.subDays) pStart.setDate(pStart.getDate() - period.subDays)
      if (period.subMonths) pStart.setMonth(pStart.getMonth() - period.subMonths)
      if (period.subYears) pStart.setFullYear(pStart.getFullYear() - period.subYears)

      const periodStartStr = pStart.toISOString().split('T')[0]

      // Filter reviews memory-side for this period
      const periodReviews = (reviews || []).filter((r: any) => new Date(r.review_date) >= pStart)

      const insightsData = await insightsRun({
        reviews: periodReviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          review_date: r.review_date,
          reply_status: r.reply_status,
          reviewer_name: r.reviewer_name,
        })),
        periodStart: periodStartStr,
        periodEnd: absoluteEnd,
        scope: 'team',
        periodWindow: period.key as any,
      })

      return {
        period_window: period.key,
        period_start: periodStartStr,
        period_end: absoluteEnd,
        insightsData
      }
    })

    const results = await Promise.all(runs)

    const insertData = results.map(r => ({
      team_id: params.teamId,
      location_id: null,
      period_start: r.period_start,
      period_end: r.period_end,
      period_window: r.period_window,
      kind: 'standard',
      data: r.insightsData,
      generated_by_user_id: user.id,
      model: 'gpt-5-mini',
    }))

    // Save insights concurrently into 4 rows
    const { data: insertedInsights, error } = await serviceClient
      .schema('app')
      .from('insights')
      .insert(insertData)
      .select()

    if (error || !insertedInsights) {
      throw new Error(`Failed to save insights: ${error?.message}`)
    }

    return NextResponse.json({ insights: insertedInsights }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error.message.includes('Insufficient credits') || error.message.includes('not enabled')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
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
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}
