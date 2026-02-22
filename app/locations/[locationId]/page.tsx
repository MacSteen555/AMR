import { redirect } from 'next/navigation'

export default function LocationPage({ params }: { params: { locationId: string } }) {
    redirect(`/locations/${params.locationId}/reviews`)
}
