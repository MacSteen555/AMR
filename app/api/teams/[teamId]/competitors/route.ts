import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { createCompetitorSchema } from '@/lib/validation/schemas'
import { getTeamTier } from '@/lib/billing/credits'
import { captureRouteError } from '@/lib/sentry'

const TIER_LIMITS: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 5,
  ENTERPRISE: 20,
}

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireUser()
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Fetch tier info for limits
    const tierInfo = await getTeamTier(params.teamId)
    const maxCompetitors = TIER_LIMITS[tierInfo.tier] || 0

    const { data: competitors } = await supabase
      .schema('app')
      .from('competitors')
      .select('*')
      .eq('team_id', params.teamId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({
        competitors: [],
        tier: tierInfo.tier,
        maxCompetitors,
      })
    }

    // Fetch team locations for name mapping
    const { data: teamLocations } = await supabase
      .schema('app')
      .from('locations')
      .select('id, name')
      .eq('team_id', params.teamId)

    const locationNameMap: Record<string, string> = {}
    for (const loc of teamLocations || []) {
      locationNameMap[loc.id] = loc.name
    }

    // Fetch recent competitive_runs (bounded) to find latest per competitor
    const { data: runs } = await serviceClient
      .schema('app')
      .from('competitive_runs')
      .select('id, competitor_ids, created_at, data')
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: false })
      .limit(Math.max(competitors.length * 5, 50))

    // Build map: competitor_id -> latest run (with metrics from 30d data)
    const latestRunMap: Record<string, {
      created_at: string
      competitivePositionScore?: number
      marketMomentum?: number
      ownedAverageRating?: number
      competitorAverageRating?: number
      ratingGap?: number
      threatCount?: number
      opportunityCount?: number
    }> = {}

    for (const run of runs || []) {
      for (const cid of run.competitor_ids || []) {
        if (!latestRunMap[cid]) {
          const report = run.data?.unified
          latestRunMap[cid] = {
            created_at: run.created_at,
            competitivePositionScore: report?.competitivePositionScore,
            marketMomentum: report?.marketMomentum,
            ownedAverageRating: report?.ownedAverageRating,
            competitorAverageRating: report?.competitorAverageRating,
            ratingGap: report?.ratingGap,
            threatCount: report?.threatAlerts?.length,
            opportunityCount: report?.opportunities?.length,
          }
        }
      }
    }

    // Enrich competitors
    const enriched = competitors.map((c: any) => {
      const latest = latestRunMap[c.id]
      const locationNames = (c.location_ids || [])
        .map((id: string) => locationNameMap[id])
        .filter(Boolean)

      return {
        ...c,
        location_names: locationNames,
        latest_report_date: latest?.created_at || null,
        metrics: latest ? {
          competitivePositionScore: latest.competitivePositionScore,
          marketMomentum: latest.marketMomentum,
          ownedAverageRating: latest.ownedAverageRating,
          competitorAverageRating: latest.competitorAverageRating,
          ratingGap: latest.ratingGap,
          threatCount: latest.threatCount,
          opportunityCount: latest.opportunityCount,
        } : null,
      }
    })

    return NextResponse.json({
      competitors: enriched,
      tier: tierInfo.tier,
      maxCompetitors,
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/competitors', teamId: params?.teamId })
    const status = error.message?.includes('Unauthorized') || error.message?.includes('not a member') ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireUser()
    await requireTeamMember(params.teamId)
    const body = await request.json()
    const data = createCompetitorSchema.parse(body)

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // 1. Check tier limits
    const tierInfo = await getTeamTier(params.teamId)
    const maxCompetitors = TIER_LIMITS[tierInfo.tier] || 0

    if (maxCompetitors === 0) {
      return NextResponse.json({ error: 'Please upgrade to PRO or higher to add competitors' }, { status: 403 })
    }

    // 2. Count active competitors
    const { count, error: countError } = await supabase
      .schema('app')
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', params.teamId)
      .is('deleted_at', null)

    if (countError) {
      throw new Error(`Failed to check limits: ${countError.message}`)
    }

    if (count !== null && count >= maxCompetitors) {
      return NextResponse.json(
        { error: `Limit reached. Your ${tierInfo.tier} plan allows up to ${maxCompetitors} competitor(s).` },
        { status: 403 }
      )
    }

    // 3. Validate location_ids belong to this team (use service client to bypass RLS)
    const { data: validLocations } = await serviceClient
      .schema('app')
      .from('locations')
      .select('id')
      .eq('team_id', params.teamId)
      .in('id', data.location_ids)

    const validIds = new Set((validLocations || []).map((l: any) => l.id))
    const invalidIds = data.location_ids.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'One or more location IDs do not belong to this team.' }, { status: 400 })
    }

    // 4. Check for existing competitor (active or soft-deleted)
    const { data: existing } = await supabase
      .schema('app')
      .from('competitors')
      .select('*')
      .eq('team_id', params.teamId)
      .eq('place_id', data.place_id)
      .single()

    let competitor

    if (existing) {
      if (!existing.deleted_at) {
        return NextResponse.json({ error: 'This competitor is already being tracked.' }, { status: 400 })
      }

      const { data: updated, error } = await supabase
        .schema('app')
        .from('competitors')
        .update({
          deleted_at: null,
          name: data.name,
          website: data.website || null,
          phone: data.phone || null,
          address: data.address || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          rating: data.rating || null,
          review_count: data.review_count || null,
          opening_hours: data.opening_hours || null,
          location_ids: data.location_ids,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error || !updated) {
        throw new Error(`Failed to restore competitor: ${error?.message}`)
      }
      competitor = updated
    } else {
      const { data: inserted, error } = await supabase
        .schema('app')
        .from('competitors')
        .insert({
          team_id: params.teamId,
          name: data.name,
          place_id: data.place_id,
          website: data.website || null,
          phone: data.phone || null,
          address: data.address || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          rating: data.rating || null,
          review_count: data.review_count || null,
          opening_hours: data.opening_hours || null,
          location_ids: data.location_ids,
        })
        .select()
        .single()

      if (error || !inserted) {
        throw new Error(`Failed to create competitor: ${error?.message}`)
      }
      competitor = inserted
    }

    // 4. Fire-and-forget: trigger async setup (review sync + first report)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/competitors/${competitor.id}/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch((err) => {
      console.error(`[competitors] Setup call failed for ${competitor.id}:`, err.message)
    })

    return NextResponse.json({
      competitor: { ...competitor, setup_status: 'pending' }
    }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/competitors', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
