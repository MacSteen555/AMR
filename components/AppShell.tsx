'use client'

import { useAuth } from '@/hooks/useAuth'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { apiGet } from '@/lib/api'

interface Team {
  id: string
  name: string
  role: string
  subscription: {
    tier: string
    status: string
  } | null
  creditBalance: number
}

interface Location {
  id: string
  name: string
  google_place_id?: string
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, teams, loading, refresh } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(teams[0] || null)
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsOpen, setLocationsOpen] = useState(true)
  const [teamsOpen, setTeamsOpen] = useState(false)
  const teamDropdownRef = useRef<HTMLDivElement>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!teams.length) return
    if (selectedTeam && teams.find(t => t.id === selectedTeam.id)) return
    setSelectedTeam(teams[0])
  }, [teams])

  useEffect(() => {
    if (!pathname || !teams.length) return
    const match = pathname.match(/\/teams\/([^/]+)/)
    if (match && match[1] !== 'new') {
      const teamIdFromUrl = match[1]
      if (teamIdFromUrl !== selectedTeam?.id) {
        const urlTeam = teams.find(t => t.id === teamIdFromUrl)
        if (urlTeam) {
          setSelectedTeam(urlTeam)
        } else if (!isRefreshing && refresh) {
          setIsRefreshing(true)
          refresh().finally(() => setIsRefreshing(false))
        }
      }
    }
  }, [pathname, teams, selectedTeam?.id, isRefreshing, refresh])

  const currentTeam = selectedTeam || teams[0] || null
  const credits = currentTeam?.creditBalance || 0
  const tier = currentTeam?.subscription?.tier || 'FREE'

  useEffect(() => {
    if (!currentTeam) return
    apiGet<{ locations: Location[] }>(`/api/teams/${currentTeam.id}/locations`)
      .then(res => setLocations(res.locations || []))
      .catch(() => setLocations([]))
  }, [currentTeam?.id])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return null
  }

  const activeLocationId = pathname?.match(/\/locations\/([^/]+)/)?.[1] || null

  function getCurrentSection(): string {
    if (!pathname) return 'reviews'
    if (pathname.includes('/insights')) return 'insights'
    if (pathname.includes('/competitive')) return 'competitive'
    if (pathname.includes('/billing')) return 'billing'
    return 'reviews'
  }

  function buildLocationUrl(locationId: string): string {
    const section = getCurrentSection()
    if (section === 'insights') return `/locations/${locationId}/insights`
    return `/locations/${locationId}/reviews`
  }

  function buildTeamUrl(teamId: string, section?: string): string {
    const s = section || getCurrentSection()
    switch (s) {
      case 'insights': return `/teams/${teamId}/insights`
      case 'competitive': return `/teams/${teamId}/competitive`
      case 'billing': return `/teams/${teamId}/billing`
      default: return `/teams/${teamId}/reviews`
    }
  }

  const tierColors: Record<string, string> = {
    FREE: 'bg-gray-100 text-gray-600',
    PRO: 'bg-teal-50 text-teal-700',
    BUSINESS: 'bg-amber-50 text-amber-700',
    ENTERPRISE: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="flex h-screen bg-gray-50/80">
      {/* Sidebar */}
      <aside className="w-[272px] bg-white border-r border-gray-200/80 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src="/images/amber_teal-logo.png" alt="AutoMyReply" className="h-8 w-auto" />
            <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
          </button>
        </div>

        {/* Team Selector */}
        {currentTeam && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="relative" ref={teamDropdownRef}>
              <button
                onClick={() => setTeamsOpen(!teamsOpen)}
                className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl transition-all duration-200 cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-bold text-sm">{currentTeam.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className="text-sm font-semibold text-gray-900 truncate">{currentTeam.name}</div>
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColors[tier] || tierColors.FREE}`}>
                      {tier}
                    </span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${teamsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {teamsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-lg shadow-gray-200/50 z-50 py-1.5 text-left" style={{ animation: 'fadeSlideUp 0.15s ease-out' }}>
                  <div className="px-3 pb-1.5 mb-1.5 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch team</span>
                  </div>
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team)
                        setTeamsOpen(false)
                        setLocations([])
                        apiGet<{ locations: Location[] }>(`/api/teams/${team.id}/locations`)
                          .then(res => setLocations(res.locations || []))
                          .catch(() => setLocations([]))
                        router.push(buildTeamUrl(team.id))
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between transition-all duration-200 rounded-lg mx-auto cursor-pointer active:scale-[0.98] ${team.id === currentTeam.id ? 'bg-teal-50/60' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${team.id === currentTeam.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-medium truncate ${team.id === currentTeam.id ? 'text-teal-700' : 'text-gray-700'}`}>{team.name}</span>
                          <span className="text-[10px] text-gray-400">{team.subscription?.tier || 'FREE'}</span>
                        </div>
                      </div>
                      {team.id === currentTeam.id && (
                        <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1.5 pt-1.5">
                    <button
                      onClick={() => { setTeamsOpen(false); router.push('/teams') }}
                      className="w-full text-left px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 font-medium transition-all duration-200 rounded-lg cursor-pointer flex items-center gap-2 active:scale-[0.98]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage Teams
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Location Selector */}
            <div className="mt-3">
              <button
                onClick={() => setLocationsOpen(!locationsOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Locations</span>
                  {locations.length > 0 && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{locations.length}</span>
                  )}
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${locationsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {locationsOpen && (
                <div className="mt-1 ml-3 pl-3 border-l-2 border-gray-100 space-y-0.5">
                  <button
                    onClick={() => router.push(buildTeamUrl(currentTeam.id))}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98] ${!activeLocationId && pathname?.includes(`/teams/${currentTeam.id}`)
                      ? 'bg-teal-50 text-teal-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    All Locations
                  </button>

                  {locations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => router.push(buildLocationUrl(loc.id))}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-all duration-200 truncate flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeLocationId === loc.id
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      title={loc.name}
                    >
                      <svg className={`w-3 h-3 flex-shrink-0 ${activeLocationId === loc.id ? 'text-teal-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                      <span className="truncate">{loc.name}</span>
                    </button>
                  ))}

                  {locations.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">
                      No locations yet
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {currentTeam ? (
            <>
              <NavItem
                href={activeLocationId ? `/locations/${activeLocationId}/reviews` : `/teams/${currentTeam.id}/reviews`}
                icon={<ReviewIcon />}
                label="Reviews"
                active={pathname?.includes('/reviews')}
              />
              <NavItem
                href={activeLocationId ? `/locations/${activeLocationId}/insights` : `/teams/${currentTeam.id}/insights`}
                icon={<InsightsIcon />}
                label="Insights"
                active={pathname?.includes('/insights')}
              />
              <NavItem
                href={`/teams/${currentTeam.id}/competitive`}
                icon={<CompeteIcon />}
                label="Compete"
                active={pathname?.includes('/competitive')}
                badge={tier === 'FREE' ? 'PRO+' : undefined}
                disabled={tier === 'FREE'}
              />
            </>
          ) : (
            <div className="text-center py-8 px-4 text-gray-500 text-sm">
              Create a team to get started
            </div>
          )}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <NavItem
              href="/teams"
              icon={<TeamsIcon />}
              label="Teams"
              active={pathname === '/teams'}
            />
            <NavItem
              href="/settings"
              icon={<SettingsIcon />}
              label="Settings"
              active={pathname === '/settings'}
            />
          </div>
        </nav>

        {/* Credits & User */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          {/* Credits */}
          <div className="flex items-center justify-between bg-gray-50 rounded-2xl border border-gray-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-teal-600 leading-none">{credits}</div>
                <div className="text-[10px] text-gray-400 font-medium">credits left</div>
              </div>
            </div>
            {currentTeam && (
              <button
                onClick={() => router.push(`/teams/${currentTeam.id}/billing`)}
                className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:border-teal-200 hover:bg-teal-50 text-gray-500 hover:text-teal-600 rounded-lg transition-all duration-200 font-medium cursor-pointer active:scale-[0.98]"
              >
                Top up
              </button>
            )}
          </div>

          {/* User */}
          <button
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-xl transition-all duration-200 cursor-pointer group active:scale-[0.98]"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full ring-2 ring-gray-100" />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm ring-2 ring-teal-100">
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user.display_name || 'User'}</div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
  active,
  badge,
  disabled
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: string
  disabled?: boolean
}) {
  const router = useRouter()

  return (
    <button
      onClick={() => !disabled && router.push(href)}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] ${active
        ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
        : disabled
          ? 'text-gray-300 cursor-not-allowed'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? 'text-white' : disabled ? 'text-gray-300' : 'text-gray-400'}>
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${active ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-600'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function LoadingScreen() {
  return (
    <div className="flex h-screen bg-gray-50/80">
      {/* Skeleton Sidebar */}
      <aside className="w-[272px] bg-white border-r border-gray-200/80 flex flex-col shrink-0">
        {/* Logo skeleton */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-5 w-28 rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>

        {/* Team selector skeleton */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 p-2.5">
            <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-24 rounded-md bg-gray-100 animate-pulse" />
              <div className="h-3 w-12 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
          {/* Location skeletons */}
          <div className="mt-3 ml-3 pl-3 border-l-2 border-gray-100 space-y-1">
            <div className="h-4 w-20 rounded-md bg-gray-100 animate-pulse mx-3 my-2" />
            <div className="h-4 w-32 rounded-md bg-gray-50 animate-pulse mx-3 my-2" />
            <div className="h-4 w-28 rounded-md bg-gray-50 animate-pulse mx-3 my-2" />
          </div>
        </div>

        {/* Nav items skeleton */}
        <div className="flex-1 px-4 py-4 space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-5 h-5 rounded bg-gray-100 animate-pulse" />
              <div className={`h-4 rounded-md bg-gray-100 animate-pulse ${i === 1 ? 'w-16' : i === 2 ? 'w-14' : 'w-18'}`} style={{ width: i === 1 ? 64 : i === 2 ? 56 : 72 }} />
            </div>
          ))}
          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1.5">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-5 h-5 rounded bg-gray-50 animate-pulse" />
                <div className="h-4 rounded-md bg-gray-50 animate-pulse" style={{ width: i === 1 ? 48 : 56 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Credits & user skeleton */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse" />
              <div className="space-y-1">
                <div className="h-5 w-8 rounded bg-gray-100 animate-pulse" />
                <div className="h-2.5 w-14 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-14 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 p-2.5">
            <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-20 rounded-md bg-gray-100 animate-pulse" />
              <div className="h-3 w-32 rounded-md bg-gray-50 animate-pulse" />
            </div>
          </div>
        </div>
      </aside>

      {/* Skeleton Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 w-48 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          {/* Card skeletons */}
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-40 rounded-md bg-gray-100 animate-pulse" />
                <div className="h-4 w-20 rounded-md bg-gray-50 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded bg-gray-50 animate-pulse" />
                <div className="h-3.5 w-3/4 rounded bg-gray-50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function ReviewIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function InsightsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CompeteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TeamsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
