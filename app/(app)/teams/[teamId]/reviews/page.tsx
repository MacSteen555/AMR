'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import ReviewsView from '@/components/ReviewsView'

export default function TeamReviewsPage() {
    const { teamId } = useParams() as { teamId: string }
    const searchParams = useSearchParams()
    const locationId = searchParams?.get('location') || null
    const { teams } = useAuth()

    const mode = locationId ? 'location' : 'team'
    const entityId = locationId || teamId

    const currentTeam = teams.find(t => t.id === teamId)
    const monthlyCredits = currentTeam?.subscription?.monthly_credits || 5
    const used = Math.max(0, monthlyCredits - (currentTeam?.creditBalance || 0))

    return (
        <ReviewsView
            mode={mode}
            entityId={entityId}
            title={locationId ? 'Location Reviews' : 'Team Reviews'}
            subtitle={locationId ? 'Manage customer feedback for this location.' : 'Manage feedback across all your locations.'}
            reviewsManaged={used}
            reviewsMax={monthlyCredits}
        />
    )
}
