'use client'

import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'

interface Location {
  id: string
  name: string
  address: string
  status: string
}

interface Member {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export default function TeamsPage() {
  const { teams, loading } = useAuth()
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id)
    }
  }, [teams])

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamData(selectedTeamId)
    }
  }, [selectedTeamId])

  const loadTeamData = async (teamId: string) => {
    setLoadingData(true)
    try {
      const [locationsData, membersData] = await Promise.all([
        apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`),
        apiGet<{ members: Member[] }>(`/api/teams/${teamId}/members`),
      ])
      setLocations(locationsData.locations || [])
      setMembers(membersData.members || [])
    } catch (error) {
      console.error('Failed to load team data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading) {
    return null
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  return (
    <AppShell>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
            <p className="text-gray-600 mt-1">Manage your teams, locations, and members</p>
          </div>
          <button
            onClick={() => router.push('/teams/new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Team
          </button>
        </div>

        {/* Team Cards */}
        <div className="space-y-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`bg-white rounded-lg border-2 ${
                team.id === selectedTeamId ? 'border-indigo-500' : 'border-gray-200'
              } transition-all`}
            >
              {/* Team Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold text-gray-900">{team.name}</h2>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                          {team.subscription?.tier || 'FREE'}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                          {team.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {team.id === selectedTeamId ? (
                          <>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {locations.length} locations
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              {members.length} members
                            </span>
                          </>
                        ) : (
                          <button
                            onClick={() => setSelectedTeamId(team.id)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            View details →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Team Details (expanded) */}
              {team.id === selectedTeamId && (
                <div className="p-6">
                  {loadingData ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Locations */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Locations</h3>
                          <button
                            onClick={() => router.push(`/teams/${team.id}/locations/import`)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Location
                          </button>
                        </div>
                        <div className="space-y-2">
                          {locations.map((location) => (
                            <div
                              key={location.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                              onClick={() => router.push(`/locations/${location.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                <div>
                                  <div className="font-medium text-gray-900">{location.name}</div>
                                  <div className="text-sm text-gray-500">{location.address}</div>
                                </div>
                              </div>
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                location.status === 'active' 
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {location.status}
                              </span>
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {locations.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              No locations yet. Add one to get started.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Members */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Members</h3>
                          {team.role === 'admin' && (
                            <button
                              onClick={() => router.push(`/teams/${team.id}/invites`)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Invite Member
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {member.avatar_url ? (
                                  <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                                    {(member.display_name || member.email).charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900">{member.display_name || 'User'}</div>
                                  <div className="text-sm text-gray-500">{member.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded">
                                  {member.role}
                                </span>
                                {team.role === 'admin' && (
                                  <button className="p-1 hover:bg-gray-100 rounded">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* No Teams State */}
        {teams.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No teams yet</h3>
            <p className="text-gray-600 mb-6">Create your first team to get started</p>
            <button
              onClick={() => router.push('/teams/new')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Team
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

