'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'

function LocationRedirectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationId = searchParams?.get('locationId')
  const section = searchParams?.get('section') || 'reviews'

  useEffect(() => {
    if (!locationId) { router.replace('/dashboard'); return }

    apiGet<{ teamId: string }>(`/api/locations/${locationId}/team`)
      .then(res => {
        router.replace(`/teams/${res.teamId}/${section}?location=${locationId}`)
      })
      .catch(() => {
        router.replace('/dashboard')
      })
  }, [locationId, section, router])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  )
}

export default function LocationRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    }>
      <LocationRedirectContent />
    </Suspense>
  )
}
