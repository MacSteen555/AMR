import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { createTeamSchema } from '@/lib/validation/schemas'

type Team = {
  id: string
  name: string
  slug: string
  created_by: string
  created_at: string
  updated_at: string
}

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
    // Gate route (your auth helper)
    await requireUser()

    const body = await request.json()
    const parsed = createTeamSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // Get verified Supabase user (guaranteed to match auth.uid() in Postgres)
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const uid = userData.user.id

    // Slug (basic)
    const slug = parsed.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Optional debug
    const { data: dbg, error: dbgErr } = await supabase.schema('app').rpc('rls_debug')
    console.log('RLS debug:', dbg, dbgErr)

    // ✅ Create team via RPC (created_by set inside DB to auth.uid())
    const { data: teamData, error: teamError } = await supabase
      .schema('app')
      .rpc('create_team', {
        p_name: parsed.name,
        p_slug: slug,
      })
      .single()

    if (teamError || !teamData) {
      throw new Error(`Failed to create team: ${teamError?.message}`)
    }

    const team = teamData as Team;

    // Create admin membership
    // NOTE: this will fail unless you have a bootstrap policy for team_memberships inserts
    const { error: membershipError } = await supabase
      .schema('app')
      .from('team_memberships')
      .insert({
        team_id: team.id,
        user_id: uid,
        role: 'admin',
      })

    if (membershipError) {
      throw new Error(`Failed to create membership: ${membershipError.message}`)
    }

    // Initialize subscription (system op)
    const admin = createSupabaseServiceRoleClient()
    const { error: subError } = await admin
      .schema('app')
      .from('team_subscriptions')
      .insert({
        team_id: team.id,
        tier: 'FREE',
        status: 'active',
      })

    if (subError) {
      console.error('Failed to initialize subscription:', subError)
    }

    return NextResponse.json({ team }, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error?.message ?? 'Unknown error' }, { status: 500 })
  }
}



