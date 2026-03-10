'use client'

import { useAuth } from '@/hooks/useAuth'
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation'
import { ScopeBar } from '@/components/ScopeBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, teams, loading } = useAuth()
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params?.teamId as string | undefined
  const currentTeam = teams.find(t => t.id === teamId) || null
  // Fallback to first team for nav links and credits when not on a team-scoped page
  const navTeam = currentTeam || (teams.length > 0 ? teams[0] : null)
  const credits = navTeam?.creditBalance || 0
  const tier = navTeam?.subscription?.tier || 'FREE'

  const locationQs = searchParams?.get('location') ? '?location=' + searchParams.get('location') : ''

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50/80">
      <ScopeBar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[240px] bg-white border-r border-gray-200/80 flex flex-col shrink-0">
          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navTeam ? (
              <>
                <NavItem
                  href={`/teams/${navTeam.id}/reviews${locationQs}`}
                  icon={<ReviewIcon />}
                  label="Reviews"
                  active={pathname?.includes('/reviews')}
                />
                <NavItem
                  href={`/teams/${navTeam.id}/insights${locationQs}`}
                  icon={<InsightsIcon />}
                  label="Insights"
                  active={pathname?.includes('/insights')}
                />
                <NavItem
                  href={`/teams/${navTeam.id}/competitive`}
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
              {navTeam && (
                <button
                  onClick={() => router.push(`/teams/${navTeam.id}/billing`)}
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
          <div className="page-enter">{children}</div>
        </main>
      </div>
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
    <div className="flex flex-col h-screen bg-gray-50/80">
      {/* Top bar skeleton */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-4 w-24 rounded-md bg-gray-100 animate-pulse" />
        </div>
        <div className="w-px h-6 bg-gray-100" />
        <div className="h-4 w-32 rounded-md bg-gray-100 animate-pulse" />
        <div className="w-px h-6 bg-gray-100" />
        <div className="h-4 w-28 rounded-md bg-gray-100 animate-pulse" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Skeleton Sidebar */}
        <aside className="w-[240px] bg-white border-r border-gray-200/80 flex flex-col shrink-0">
          {/* Nav items skeleton */}
          <div className="flex-1 px-4 py-4 space-y-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-5 h-5 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 rounded-md bg-gray-100 animate-pulse" style={{ width: i === 1 ? 64 : i === 2 ? 56 : 72 }} />
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
