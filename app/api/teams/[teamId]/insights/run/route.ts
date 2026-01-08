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
    const data = runInsightsSchema.parse(body)

    // Spend credits (requires PRO/ENTERPRISE)
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

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get all reviews for team locations in period
    const { data: reviews } = await supabase
      .from('app.google_reviews')
      .select('rating, comment, review_date, location:locations!inner(team_id, name)')
      .eq('locations.team_id', params.teamId)
      .gte('review_date', data.period_start)
      .lte('review_date', data.period_end)

    // Generate insights
    const insightsData = await insightsRun({
      reviews: (reviews || []).map((r: any) => ({
        rating: r.rating,
        comment: r.comment,
        review_date: r.review_date,
      })),
      periodStart: data.period_start,
      periodEnd: data.period_end,
    })

    // Save insights
    const { data: insight, error } = await serviceClient
      .from('app.insights')
      .insert({
        team_id: params.teamId,
        location_id: null,
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

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: insights } = await supabase
      .from('app.insights')
      .select('*')
      .eq('team_id', params.teamId)
      .is('location_id', null)
      .order('generated_at', { ascending: false })

    return NextResponse.json({ insights: insights || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

