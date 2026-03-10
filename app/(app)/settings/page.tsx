'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SettingsPage() {
  const { teams, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && teams.length > 0) {
      router.replace(`/teams/${teams[0].id}/settings`)
    }
  }, [loading, teams, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  // No teams — redirect to teams page
  if (teams.length === 0) {
    router.replace('/teams')
    return null
  }

  return null
}
