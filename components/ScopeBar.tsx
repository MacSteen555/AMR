'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'

interface Location {
  id: string
  name: string
  google_place_id?: string
}

// Pages that support location-level filtering
const LOCATION_ENABLED_SECTIONS = ['reviews', 'insights']

function getCurrentSection(pathname: string | null): string {
  if (!pathname) return 'reviews'
  if (pathname.includes('/insights')) return 'insights'
  if (pathname.includes('/competitive')) return 'competitive'
  if (pathname.includes('/billing')) return 'billing'
  return 'reviews'
}

export function ScopeBar() {
  const { teams } = useAuth()
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
    // Navigate to same section on new team, drop location param
    router.push(`/teams/${newTeamId}/${section}`)
  }

  const handleLocationSwitch = (locationId: string | null) => {
    setLocationsOpen(false)
    if (!teamId) return
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (locationId) {
      params.set('location', locationId)
    } else {
      params.delete('location')
    }
    const qs = params.toString()
    router.replace(`/teams/${teamId}/${section}${qs ? `?${qs}` : ''}`)
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId)

  // Don't render if user has no teams at all
  if (!displayTeam) return null

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0 z-50">
      {/* Logo */}
      <Link
        href={`/teams/${displayTeam.id}/reviews`}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
      >
        <img src="/images/amber_teal-logo.png" alt="AutoMyReply" className="h-7 w-auto" />
        <span className="text-base font-bold text-gray-900 hidden sm:block">AutoMyReply</span>
      </Link>

      {/* Divider — only show if there's something after it */}
      {(teams.length > 1 || showLocationDropdown) && <div className="w-px h-6 bg-gray-200" />}

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
            <span className="max-w-[140px] truncate">{displayTeam.name}</span>
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
          {teams.length > 1 && <div className="w-px h-6 bg-gray-200" />}
          <div className="relative" ref={locationDropdownRef}>
            <button
              onClick={() => setLocationsOpen(!locationsOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium text-gray-700"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="max-w-[180px] truncate">
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
    </div>
  )
}
