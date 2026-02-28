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
    const data = runInsightsSchema.parse(body)

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
      .gte('review_date', data.period_start)
      .lte('review_date', data.period_end)

    // Get location name
    const { data: loc } = await serviceClient
      .schema('app')
      .from('locations')
      .select('name')
      .eq('id', params.locationId)
      .single()

    // Generate insights
    const insightsData = await insightsRun({
      reviews: (reviews || []).map((r) => ({
        rating: r.rating,
        comment: r.comment,
        review_date: r.review_date,
        reply_status: r.reply_status,
      })),
      periodStart: data.period_start,
      periodEnd: data.period_end,
      locationName: loc?.name || null,
    })

    // Save insights
    const { data: insight, error } = await serviceClient
      .schema('app')
      .from('insights')
      .insert({
        team_id: location.team_id,
        location_id: params.locationId,
        period_start: data.period_start,
        period_end: data.period_end,
        period_window: data.period_window || null,
        kind: 'standard',
        data: insightsData,
        generated_by_user_id: user.id,
        model: 'gpt-5-mini',
      })
      .select()
      .single()

    if (error || !insight) {
      throw new Error(`Failed to save insights: ${error?.message}`)
    }

    return NextResponse.json({ insight }, { status: 201 })
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

