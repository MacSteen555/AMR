import { NextResponse } from 'next/server'
import { requireTeamMember, requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { createTeamInviteSchema } from '@/lib/validation/schemas'
import { sendEmail } from '@/lib/email/send'
import { buildTeamInviteEmail } from '@/lib/email/templates/team-invite'
import crypto from 'crypto'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const supabase = createSupabaseServiceRoleClient()

    const { data: invites, error } = await supabase
      .schema('app')
      .from('team_invites')
      .select(`
        id,
        invited_email,
        role,
        created_at,
        expires_at,
        accepted_at,
        inviter:users!team_invites_invited_by_fkey ( display_name, email )
      `)
      .eq('team_id', params.teamId)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({
      invites: (invites || []).map((inv: any) => ({
        id: inv.id,
        invited_email: inv.invited_email,
        role: inv.role,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        inviter_name: inv.inviter?.display_name || inv.inviter?.email || 'Unknown',
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const admin = await requireTeamAdmin(params.teamId)
    const body = await request.json()
    const data = createTeamInviteSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // Fetch team name for the email
    const { data: team, error: teamError } = await supabase
      .schema('app')
      .from('teams')
      .select('name')
      .eq('id', params.teamId)
      .single()

    if (teamError || !team) {
      throw new Error('Team not found')
    }

    // Fetch inviter details
    const { data: inviter, error: inviterError } = await supabase
      .schema('app')
      .from('users')
      .select('email, display_name')
      .eq('id', admin.user_id)
      .single()

    if (inviterError || !inviter) {
      throw new Error('Inviter not found')
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Create invite
    const expiresAt = new Date()
    const EXPIRY_DAYS = 7
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS)

    const { data: invite, error } = await supabase
      .schema('app')
      .from('team_invites')
      .insert({
        team_id: params.teamId,
        invited_email: data.email,
        role: data.role,
        invited_by: admin.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !invite) {
      // Check for unique constraint (already invited)
      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'This email has already been invited to this team' },
          { status: 409 }
        )
      }
      throw new Error(`Failed to create invite: ${error?.message}`)
    }

    // Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invites/${token}`

    const { subject, html } = buildTeamInviteEmail({
      teamName: team.name,
      inviterName: inviter.display_name || inviter.email,
      inviterEmail: inviter.email,
      inviteUrl,
      expiresInDays: EXPIRY_DAYS,
    })

    await sendEmail({ to: data.email, subject, html })

    return NextResponse.json({ invite }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
