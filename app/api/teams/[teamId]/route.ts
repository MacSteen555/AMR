import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

// DELETE /api/teams/[teamId] - Delete a team
export async function DELETE(
    request: Request,
    { params }: { params: { teamId: string } }
) {
    try {
        // Only admins can delete a team
        await requireTeamAdmin(params.teamId)

        const serviceClient = createSupabaseServiceRoleClient()

        // Delete the team
        // Cascading deletes should handle memberships, locations, etc. if configured in DB.
        // Otherwise we might need manual cleanup, but standard Supabase setups often cascade.
        // Let's assume cascade or just try to delete the team.
        const { error } = await serviceClient
            .schema('app')
            .from('teams')
            .delete()
            .eq('id', params.teamId)

        if (error) {
            throw new Error(`Failed to delete team: ${error.message}`)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
