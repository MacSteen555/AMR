import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'
import crypto from 'crypto'

export async function POST(request: Request) {
    try {
        const user = await requireUser()
        const body = await request.json()
        const { token } = body

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
        }

        const supabase = createSupabaseServiceRoleClient()

        // Hash the token to look up the invite
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

        // Find the invite
        const { data: invite, error: inviteError } = await supabase
            .schema('app')
            .from('team_invites')
            .select('*, team:teams!inner(id, name)')
            .eq('token_hash', tokenHash)
            .single()

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
        }

        // Check if already accepted
        if (invite.accepted_at) {
            return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 410 })
        }

        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
        }

        // Verify the accepting user's email matches the invited email
        if (user.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
            return NextResponse.json(
                { error: `This invitation was sent to ${invite.invited_email}. Please sign in with that email address.` },
                { status: 403 }
            )
        }

        // Check if user is already a member
        const { data: existingMembership } = await supabase
            .schema('app')
            .from('team_memberships')
            .select('id')
            .eq('team_id', invite.team_id)
            .eq('user_id', user.id)
            .single()

        if (existingMembership) {
            // Delete invite since it is accepted
            await supabase
                .schema('app')
                .from('team_invites')
                .delete()
                .eq('id', invite.id)

            return NextResponse.json({
                team_id: invite.team_id,
                team_name: invite.team.name,
                already_member: true,
            })
        }

        // Create membership
        const { error: membershipError } = await supabase
            .schema('app')
            .from('team_memberships')
            .insert({
                team_id: invite.team_id,
                user_id: user.id,
                role: invite.role,
            })

        if (membershipError) {
            throw new Error(`Failed to join team: ${membershipError.message}`)
        }

        // Delete invite
        await supabase
            .schema('app')
            .from('team_invites')
            .delete()
            .eq('id', invite.id)

        return NextResponse.json({
            team_id: invite.team_id,
            team_name: invite.team.name,
            already_member: false,
        })
    } catch (error: any) {
        console.error('Accept invite error:', error)
        captureRouteError(error, { route: '/api/invites/accept' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
