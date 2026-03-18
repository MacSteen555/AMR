'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api'
import { Toast } from '@/components/Toast'
import { GbpPermissionsModal } from '@/components/GbpPermissionsModal'

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
  signature?: string | null
}

const SIGNATURE_PRESETS = ['store_name', 'team_name', 'user_name'] as const
type SignaturePreset = (typeof SIGNATURE_PRESETS)[number]

function getSignatureType(value: string | null | undefined): SignaturePreset | 'custom' {
  if (!value) return 'store_name'
  if (SIGNATURE_PRESETS.includes(value as SignaturePreset)) return value as SignaturePreset
  return 'custom'
}

interface Member {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface PendingInvite {
  id: string
  invited_email: string
  role: string
  created_at: string
  expires_at: string
  inviter_name: string
}

interface LocationSettings {
  brand_voice?: string
  positive_sentiment?: string
  negative_sentiment?: string
  reply_language?: string
  signature?: string | null
  signature_type?: SignaturePreset | 'custom'
  signature_custom?: string
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
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isGbpHelpOpen, setIsGbpHelpOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Settings Modals
  const [isLocationSettingsOpen, setIsLocationSettingsOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [settingsForm, setSettingsForm] = useState<LocationSettings>({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Location Import State
  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([])
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)
  const [conflictLocations, setConflictLocations] = useState<{ name: string; google_location_id: string }[]>([])
  const [showConflictModal, setShowConflictModal] = useState(false)

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Banner dismiss
  const [showBanner, setShowBanner] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  // Close menu/tooltip on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
        setShowBanner(false)
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
      const [locationsData, membersData, invitesData] = await Promise.all([
        apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`),
        apiGet<{ members: Member[] }>(`/api/teams/${teamId}/members`),
        apiGet<{ invites: PendingInvite[] }>(`/api/teams/${teamId}/invites`),
      ])
      setLocations(locationsData.locations || [])
      setMembers(membersData.members || [])
      setPendingInvites(invitesData.invites || [])
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
      setToast({ message: 'Failed to remove location: ' + err.message, type: 'error' })
      setLoadingData(false)
    }
  }

  const handleDeleteTeam = () => {
    if (!selectedTeamId) return
    setIsDeleteModalOpen(true)
  }

  const executeDeleteTeam = async () => {
    if (!selectedTeamId) return

    try {
      setLoadingData(true)
      await apiDelete(`/api/teams/${selectedTeamId}`)
      window.location.reload()
    } catch (err: any) {
      setToast({ message: 'Failed to delete team: ' + err.message, type: 'error' })
      setLoadingData(false)
      setIsDeleteModalOpen(false)
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
      setToast({ message: 'Invitation sent!', type: 'success' })
      setIsInviteModalOpen(false)
      setInviteEmail('')
      if (selectedTeamId) loadTeamData(selectedTeamId)
    } catch (err: any) {
      setToast({ message: 'Failed to send invite: ' + err.message, type: 'error' })
    } finally {
      setSendingInvite(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!selectedTeamId || !confirm('Cancel this invitation?')) return
    try {
      await apiDelete(`/api/teams/${selectedTeamId}/invites/${inviteId}`)
      setToast({ message: 'Invitation cancelled', type: 'success' })
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err: any) {
      setToast({ message: 'Failed to cancel invite: ' + err.message, type: 'error' })
    }
  }

  const handleLeaveTeam = async () => {
    if (!selectedTeamId || !confirm('Are you sure you want to leave this team? This cannot be undone.')) return
    try {
      await apiPost(`/api/teams/${selectedTeamId}/leave`, {})
      setToast({ message: 'You have left the team', type: 'success' })
      window.location.reload()
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' })
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
      setToast({ message: 'Failed to promote user: ' + err.message, type: 'error' })
      setLoadingData(false)
    }
  }

  // Settings Handlers
  const openLocationSettings = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLocation(loc)
    const sigType = getSignatureType(loc.signature)
    setSettingsForm({
      brand_voice: loc.brand_voice || '',
      positive_sentiment: '',
      negative_sentiment: loc.negative_sentiment || '',
      reply_language: loc.reply_language || 'en',
      signature_type: sigType,
      signature_custom: sigType === 'custom' ? (loc.signature || '') : '',
    })
    setIsLocationSettingsOpen(true)
  }

  const handleSaveLocationSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId || !editingLocation) return
    const sigValue =
      settingsForm.signature_type === 'custom'
        ? (settingsForm.signature_custom || null)
        : settingsForm.signature_type || null
    try {
      setSavingSettings(true)
      await apiPatch(`/api/teams/${selectedTeamId}/locations/${editingLocation.id}`, {
        brand_voice: settingsForm.brand_voice || null,
        positive_sentiment: settingsForm.positive_sentiment || null,
        negative_sentiment: settingsForm.negative_sentiment || null,
        reply_language: settingsForm.reply_language || 'en',
        signature: sigValue,
      })
      setIsLocationSettingsOpen(false)
      loadTeamData(selectedTeamId)
    } catch (err: any) {
      setToast({ message: 'Failed to save settings: ' + err.message, type: 'error' })
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

  const handleImport = async (force = false) => {
    if (selectedGoogleIds.length === 0 || !selectedTeamId) return

    try {
      setImporting(true)
      setModalError(null)
      setShowConflictModal(false)

      const selectedLocs = googleLocations.filter(l => selectedGoogleIds.includes(l.location_id))
      const accountId = selectedLocs[0]?.account_id

      const result = await apiPost<{ locations: { id: string; name: string }[]; conflicts: { name: string; google_location_id: string }[] }>(
        `/api/teams/${selectedTeamId}/locations/import`,
        { account_id: accountId, google_location_ids: selectedGoogleIds, force }
      )

      if (result.conflicts?.length > 0 && !force) {
        setConflictLocations(result.conflicts)
        setShowConflictModal(true)
        setImporting(false)
        return
      }

      setIsLocationModalOpen(false)
      setConflictLocations([])
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
    return (
      <>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
        </div>
      </>
    )
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const isTeamAdmin = selectedTeam?.role === 'admin'
  const hasTeams = teams.length > 0

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
        <div className="p-8">



          {/* ── Empty State: No Teams ── */}
          {!hasTeams && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-100 rounded-3xl mb-6">
                <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Get Started with Your First Team</h1>
              <p className="text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
                Create a team to connect your Google Business locations and start managing reviews with
                AI-powered replies that match your brand voice.
              </p>
              <button
                onClick={() => router.push('/teams/new')}
                className="inline-flex items-center gap-3 px-8 py-4 bg-teal-600 text-white rounded-2xl font-semibold hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 hover:shadow-xl hover:shadow-teal-200 hover:-translate-y-0.5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Team
              </button>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="bg-white rounded-xl p-5 border border-gray-200 text-left">
                  <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Connect Locations</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">Import your Google Business locations in one click.</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 text-left">
                  <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Set Brand Voice</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">Customize how AI replies sound for each location.</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 text-left">
                  <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Auto-Reply to Reviews</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">AI drafts replies your team reviews and posts.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Has Teams ── */}
          {hasTeams && (
            <>
              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <div className="relative" ref={helpRef}>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
                    <button
                      onClick={() => setShowBanner(!showBanner)}
                      className="w-6 h-6 rounded-full bg-gray-200 hover:bg-teal-100 text-gray-500 hover:text-teal-600 flex items-center justify-center transition-colors"
                      title="What are Teams?"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-gray-500 mt-1">Manage your teams, locations, and members</p>
                  {showBanner && (
                    <div className="absolute left-0 top-full mt-2 z-50 w-96 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-5 text-white shadow-xl shadow-teal-200/50">
                      <div className="absolute -top-1.5 left-10 w-3 h-3 bg-teal-600 rotate-45 rounded-sm" />
                      <h3 className="font-bold text-sm mb-1.5">What are Teams?</h3>
                      <p className="text-teal-100 text-xs leading-relaxed">
                        Teams are how you organize your business locations. Each team can have multiple locations,
                        members with different roles, and its own subscription plan. Set up brand voice settings
                        per location so every review reply matches your brand perfectly.
                        <span className="text-white font-medium"> Think of a team as your business or brand umbrella.</span>
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => router.push('/teams/new')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all font-semibold text-sm shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Team
                </button>
              </div>

              {/* Team Cards */}
              <div className="space-y-6">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={`bg-white rounded-2xl border-2 transition-all shadow-sm ${team.id === selectedTeamId ? 'border-teal-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    {/* Team Header */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h2 className="text-xl font-semibold text-gray-900">{team.name}</h2>
                              <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg">
                                {team.subscription?.tier || 'FREE'}
                              </span>
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                                {team.role}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/teams/${team.id}/billing`) }}
                                className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-teal-600 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 rounded-lg transition-all duration-200 cursor-pointer"
                              >
                                Manage Billing
                              </button>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {team.id === selectedTeamId ? (
                                <>
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    {locations.length} location{locations.length !== 1 ? 's' : ''}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {members.length} member{members.length !== 1 ? 's' : ''}
                                  </span>
                                </>
                              ) : (
                                <button
                                  onClick={() => setSelectedTeamId(team.id)}
                                  className="text-teal-600 hover:text-teal-700 font-medium"
                                >
                                  View details →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Three Dots Menu */}
                        {team.id === selectedTeamId && (
                          <div className="relative" ref={menuRef}>
                            <button
                              onClick={() => setIsMenuOpen(!isMenuOpen)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                            {isMenuOpen && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-10 border border-gray-100">
                                <button
                                  onClick={() => { setIsMenuOpen(false); handleLeaveTeam(); }}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  Leave Team
                                </button>
                                {isTeamAdmin && (
                                  <button
                                    onClick={() => { setIsMenuOpen(false); handleDeleteTeam(); }}
                                    className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Delete Team
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {team.id !== selectedTeamId && (
                          <div className="p-2"></div>
                        )}
                      </div>
                    </div>

                    {/* Team Details (expanded) */}
                    {team.id === selectedTeamId && (
                      <div className="p-6">
                        {loadingData ? (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Locations */}
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Locations</h3>
                                <button
                                  onClick={openAddLocationModal}
                                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors font-medium"
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
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => router.push(`/teams/${selectedTeamId}/reviews?location=${location.id}`)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900">{location.name}</div>
                                        <div className="text-sm text-gray-500">{location.address}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${location.status === 'active'
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {location.status}
                                      </span>
                                      {location.brand_voice && (
                                        <span className="px-2 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-600" title="Brand voice configured">
                                          <svg className="w-3.5 h-3.5 inline-block mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                          </svg>
                                          Voice Set
                                        </span>
                                      )}
                                      <button
                                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                                        onClick={(e) => openLocationSettings(location, e)}
                                        title="Settings"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      </button>
                                      <button
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
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
                                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <p className="text-gray-500 text-sm mb-3">No locations yet</p>
                                    <button
                                      onClick={openAddLocationModal}
                                      className="text-sm text-teal-600 hover:text-teal-800 font-medium"
                                    >
                                      + Add your first location
                                    </button>
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
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors font-medium"
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
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                                  >
                                    <div className="flex items-center gap-3">
                                      {member.avatar_url ? (
                                        <Image src={member.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full" />
                                      ) : (
                                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold">
                                          {(member.display_name || member.email).charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div>
                                        <div className="font-medium text-gray-900">{member.display_name || 'User'}</div>
                                        <div className="text-sm text-gray-500">{member.email}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
                                        {member.role}
                                      </span>
                                      {isTeamAdmin && member.role !== 'admin' && (
                                        <button
                                          onClick={() => handlePromoteAdmin(member.id)}
                                          className="text-xs text-teal-600 hover:text-teal-800 underline px-2"
                                        >
                                          Make Admin
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Pending Invites */}
                            {pendingInvites.length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Invites</h3>
                                <div className="space-y-2">
                                  {pendingInvites.map((invite) => (
                                    <div
                                      key={invite.id}
                                      className="flex items-center justify-between p-4 border border-dashed border-amber-300 bg-amber-50/50 rounded-xl"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                          </svg>
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900">{invite.invited_email}</div>
                                          <div className="text-xs text-gray-500">
                                            Invited by {invite.inviter_name} · Expires {new Date(invite.expires_at).toLocaleDateString()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg">
                                          {invite.role} · pending
                                        </span>
                                        <button
                                          onClick={() => handleCancelInvite(invite.id)}
                                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* --- Modals --- */}

          {/* Invite Modal */}
          {isInviteModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white"
                      placeholder="colleague@example.com"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingInvite}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-medium"
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
                  <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center border border-teal-100/50">
                      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 leading-tight">Brand Voice Settings</h3>
                      <p className="text-sm text-gray-500 font-medium">{editingLocation.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsLocationSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <form onSubmit={handleSaveLocationSettings} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Overall Tone & Style</label>
                      <textarea
                        value={settingsForm.brand_voice || ''}
                        onChange={e => setSettingsForm({ ...settingsForm, brand_voice: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 transition-shadow min-h-[80px] shadow-sm"
                        placeholder="e.g. Professional and friendly..."
                      />
                    </div>
                    <div className="pt-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Negative Sentiment Rules</label>
                      <textarea
                        value={settingsForm.negative_sentiment || ''}
                        onChange={e => setSettingsForm({ ...settingsForm, negative_sentiment: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 transition-shadow min-h-[120px] shadow-sm"
                        placeholder="Specific instructions for how to respond to negative reviews..."
                      />
                    </div>
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reply Language</label>
                        <select
                          value={settingsForm.reply_language || 'en'}
                          onChange={e => setSettingsForm({ ...settingsForm, reply_language: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 transition-shadow shadow-sm"
                        >
                          <option value="en">English (US)</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                        </select>
                        <p className="text-sm text-gray-500 mt-2 pl-1">Language for AI replies.</p>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reply Signature</label>
                        <select
                          value={settingsForm.signature_type || 'store_name'}
                          onChange={e =>
                            setSettingsForm({
                              ...settingsForm,
                              signature_type: e.target.value as SignaturePreset | 'custom',
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 transition-shadow shadow-sm"
                        >
                          <option value="store_name">Location Name</option>
                          <option value="team_name">Team Name</option>
                          <option value="user_name">User</option>
                          <option value="custom">Custom</option>
                        </select>
                        {settingsForm.signature_type === 'custom' && (
                          <input
                            type="text"
                            value={settingsForm.signature_custom || ''}
                            onChange={e => setSettingsForm({ ...settingsForm, signature_custom: e.target.value })}
                            placeholder="e.g. - The Team"
                            className="mt-2 w-full px-4 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 transition-shadow shadow-sm"
                          />
                        )}
                        <p className="text-sm text-gray-500 mt-2 pl-1">Sign-off for replies.</p>
                      </div>
                    </div>

                  </div>

                  <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3 mt-auto">
                    <button
                      type="button"
                      onClick={() => setIsLocationSettingsOpen(false)}
                      className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-semibold transition-colors flex items-center gap-2 shadow-sm"
                    >
                      {savingSettings ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : 'Save Settings'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add Location Modal */}
          {isLocationModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
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
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                      {modalError}
                    </div>
                  )}

                  {loadingGoogle ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
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
                          className={`flex items-start p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors ${selectedGoogleIds.includes(loc.location_id) ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-gray-200'
                            }`}
                          onClick={() => handleToggleGoogleLoc(loc.location_id)}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            checked={selectedGoogleIds.includes(loc.location_id)}
                            onChange={() => { }}
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

                <div className="p-6 border-t border-gray-200 flex justify-between items-center rounded-b-2xl bg-gray-50">
                  <button
                    onClick={() => setIsGbpHelpOpen(true)}
                    className="text-sm text-gray-500 hover:text-teal-600 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Not seeing your business?
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsLocationModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      disabled={importing}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleImport()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      disabled={importing || selectedGoogleIds.length === 0}
                    >
                      {importing ? 'Importing...' : 'Import Selected'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location Conflict Confirmation Modal */}
        {showConflictModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Heads up</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {conflictLocations.length === 1
                        ? `"${conflictLocations[0].name}" is already being managed by another team.`
                        : `${conflictLocations.length} of your selected locations are already being managed by other teams.`}
                    </p>
                  </div>
                </div>

                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                  <p className="text-sm text-teal-800">
                    <span className="font-semibold">Tip:</span> You could also ask the other team&apos;s owner to invite you, so you can collaborate on the same team.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => { setShowConflictModal(false); setConflictLocations([]) }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleImport(true)}
                  disabled={importing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding...</>
                  ) : (
                    'Yes, Add Anyway'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Team Modal */}
        {isDeleteModalOpen && selectedTeamId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              {(() => {
                const team = teams.find(t => t.id === selectedTeamId)
                const hasActivePaidSub = team?.subscription?.tier &&
                  team.subscription.tier !== 'FREE' &&
                  (team.subscription.status === 'active' || team.subscription.status === 'trialing')

                return (
                  <>
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`p-2 rounded-full ${hasActivePaidSub ? 'bg-red-100' : 'bg-gray-100'}`}>
                        <svg className={`w-6 h-6 ${hasActivePaidSub ? 'text-red-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {hasActivePaidSub ? 'Active Subscription Warning' : 'Delete Team?'}
                        </h3>
                        <p className="text-gray-600 mt-2">
                          {hasActivePaidSub ? (
                            <>
                              This team has an active <span className="font-semibold">{team?.subscription?.tier}</span> subscription.
                              <br /><br />
                              <span className="font-bold text-red-600">Deleting this team DOES NOT cancel your subscription.</span>
                              <br />
                              You will continue to be charged by Stripe unless you cancel it first.
                            </>
                          ) : (
                            'Are you sure you want to delete this team? This action cannot be undone and all team data will be permanently lost.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-6">
                      {hasActivePaidSub && (
                        <button
                          onClick={() => window.location.href = `/teams/${selectedTeamId}/billing`}
                          className="w-full py-2 px-4 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl font-medium transition-colors mb-2"
                        >
                          Go to Billing to Cancel
                        </button>
                      )}

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setIsDeleteModalOpen(false)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                          disabled={loadingData}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={executeDeleteTeam}
                          disabled={loadingData}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium disabled:opacity-50"
                        >
                          {loadingData ? 'Deleting...' : (hasActivePaidSub ? 'I Understand, Delete Anyway' : 'Delete Team')}
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GbpPermissionsModal isOpen={isGbpHelpOpen} onClose={() => setIsGbpHelpOpen(false)} />
    </>
  )
}
