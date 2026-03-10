'use client'

import { useParams, useSearchParams } from 'next/navigation'
import ReviewsView from '@/components/ReviewsView'

export default function TeamReviewsPage() {
    const { teamId } = useParams() as { teamId: string }
    const searchParams = useSearchParams()
    const locationId = searchParams?.get('location') || null

    const mode = locationId ? 'location' : 'team'
    const entityId = locationId || teamId

    return (
        <ReviewsView
            mode={mode}
            entityId={entityId}
            title={locationId ? 'Location Reviews' : 'Team Reviews'}
            subtitle={locationId ? 'Manage customer feedback for this location.' : 'Manage feedback across all your locations.'}
        />
    )
}
