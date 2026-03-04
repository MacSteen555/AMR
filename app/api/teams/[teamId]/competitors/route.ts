import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCompetitorSchema } from '@/lib/validation/schemas'
import { getTeamTier } from '@/lib/billing/credits'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: competitors } = await supabase
      .schema('app')
      .from('competitors')
      .select('*')
      .eq('team_id', params.teamId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    return NextResponse.json({ competitors: competitors || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const body = await request.json()
    const data = createCompetitorSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // 1. Check tier limits
    const tierInfo = await getTeamTier(params.teamId)
    const limits: Record<string, number> = {
      FREE: 0,
      PRO: 1,
      BUSINESS: 5,
      ENTERPRISE: 10
    }
    const maxCompetitors = limits[tierInfo.tier] || 0

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

    // 3. Check for existing competitor (active or soft-deleted)
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

      // Restore and update the deleted competitor
      const { data: updated, error } = await supabase
        .schema('app')
        .from('competitors')
        .update({
          deleted_at: null, // Restore
          name: data.name,
          website: data.website || null,
          phone: data.phone || null,
          address: data.address || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          rating: data.rating || null,
          review_count: data.review_count || null,
          opening_hours: data.opening_hours || null,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error || !updated) {
        throw new Error(`Failed to restore competitor: ${error?.message}`)
      }
      competitor = updated
    } else {
      // Insert new competitor
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
        })
        .select()
        .single()

      if (error || !inserted) {
        throw new Error(`Failed to create competitor: ${error?.message}`)
      }
      competitor = inserted
    }

    return NextResponse.json({ competitor }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

