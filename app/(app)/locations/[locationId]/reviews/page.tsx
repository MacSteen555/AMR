'use client'

import { useParams } from 'next/navigation'
import ReviewsView from '@/components/ReviewsView'

export default function LocationReviewsPage() {
    const { locationId } = useParams() as { locationId: string }

    return (
        <ReviewsView
            mode="location"
            entityId={locationId}
            title="Location Reviews"
            subtitle="Manage customer feedback for this location."
        />
    )
}
