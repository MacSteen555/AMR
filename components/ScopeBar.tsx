'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { apiGet, apiPost } from '@/lib/api'
import type { Team } from '@/hooks/useAuth'

interface Location {
  id: string
  name: string
  google_place_id?: string
}

interface ScopeBarProps {
  teams: Team[]
  onMobileMenuToggle?: () => void
  mobileMenuOpen?: boolean
}

// Pages that support location-level filtering
const LOCATION_ENABLED_SECTIONS = ['reviews', 'insights', 'reports']

function getCurrentSection(pathname: string | null): string {
  if (!pathname) return 'reviews'
  if (pathname.includes('/insights')) return 'insights'
  if (pathname.includes('/reports')) return 'reports'
  if (pathname.includes('/competitive')) return 'competitive'
  if (pathname.includes('/billing')) return 'billing'
  if (pathname.includes('/reviews')) return 'reviews'
  // Dashboard (/teams/[id]) or other pages without a sub-path
  return 'dashboard'
}

export function ScopeBar({ teams, onMobileMenuToggle, mobileMenuOpen }: ScopeBarProps) {
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params?.teamId as string | undefined
  const currentTeam = teams.find(t => t.id === teamId) || null
  // Fallback to first team for logo link and team dropdown on non-team pages (/teams, /settings)
  const displayTeam = currentTeam || (teams.length > 0 ? teams[0] : null)
  const selectedLocationId = searchParams?.get('location') || null
  const section = getCurrentSection(pathname)
  // Only show location dropdown on team-scoped pages with reviews/insights
  const showLocationDropdown = !!teamId && LOCATION_ENABLED_SECTIONS.includes(section)

  const [contactOpen, setContactOpen] = useState(false)
  const [featureOpen, setFeatureOpen] = useState(false)

  const [locations, setLocations] = useState<Location[]>([])
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [locationsOpen, setLocationsOpen] = useState(false)
  const teamDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch locations when team changes
  useEffect(() => {
    if (!displayTeam) return
    apiGet<{ locations: Location[] }>(`/api/teams/${displayTeam.id}/locations`)
      .then(res => setLocations(res.locations || []))
      .catch(() => setLocations([]))
  }, [displayTeam?.id])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamsOpen(false)
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setLocationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTeamSwitch = (newTeamId: string) => {
    setTeamsOpen(false)
    setLocations([])
    // Clear stored location for the old team so we start fresh
    if (teamId) {
      try { sessionStorage.removeItem('amr:location:' + teamId) } catch { /* noop */ }
    }
    // Navigate to same section on new team, drop location param
    router.push(`/teams/${newTeamId}/${section}`)
  }

  const handleLocationSwitch = (locationId: string | null) => {
    setLocationsOpen(false)
    if (!teamId) return
    // Persist to sessionStorage so filter survives cross-page navigation
    try {
      const key = 'amr:location:' + teamId
      if (locationId) sessionStorage.setItem(key, locationId)
      else sessionStorage.removeItem(key)
    } catch { /* SSR / private browsing */ }
    const searchQuery = new URLSearchParams(searchParams?.toString() || '')
    if (locationId) {
      searchQuery.set('location', locationId)
    } else {
      searchQuery.delete('location')
    }
    const qs = searchQuery.toString()
    router.replace(`/teams/${teamId}/${section}${qs ? `?${qs}` : ''}`)
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId)

  // Don't render if user has no teams at all
  if (!displayTeam) return null

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 md:gap-4 shrink-0 z-50">
      {/* Mobile menu toggle */}
      {onMobileMenuToggle && (
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}

      {/* Logo */}
      <Link
        href={`/teams/${displayTeam.id}/reviews`}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
      >
        <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={28} height={28} className="h-7 w-auto" />
        <span className="text-base font-bold text-gray-900 hidden sm:block">AutoMyReply</span>
      </Link>

      {/* Divider — only show if there's something after it */}
      {(teams.length > 1 || showLocationDropdown) && (
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}

      {/* Team Dropdown — only if 2+ teams */}
      {teams.length > 1 && (
        <div className="relative" ref={teamDropdownRef}>
          <button
            onClick={() => setTeamsOpen(!teamsOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium text-gray-700"
          >
            <div className="w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{displayTeam.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="max-w-[100px] sm:max-w-[140px] truncate">{displayTeam.name}</span>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${teamsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {teamsOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[200px]" style={{ animation: 'fadeSlideUp 0.15s ease-out' }}>
              <div className="px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch team</span>
              </div>
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSwitch(team.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${team.id === displayTeam.id ? 'bg-teal-50/60' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${team.id === displayTeam.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`truncate ${team.id === displayTeam.id ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>{team.name}</span>
                  </div>
                  {team.id === displayTeam.id && (
                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Location Dropdown — only on location-enabled pages */}
      {showLocationDropdown && (
        <>
          {teams.length > 1 && (
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <div className="relative" ref={locationDropdownRef}>
            <button
              onClick={() => setLocationsOpen(!locationsOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium text-gray-700"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="max-w-[120px] sm:max-w-[180px] truncate">
                {selectedLocation ? selectedLocation.name : 'All Locations'}
              </span>
              {locations.length > 0 && (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{locations.length}</span>
              )}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${locationsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {locationsOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[220px]" style={{ animation: 'fadeSlideUp 0.15s ease-out' }}>
                {/* All Locations */}
                <button
                  onClick={() => handleLocationSwitch(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${!selectedLocationId ? 'bg-teal-50/60 text-teal-700 font-medium' : 'text-gray-700'}`}
                >
                  All Locations
                  {!selectedLocationId && (
                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Separator */}
                {locations.length > 0 && <div className="border-t border-gray-100 my-1" />}

                {/* Individual locations */}
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleLocationSwitch(loc.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer truncate ${selectedLocationId === loc.id ? 'bg-teal-50/60 text-teal-700 font-medium' : 'text-gray-700'}`}
                    title={loc.name}
                  >
                    <span className="truncate">{loc.name}</span>
                    {selectedLocationId === loc.id && (
                      <svg className="w-4 h-4 text-teal-600 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}

                {locations.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400 italic">No locations yet</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => setFeatureOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-gray-500 hover:text-gray-700"
          title="Feature Request"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-medium hidden sm:inline">Feedback</span>
        </button>
        <button
          onClick={() => setContactOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-gray-500 hover:text-gray-700"
          title="Contact Us"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium hidden sm:inline">Help</span>
        </button>
      </div>

      {/* Contact Us Modal */}
      {contactOpen && (
        <ContactModal
          teamName={displayTeam?.name}
          onClose={() => setContactOpen(false)}
        />
      )}

      {/* Feature Request Modal */}
      {featureOpen && (
        <FeatureRequestModal
          teamName={displayTeam?.name}
          onClose={() => setFeatureOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function ContactModal({ teamName, onClose }: { teamName?: string; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await apiPost('/api/contact', { message: message.trim(), teamName })
      setStatus('sent')
    } catch {
      setStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Contact Us</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {status === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Message sent!</p>
              <p className="text-xs text-gray-500">We&apos;ll get back to you as soon as possible.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">Have a question or need help? Send us a message and we&apos;ll get back to you.</p>
              <textarea
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y"
              />
              {status === 'error' && (
                <p className="text-xs text-red-600 mt-2">Failed to send. Please try again.</p>
              )}
            </>
          )}
        </div>
        {status !== 'sent' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureRequestModal({ teamName, onClose }: { teamName?: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return
    setSending(true)
    try {
      await apiPost('/api/feature-request', { title: title.trim(), description: description.trim(), teamName })
      setStatus('sent')
    } catch {
      setStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Feature Request</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {status === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Request submitted!</p>
              <p className="text-xs text-gray-500">Thanks for the feedback. We review every request.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">Have an idea for AutoMyReply? We&apos;d love to hear it.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Bulk reply to reviews"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the feature and how it would help you..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y"
                />
              </div>
              {status === 'error' && (
                <p className="text-xs text-red-600">Failed to submit. Please try again.</p>
              )}
            </>
          )}
        </div>
        {status !== 'sent' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || sending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {sending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
