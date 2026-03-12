import { NextResponse } from 'next/server'
import { requireLocationAccess, requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

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
        captureRouteError(error, { route: '/api/teams/[teamId]/locations/[locationId]', teamId: params?.teamId })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH /api/teams/[teamId]/locations/[locationId]
export async function PATCH(
    request: Request,
    { params }: { params: { teamId: string; locationId: string } }
) {
    try {
        // Ensure user can manage this location
        const { canManage } = await requireLocationAccess(params.locationId)
        if (!canManage) {
            throw new Error('You do not have permission to manage settings for this location')
        }

        const body = await request.json()
        const {
            brand_voice,
            positive_sentiment,
            negative_sentiment,
            reply_language,
            signature
        } = body

        const serviceClient = createSupabaseServiceRoleClient()

        const { data, error } = await serviceClient
            .schema('app')
            .from('locations')
            .update({
                brand_voice,
                positive_sentiment,
                negative_sentiment,
                reply_language,
                signature
            })
            .eq('id', params.locationId)
            .eq('team_id', params.teamId)
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to update location settings: ${error.message}`)
        }

        return NextResponse.json({ location: data })
    } catch (error: any) {
        captureRouteError(error, { route: '/api/teams/[teamId]/locations/[locationId]', teamId: params?.teamId })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}