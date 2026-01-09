import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { competitiveRun } from '@/lib/openai/insights'
import { spendCredits } from '@/lib/billing/credits'
import { createCompetitiveRunSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const body = await request.json()
    const data = createCompetitiveRunSchema.parse(body)

    // Spend credits (requires BUSINESS or higher)
    await spendCredits(
      params.teamId,
      user.id,
      'competitive_run',
      5,
      'team',
      params.teamId,
      idempotencyKey,
      { requiredTier: 'BUSINESS' }
    )

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get owned location reviews
    const { data: ownedLocations } = await supabase
      .from('app.locations')
      .select('id, name')
      .in('id', data.owned_location_ids)
      .eq('team_id', params.teamId)

    const ownedLocationReviews = await Promise.all(
      (ownedLocations || []).map(async (loc) => {
        const { data: reviews } = await supabase
          .from('app.google_reviews')
          .select('rating, comment')
          .eq('location_id', loc.id)
          .gte('review_date', data.period_start)
          .lte('review_date', data.period_end)

        return {
          name: loc.name,
          reviews: (reviews || []).map((r) => ({ rating: r.rating, comment: r.comment })),
        }
      })
    )

    // Get competitor reviews
    const { data: competitors } = await supabase
      .from('app.competitors')
      .select('id, name')
      .in('id', data.competitor_ids)
      .eq('team_id', params.teamId)

    const competitorReviews = await Promise.all(
      (competitors || []).map(async (comp) => {
        const { data: reviews } = await supabase
          .from('app.competitor_reviews')
          .select('rating, comment')
          .eq('competitor_id', comp.id)
          .gte('review_date', data.period_start)
          .lte('review_date', data.period_end)

        return {
          name: comp.name,
          reviews: (reviews || []).map((r) => ({ rating: r.rating, comment: r.comment })),
        }
      })
    )

    // Generate competitive analysis
    const analysisData = await competitiveRun({
      ownedLocations: ownedLocationReviews,
      competitors: competitorReviews,
      periodStart: data.period_start,
      periodEnd: data.period_end,
    })

    // Save competitive run
    const { data: run, error } = await serviceClient
      .from('app.competitive_runs')
      .insert({
        team_id: params.teamId,
        created_by_user_id: user.id,
        name: data.name || null,
        period_start: data.period_start,
        period_end: data.period_end,
        owned_location_ids: data.owned_location_ids,
        competitor_ids: data.competitor_ids,
        data: analysisData,
        model: 'gpt-4.1-nano',
      })
      .select()
      .single()

    if (error || !run) {
      throw new Error(`Failed to save competitive run: ${error?.message}`)
    }

    return NextResponse.json({ run }, { status: 201 })
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

    const { data: runs } = await supabase
      .from('app.competitive_runs')
      .select('*')
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ runs: runs || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

