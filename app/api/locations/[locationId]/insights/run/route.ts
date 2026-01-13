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

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get reviews for location in period
    const { data: reviews } = await supabase
      .schema('app')
      .from('google_reviews')
      .select('rating, comment, review_date')
      .eq('location_id', params.locationId)
      .gte('review_date', data.period_start)
      .lte('review_date', data.period_end)

    // Get location name
    const { data: loc } = await supabase
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
        kind: 'standard',
        data: insightsData,
        generated_by_user_id: user.id,
        model: 'gpt-4.1-nano',
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

    const { data: insights } = await supabase
      .schema('app')
      .from('insights')
      .select('*')
      .eq('location_id', params.locationId)
      .order('generated_at', { ascending: false })

    return NextResponse.json({ insights: insights || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

