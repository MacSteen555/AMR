import { redirect } from 'next/navigation'

export default function TeamLocationsPage() {
    // Redirect back to the main teams list where locations are managed
    redirect('/teams')
}
