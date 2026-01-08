import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCompetitorSchema } from '@/lib/validation/schemas'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServerClient()

    const { data: competitors } = await supabase
      .from('app.competitors')
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

    const { data: competitor, error } = await supabase
      .from('app.competitors')
      .insert({
        team_id: params.teamId,
        name: data.name,
        place_id: data.place_id,
        website: data.website || null,
        phone: data.phone || null,
        address: data.address || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      })
      .select()
      .single()

    if (error || !competitor) {
      throw new Error(`Failed to create competitor: ${error?.message}`)
    }

    return NextResponse.json({ competitor }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

