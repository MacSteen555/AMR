import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireTeamMember } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function DELETE(
    request: Request,
    { params }: { params: { teamId: string; inviteId: string } }
) {
    try {
        await requireTeamMember(params.teamId)
        const supabase = createSupabaseServiceRoleClient()

        // Verify invite belongs to this team and is still pending
        const { data: invite, error: fetchError } = await supabase
            .schema('app')
            .from('team_invites')
            .select('id')
            .eq('id', params.inviteId)
            .eq('team_id', params.teamId)
            .is('accepted_at', null)
            .single()

        if (fetchError || !invite) {
            return NextResponse.json({ error: 'Invite not found or already accepted' }, { status: 404 })
        }

        const { error } = await supabase
            .schema('app')
            .from('team_invites')
            .delete()
            .eq('id', params.inviteId)

        if (error) throw new Error(error.message)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
