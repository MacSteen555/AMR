'use client'

import { useParams } from 'next/navigation'
import ReviewsView from '@/components/ReviewsView'

export default function TeamReviewsPage() {
    const { teamId } = useParams() as { teamId: string }

    return (
        <ReviewsView
            mode="team"
            entityId={teamId}
            title="Team Reviews"
            subtitle="Manage feedback across all your locations."
        />
    )
}
