'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(displayName: string | null): string | null {
  if (!displayName) return null
  return displayName.split(' ')[0]
}

export default function DashboardPage() {
  const { user, teams, loading } = useAuth()
  const router = useRouter()
  const greeting = useMemo(() => getGreeting(), [])
  const firstName = user ? getFirstName(user.display_name) : null

  useEffect(() => {
    if (!loading && teams.length > 0) {
      router.replace(`/teams/${teams[0].id}`)
    }
  }, [loading, teams, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  if (!user) return null

  // No teams — onboarding
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {greeting}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="text-gray-600 mb-8">
            Create your first team to start managing your Google Business Profile reviews
          </p>
          <button
            onClick={() => router.push('/teams/new')}
            className="cursor-pointer px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:scale-[0.98] transition-all duration-200"
          >
            Create Your First Team
          </button>
        </div>
      </div>
    </div>
  )
}
