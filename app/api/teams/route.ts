import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { createTeamSchema } from '@/lib/validation/schemas'

export async function GET() {
  try {
    const user = await requireUser()
    const supabase = createSupabaseServerClient()

    const { data: memberships } = await supabase
      .schema('app')
      .from('team_memberships')
      .select('*, team:teams(*)')
      .eq('user_id', user.id)

    const teams = (memberships || []).map((m: any) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      role: m.role,
      created_at: m.team.created_at,
    }))

    return NextResponse.json({ teams })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const data = createTeamSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // Generate slug
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Create team (RLS should allow any authenticated user to create)
    const { data: team, error: teamError } = await supabase
      .schema('app')
      .from('teams')
      .insert({
        name: data.name,
        slug,
        created_by: user.id,
      })
      .select()
      .single()

    if (teamError || !team) {
      throw new Error(`Failed to create team: ${teamError?.message}`)
    }

    // Create admin membership (RLS should allow inserting your own membership)
    const { error: membershipError } = await supabase
      .schema('app')
      .from('team_memberships')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'admin',
      })

    if (membershipError) {
      throw new Error(`Failed to create membership: ${membershipError.message}`)
    }

    // Initialize team subscription (use service role for system operation)
    const serviceClient = createSupabaseServiceRoleClient()
    const { error: subError } = await serviceClient
      .schema('app')
      .from('team_subscriptions')
      .insert({
        team_id: team.id,
        tier: 'FREE',
        status: 'active',
      })

    if (subError) {
      // Non-fatal, log but continue
      console.error('Failed to initialize subscription:', subError)
    }

    return NextResponse.json({ team }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

