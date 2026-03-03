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

    const timeframes = [
      { id: '30d', days: 30 },
      { id: '90d', days: 90 },
      { id: '6m', months: 6 },
      { id: '1y', years: 1 }
    ]

    const endStr = new Date().toISOString().split('T')[0]
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const maxStartStr = oneYearAgo.toISOString().split('T')[0]

    // Get owned location reviews
    const { data: ownedLocations } = await supabase
      .schema('app')
      .from('locations')
      .select('id, name')
      .in('id', data.owned_location_ids)
      .eq('team_id', params.teamId)

    const ownedLocationReviews = await Promise.all(
      (ownedLocations || []).map(async (loc) => {
        const { data: reviews } = await supabase
          .schema('app')
          .from('google_reviews')
          .select('rating, comment, review_date')
          .eq('location_id', loc.id)
          .gte('review_date', maxStartStr)
          .lte('review_date', endStr)
          .order('review_date', { ascending: false })
          .limit(400)

        return {
          name: loc.name,
          reviews: (reviews || []).map((r) => ({ rating: r.rating, comment: r.comment, date: r.review_date })),
        }
      })
    )

    // Get competitor reviews
    const { data: competitors } = await supabase
      .schema('app')
      .from('competitors')
      .select('id, name')
      .in('id', data.competitor_ids)
      .eq('team_id', params.teamId)

    const competitorReviews = await Promise.all(
      (competitors || []).map(async (comp) => {
        const { data: reviews } = await supabase
          .schema('app')
          .from('competitor_reviews')
          .select('rating, comment, review_date')
          .eq('competitor_id', comp.id)
          .gte('review_date', maxStartStr)
          .lte('review_date', endStr)
          .order('review_date', { ascending: false })
          .limit(400)

        return {
          name: comp.name,
          reviews: (reviews || []).map((r) => ({ rating: r.rating, comment: r.comment, date: r.review_date })),
        }
      })
    )

    // Generate competitive analysis for 4 timeframes concurrently
    const analysisData: Record<string, any> = {}

    await Promise.all(
      timeframes.map(async (tf) => {
        const start = new Date()
        if (tf.days) start.setDate(start.getDate() - tf.days)
        if (tf.months) start.setMonth(start.getMonth() - tf.months)
        if (tf.years) start.setFullYear(start.getFullYear() - tf.years)
        const startStr = start.toISOString().split('T')[0]

        // Filter out reviews before the specific timeframe
        const filterReviews = (rawReviews: any[]) => {
          return rawReviews
            .filter(r => r.date >= startStr)
            .slice(0, 100)
            .map(r => ({ rating: r.rating, comment: r.comment }))
        }

        const filteredOwned = ownedLocationReviews.map(loc => ({
          name: loc.name,
          reviews: filterReviews(loc.reviews)
        }))

        const filteredComp = competitorReviews.map(comp => ({
          name: comp.name,
          reviews: filterReviews(comp.reviews)
        }))

        // Run analysis for this duration
        analysisData[tf.id] = await competitiveRun({
          ownedLocations: filteredOwned,
          competitors: filteredComp,
          periodStart: startStr,
          periodEnd: endStr,
        })
      })
    )

    // Save competitive run
    const { data: run, error } = await serviceClient
      .schema('app')
      .from('competitive_runs')
      .insert({
        team_id: params.teamId,
        created_by_user_id: user.id,
        name: data.name || null,
        period_start: null,
        period_end: null,
        owned_location_ids: data.owned_location_ids,
        competitor_ids: data.competitor_ids,
        data: analysisData,
        model: 'gpt-5.2', // Parallelized
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
      .schema('app')
      .from('competitive_runs')
      .select('*')
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ runs: runs || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

