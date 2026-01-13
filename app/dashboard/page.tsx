'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
}

interface Team {
  id: string
  name: string
  role: string
  subscription: {
    tier: string
    status: string
    monthly_credits: number
    insights_enabled: boolean
    competitive_enabled: boolean
  } | null
  creditBalance: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
      })

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to check authentication')
      }

      const data = await response.json()
      setUser(data.user)
      setTeams(data.teams || [])
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-600">AutoMyReply</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{user.display_name || user.email}</span>
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full"
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h2>
          <p className="text-gray-600">Manage your teams, locations, and reviews</p>
        </div>

        {/* Teams Section */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">You don't have any teams yet.</p>
            <button
              onClick={() => router.push('/teams/new')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/teams/${team.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{team.name}</h3>
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                    {team.role}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tier:</span>
                    <span className="font-semibold text-gray-900">
                      {team.subscription?.tier || 'FREE'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Credits:</span>
                    <span className="font-semibold text-gray-900">
                      {team.creditBalance}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-semibold ${
                      team.subscription?.status === 'active' 
                        ? 'text-green-600' 
                        : 'text-gray-600'
                    }`}>
                      {team.subscription?.status || 'active'}
                    </span>
                  </div>
                </div>

                <button className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                  View Team
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {teams.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => router.push('/teams/new')}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
              >
                <div className="text-2xl mb-2">➕</div>
                <div className="font-semibold text-gray-900">Create Team</div>
                <div className="text-sm text-gray-600">Start a new team</div>
              </button>
              <button
                onClick={() => {
                  const firstTeam = teams[0]
                  if (firstTeam) router.push(`/teams/${firstTeam.id}/locations`)
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
              >
                <div className="text-2xl mb-2">📍</div>
                <div className="font-semibold text-gray-900">Import Locations</div>
                <div className="text-sm text-gray-600">Add Google locations</div>
              </button>
              <button
                onClick={() => {
                  const firstTeam = teams[0]
                  if (firstTeam) router.push(`/teams/${firstTeam.id}/billing`)
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
              >
                <div className="text-2xl mb-2">💳</div>
                <div className="font-semibold text-gray-900">Manage Billing</div>
                <div className="text-sm text-gray-600">Upgrade or top-up</div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

