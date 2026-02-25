import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getSupabaseUser } from '@/lib/auth/session'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/invites/validate?token=xxx
 * Returns invite details for the acceptance page without requiring auth.
 * Uses service role client to bypass RLS since anyone with a valid token
 * should be able to see the invite details.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 })
        }

        const supabase = createSupabaseServiceRoleClient()

        // Hash token to look up invite
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

        const { data: invite, error } = await supabase
            .schema('app')
            .from('team_invites')
            .select(`
        id,
        invited_email,
        role,
        expires_at,
        accepted_at,
        created_at,
        team:teams!inner ( id, name ),
        inviter:users!team_invites_invited_by_fkey ( display_name, email )
      `)
            .eq('token_hash', tokenHash)
            .single()

        if (error || !invite) {
            return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
        }

        // Check if already accepted
        if (invite.accepted_at) {
            return NextResponse.json({ error: 'This invitation has already been accepted', code: 'ALREADY_ACCEPTED' }, { status: 410 })
        }

        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invitation has expired', code: 'EXPIRED' }, { status: 410 })
        }

        // Check if user is logged in (optional context for the frontend)
        const authUser = await getSupabaseUser()

        return NextResponse.json({
            invite: {
                id: invite.id,
                invited_email: invite.invited_email,
                role: invite.role,
                expires_at: invite.expires_at,
                team_name: (invite.team as any).name,
                team_id: (invite.team as any).id,
                inviter_name: (invite.inviter as any)?.display_name || (invite.inviter as any)?.email || 'A team member',
                inviter_email: (invite.inviter as any)?.email,
            },
            authenticated: !!authUser,
            current_email: authUser?.email || null,
        })
    } catch (error: any) {
        console.error('Validate invite error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
