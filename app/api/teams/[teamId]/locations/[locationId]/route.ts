import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function DELETE(
    request: Request,
    { params }: { params: { teamId: string; locationId: string } }
) {
    try {
        // Ensure user has access to the team
        await requireTeamMember(params.teamId)

        const serviceClient = createSupabaseServiceRoleClient()

        // Delete the location record
        // This assumes the location record is specific to this app and just links to Google.
        // Deleting it removes it from the team.
        const { error } = await serviceClient
            .schema('app')
            .from('locations')
            .delete()
            .eq('id', params.locationId)
            .eq('team_id', params.teamId)

        if (error) {
            throw new Error(`Failed to delete location: ${error.message}`)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
