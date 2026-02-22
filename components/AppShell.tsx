'use client'

import { useAuth } from '@/hooks/useAuth'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  const { user, teams, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(teams[0] || null)
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsOpen, setLocationsOpen] = useState(true)

  const currentTeam = selectedTeam || teams[0] || null
  const credits = currentTeam?.creditBalance || 0
  const tier = currentTeam?.subscription?.tier || 'FREE'

  // Fetch locations for current team
  useEffect(() => {
    if (!currentTeam) return
    apiGet<{ locations: Location[] }>(`/api/teams/${currentTeam.id}/locations`)
      .then(res => setLocations(res.locations || []))
      .catch(() => setLocations([]))
  }, [currentTeam?.id])

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return null
  }

  // Derive active location from pathname
  const activeLocationId = pathname?.match(/\/locations\/([^/]+)/)?.[1] || null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              A
            </div>
            <span className="text-xl font-bold text-gray-900">AutoMyReply</span>
          </button>
        </div>

        {/* Team Selector */}
        {currentTeam && (
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => router.push('/teams')}
              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">{currentTeam.name}</div>
                  <div className="text-xs text-indigo-600">{tier}</div>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {currentTeam ? (
            <>
              {/* Location Selector */}
              <div>
                <button
                  onClick={() => setLocationsOpen(!locationsOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${pathname?.includes('/locations') && !pathname?.includes('/reviews')
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={pathname?.includes('/locations') && !pathname?.includes('/reviews') ? 'text-white' : 'text-gray-500'}>
                      <LocationIcon />
                    </div>
                    <span className="text-sm font-medium">Locations</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${locationsOpen ? 'rotate-180' : ''} ${pathname?.includes('/locations') && !pathname?.includes('/reviews') ? 'text-white' : 'text-gray-400'
                      }`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {locationsOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l-2 border-gray-100 space-y-0.5">
                    {/* All Locations (Team View) */}
                    <button
                      onClick={() => router.push(`/teams/${currentTeam.id}/reviews`)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${pathname === `/teams/${currentTeam.id}/reviews` && !activeLocationId
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      📊 All Locations
                    </button>

                    {/* Individual Locations */}
                    {locations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => router.push(`/locations/${loc.id}/reviews`)}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors truncate ${activeLocationId === loc.id
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        title={loc.name}
                      >
                        📍 {loc.name}
                      </button>
                    ))}

                    {locations.length === 0 && (
                      <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                        No locations yet
                      </div>
                    )}
                  </div>
                )}
              </div>

              <NavItem
                href={`/teams/${currentTeam.id}/reviews`}
                icon={<ReviewIcon />}
                label="Reviews"
                active={pathname?.includes('/reviews') && !activeLocationId}
              />
              <NavItem
                href={`/teams/${currentTeam.id}/insights`}
                icon={<InsightsIcon />}
                label="Insights"
                active={pathname?.includes('/insights')}
                badge={tier === 'FREE' ? 'PRO+' : undefined}
                disabled={tier === 'FREE'}
              />
              <NavItem
                href={`/teams/${currentTeam.id}/competitive`}
                icon={<CompeteIcon />}
                label="Compete"
                active={pathname?.includes('/competitive')}
                badge={tier === 'FREE' || tier === 'PRO' ? 'BUSINESS+' : undefined}
                disabled={tier === 'FREE' || tier === 'PRO'}
              />
            </>
          ) : (
            <div className="text-center py-8 px-4 text-gray-500 text-sm">
              Create a team to get started
            </div>
          )}
          <div className="pt-4 mt-4 border-t border-gray-200">
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
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-600">Credits</span>
            </div>
            <span className="text-lg font-bold text-indigo-600">{credits}</span>
          </div>

          <button
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-900">{user.display_name || 'User'}</div>
              <div className="text-xs text-gray-500 truncate">{user.email}</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
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
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${active
        ? 'bg-indigo-600 text-white'
        : disabled
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-700 hover:bg-gray-100'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? 'text-white' : disabled ? 'text-gray-400' : 'text-gray-500'}>
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge && (
        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
          {badge}
        </span>
      )}
    </button>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

// Navigation Icons
function LocationIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function InsightsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CompeteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TeamsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
