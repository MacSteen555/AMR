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
      // Redirect to teams page if user has teams
      router.push('/teams')
    }
  }, [loading, teams, router])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-2xl mx-auto mt-20">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-72 bg-gray-200 rounded" />
        <div className="h-12 w-40 bg-gray-200 rounded-lg" />
      </div>
    )
  }

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
