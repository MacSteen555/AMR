'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { teams, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && teams.length > 0) {
      // Redirect to teams page if user has teams
      router.push('/teams')
    }
  }, [loading, teams, router])

  if (loading) {
    return null
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to AutoMyReply!</h1>
        <p className="text-gray-600 mb-8">
          Create your first team to start managing your Google Business Profile reviews
        </p>
        <button
          onClick={() => router.push('/teams/new')}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Create Your First Team
        </button>
      </div>
    </div>
  )
}
