import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { teamId: string } }) {
    try {
        const membership = await requireTeamMember(params.teamId)
        const user = await requireUser()
        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50')

        const serviceClient = createSupabaseServiceRoleClient()

        // Get all locations for team
        const { data: locations } = await serviceClient
            .schema('app')
            .from('locations')
            .select('id, name')
            .eq('team_id', params.teamId)

        if (!locations || locations.length === 0) {
            return NextResponse.json({ reviews: [], manageableLocationIds: [] })
        }

        const locationIds = locations.map(l => l.id)
        const locationMap = new Map(locations.map(l => [l.id, l.name]))

        // Determine which locations the user can post replies for
        let manageableLocationIds: string[] = []

        if (membership.role === 'admin') {
            // Admins can manage all locations
            manageableLocationIds = locationIds
        } else {
            // Non-admins: check location_access table for can_manage = true
            const { data: accessRows } = await serviceClient
                .schema('app')
                .from('location_access')
                .select('location_id')
                .eq('user_id', user.id)
                .eq('can_manage', true)
                .in('location_id', locationIds)

            manageableLocationIds = accessRows?.map(a => a.location_id) || []
        }

        const locationFilter = searchParams.get('location')
        const themeFilter = searchParams.get('theme')

        let reviewQuery = serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .order('review_date', { ascending: false })
            .limit(limit)

        if (locationFilter && locationIds.includes(locationFilter)) {
            reviewQuery = reviewQuery.eq('location_id', locationFilter)
        } else {
            reviewQuery = reviewQuery.in('location_id', locationIds)
        }

        if (themeFilter) {
            reviewQuery = reviewQuery.contains('themes', [themeFilter])
        }

        const { data: reviews } = await reviewQuery

        // Attach location name
        const enrichedReviews = reviews?.map(r => ({
            ...r,
            location_name: locationMap.get(r.location_id)
        })) || []

        return NextResponse.json({ reviews: enrichedReviews, manageableLocationIds })
    } catch (error: any) {
        captureRouteError(error, { route: '/api/teams/[teamId]/reviews', teamId: params?.teamId })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
