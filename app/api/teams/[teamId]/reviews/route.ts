import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
    try {
        await requireTeamMember(params.teamId)
        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50')

        const serviceClient = createSupabaseServiceRoleClient()

        // Get all locations for team
        const { data: locations } = await serviceClient
            .schema('app')
            .from('locations')
            .select('id, name') // Get name to return with review
            .eq('team_id', params.teamId)

        if (!locations || locations.length === 0) {
            return NextResponse.json({ reviews: [] })
        }

        const locationIds = locations.map(l => l.id)
        const locationMap = new Map(locations.map(l => [l.id, l.name]))

        const { data: reviews } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .in('location_id', locationIds)
            .order('review_date', { ascending: false })
            .limit(limit)

        // Attach location name
        const enrichedReviews = reviews?.map(r => ({
            ...r,
            location_name: locationMap.get(r.location_id)
        })) || []

        return NextResponse.json({ reviews: enrichedReviews })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
