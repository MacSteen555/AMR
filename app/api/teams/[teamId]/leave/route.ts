import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireTeamMember } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
    try {
        const membership = await requireTeamMember(params.teamId)
        const supabase = createSupabaseServiceRoleClient()

        // Prevent last admin from leaving
        if (membership.role === 'admin') {
            const { data: admins } = await supabase
                .schema('app')
                .from('team_memberships')
                .select('id')
                .eq('team_id', params.teamId)
                .eq('role', 'admin')

            if (!admins || admins.length <= 1) {
                return NextResponse.json(
                    { error: 'You are the last admin. Transfer ownership before leaving.' },
                    { status: 400 }
                )
            }
        }

        // Remove location access for this user on this team's locations
        const { data: teamLocations } = await supabase
            .schema('app')
            .from('locations')
            .select('id')
            .eq('team_id', params.teamId)

        if (teamLocations && teamLocations.length > 0) {
            const locationIds = teamLocations.map((l: any) => l.id)
            await supabase
                .schema('app')
                .from('location_access')
                .delete()
                .eq('user_id', membership.user_id)
                .in('location_id', locationIds)
        }

        // Delete the membership
        const { error } = await supabase
            .schema('app')
            .from('team_memberships')
            .delete()
            .eq('team_id', params.teamId)
            .eq('user_id', membership.user_id)

        if (error) throw new Error(error.message)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
