'use client'

import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api'

interface Location {
  id: string
  name: string
  address: string
  status: string
  // Settings
  brand_voice?: string
  positive_sentiment?: string
  negative_sentiment?: string
  reply_language?: string
}

interface Member {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface LocationSettings {
  brand_voice?: string
  positive_sentiment?: string
  negative_sentiment?: string
  reply_language?: string
}

type GoogleLocation = {
  account_id: string
  location_id: string
  location_name: string
  address: any
  account_name?: string
}

export default function TeamsPage() {
  const { teams, loading } = useAuth()
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Settings Modals
  const [isLocationSettingsOpen, setIsLocationSettingsOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [settingsForm, setSettingsForm] = useState<LocationSettings>({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Location Import State
  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([])
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // --- Handlers ---

  const handleDeleteLocation = async (locationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedTeamId || !confirm('Are you sure you want to remove this location?')) return

    try {
      setLoadingData(true)
      await apiDelete(`/api/teams/${selectedTeamId}/locations/${locationId}`)
      loadTeamData(selectedTeamId)
    } catch (err: any) {
      alert('Failed to remove location: ' + err.message)
      setLoadingData(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!selectedTeamId || !confirm('Are you sure you want to delete this team? This cannot be undone.')) return

    try {
      setLoadingData(true)
      await apiDelete(`/api/teams/${selectedTeamId}`)
      window.location.reload()
    } catch (err: any) {
      alert('Failed to delete team: ' + err.message)
      setLoadingData(false)
    }
  }

  const handleInviteReference = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId || !inviteEmail) return

    try {
      setSendingInvite(true)
      await apiPost(`/api/teams/${selectedTeamId}/invites`, {
        email: inviteEmail,
        role: 'member'
      })
      alert('Invitation sent!')
      setIsInviteModalOpen(false)
      setInviteEmail('')
    } catch (err: any) {
      alert('Failed to send invite: ' + err.message)
    } finally {
      setSendingInvite(false)
    }
  }

  const handlePromoteAdmin = async (memberId: string) => {
    if (!selectedTeamId || !confirm('Promoting this user to Admin will demote you to a Member. Continue?')) return

    try {
      setLoadingData(true)
      await apiPost(`/api/teams/${selectedTeamId}/members/transfer-ownership`, {
        newAdminId: memberId
      })
      window.location.reload()
    } catch (err: any) {
      alert('Failed to promote user: ' + err.message)
      setLoadingData(false)
    }
  }

  // Settings Handlers
  const openLocationSettings = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLocation(loc)
    setSettingsForm({
      brand_voice: loc.brand_voice || '',
      positive_sentiment: loc.positive_sentiment || '',
      negative_sentiment: loc.negative_sentiment || '',
      reply_language: loc.reply_language || 'en',
    })
    setIsLocationSettingsOpen(true)
  }

  const handleSaveLocationSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId || !editingLocation) return
    try {
      setSavingSettings(true)
      await apiPatch(`/api/teams/${selectedTeamId}/locations/${editingLocation.id}`, settingsForm)
      setIsLocationSettingsOpen(false)
      loadTeamData(selectedTeamId)
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  // Location Modal Helpers
  const openAddLocationModal = async () => {
    setIsLocationModalOpen(true)
    setLoadingGoogle(true)
    setModalError(null)
    setSelectedGoogleIds([])
    try {
      const data = await apiGet<{ locations: GoogleLocation[] }>('/api/google/entitlements/locations')
      setGoogleLocations(data.locations)
    } catch (err: any) {
      setModalError(err.message || 'Failed to load Google locations')
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleImport = async () => {
    if (selectedGoogleIds.length === 0 || !selectedTeamId) return

    try {
      setImporting(true)
      setModalError(null)

      const selectedLocs = googleLocations.filter(l => selectedGoogleIds.includes(l.location_id))
      const accountId = selectedLocs[0]?.account_id

      await apiPost(`/api/teams/${selectedTeamId}/locations/import`, {
        account_id: accountId,
        google_location_ids: selectedGoogleIds
      })

      setIsLocationModalOpen(false)
      loadTeamData(selectedTeamId)
    } catch (err: any) {
      setModalError(err.message || 'Failed to import locations')
      setImporting(false)
    }
  }

  const handleToggleGoogleLoc = (id: string) => {
    setSelectedGoogleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  if (loading) {
    return null
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const isTeamAdmin = selectedTeam?.role === 'admin'

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
              className={`bg-white rounded-lg border-2 ${team.id === selectedTeamId ? 'border-indigo-500' : 'border-gray-200'
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

                  {/* Three Dots Menu */}
                  {team.id === selectedTeamId && isTeamAdmin && (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100">
                          <button
                            onClick={() => { setIsMenuOpen(false); handleDeleteTeam(); }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete Team
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {team.id !== selectedTeamId && (
                    <div className="p-2"></div> /* Spacer to match height */
                  )}
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
                            onClick={openAddLocationModal}
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
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${location.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                                  }`}>
                                  {location.status}
                                </span>
                                <button
                                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                                  onClick={(e) => openLocationSettings(location, e)}
                                  title="Settings"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                                <button
                                  className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                                  onClick={(e) => handleDeleteLocation(location.id, e)}
                                  title="Remove location"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
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
                          {isTeamAdmin && (
                            <button
                              onClick={() => setIsInviteModalOpen(true)}
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
                                {isTeamAdmin && member.role !== 'admin' && (
                                  <button
                                    onClick={() => handlePromoteAdmin(member.id)}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 underline px-2"
                                  >
                                    Make Admin
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

        {/* --- Modals --- */}

        {/* Invite Modal */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Invite Member</h3>
              <form onSubmit={handleInviteReference}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 bg-white"
                    placeholder="colleague@example.com"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {sendingInvite ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Location Settings Modal */}
        {isLocationSettingsOpen && editingLocation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Settings for {editingLocation.name}</h3>
              </div>

              <form onSubmit={handleSaveLocationSettings}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Brand Voice</label>
                    <textarea
                      value={settingsForm.brand_voice || ''}
                      onChange={e => setSettingsForm({ ...settingsForm, brand_voice: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Positive Sentiment</label>
                      <input
                        type="text"
                        value={settingsForm.positive_sentiment || ''}
                        onChange={e => setSettingsForm({ ...settingsForm, positive_sentiment: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Negative Sentiment</label>
                      <input
                        type="text"
                        value={settingsForm.negative_sentiment || ''}
                        onChange={e => setSettingsForm({ ...settingsForm, negative_sentiment: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reply Language</label>
                    <select
                      value={settingsForm.reply_language || 'en'}
                      onChange={e => setSettingsForm({ ...settingsForm, reply_language: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsLocationSettingsOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Location Modal */}
        {isLocationModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Add Location to {teams.find(t => t.id === selectedTeamId)?.name}</h3>
                <button
                  onClick={() => setIsLocationModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {modalError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                    {modalError}
                  </div>
                )}

                {loadingGoogle ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : googleLocations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No Google Locations found to import.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {googleLocations.map((loc) => (
                      <div
                        key={loc.location_id}
                        className={`flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selectedGoogleIds.includes(loc.location_id) ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200'
                          }`}
                        onClick={() => handleToggleGoogleLoc(loc.location_id)}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          checked={selectedGoogleIds.includes(loc.location_id)}
                          onChange={() => { }} // handled by parent div
                        />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{loc.location_name}</p>
                          <p className="text-sm text-gray-500">{loc.address?.addressLines?.join(', ')}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{loc.account_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg bg-gray-50">
                <button
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={importing || selectedGoogleIds.length === 0}
                >
                  {importing ? 'Importing...' : 'Import Selected'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
