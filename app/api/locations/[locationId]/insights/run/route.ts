import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { insightsRun } from '@/lib/openai/insights'
import { spendCredits } from '@/lib/billing/credits'
import { runInsightsSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
  try {
    const { location } = await requireLocationAccess(params.locationId)
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const body = await request.json()
    // Validation is empty since we auto-assign time bounds now
    runInsightsSchema.parse(body)

    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    const absoluteStart = oneYearAgo.toISOString().split('T')[0]
    const absoluteEnd = now.toISOString().split('T')[0]

    // Spend credits (requires PRO+ for single location insights)
    await spendCredits(
      location.team_id,
      user.id,
      'insight_run',
      3,
      'location',
      params.locationId,
      idempotencyKey,
      { feature: 'insights' }
    )

    const serviceClient = createSupabaseServiceRoleClient()

    // Get reviews for location in period
    const { data: reviews } = await serviceClient
      .schema('app')
      .from('google_reviews')
      .select('rating, comment, review_date, reply_status')
      .eq('location_id', params.locationId)
      .gte('review_date', absoluteStart)
      .lte('review_date', absoluteEnd)

    // Get location name
    const { data: loc } = await serviceClient
      .schema('app')
      .from('locations')
      .select('name')
      .eq('id', params.locationId)
      .single()

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
          rating: r.rating,
          comment: r.comment,
          review_date: r.review_date,
          reply_status: r.reply_status,
        })),
        periodStart: periodStartStr,
        periodEnd: absoluteEnd,
        locationName: loc?.name || null,
        scope: 'location',
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
      location_id: params.locationId,
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

export async function GET(request: Request, { params }: { params: { locationId: string } }) {
  try {
    await requireLocationAccess(params.locationId)
    const supabase = createSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const periodWindow = searchParams.get('period_window')

    let query = supabase
      .schema('app')
      .from('insights')
      .select('*')
      .eq('location_id', params.locationId)
      .order('generated_at', { ascending: false })

    if (periodWindow) {
      query = query.eq('period_window', periodWindow)
    }

    const { data: insights } = await query

    return NextResponse.json({ insights: insights || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

