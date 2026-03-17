'use client'

import { useAuth } from '@/hooks/useAuth'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────

interface Location {
  id: string
  name: string
  last_google_sync_at: string | null
  last_google_sync_status: string | null
}

interface Review {
  id: string
  location_id: string
  rating: number
  reviewer_name: string
  comment: string | null
  review_date: string
  reply_status: string
  location_name?: string
}

interface Competitor {
  id: string
  name: string
  rating: number | null
  review_count: number | null
}

// ─── Helpers ────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(displayName: string | null): string | null {
  if (!displayName) return null
  return displayName.split(' ')[0]
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function needsSync(lastSync: string | null): boolean {
  if (!lastSync) return true
  return Date.now() - new Date(lastSync).getTime() > 24 * 60 * 60 * 1000
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function TeamDashboardPage() {
  const { teamId } = useParams() as { teamId: string }
  const { user, teams, loading: authLoading } = useAuth()
  const router = useRouter()

  const currentTeam = teams.find(t => t.id === teamId) || null
  const tier = currentTeam?.subscription?.tier || 'FREE'

  const [locations, setLocations] = useState<Location[]>([])
  const [recentReviews, setRecentReviews] = useState<Review[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [dismissedCTAs, setDismissedCTAs] = useState<Set<string>>(new Set())

  const greeting = useMemo(() => getGreeting(), [])
  const firstName = user ? getFirstName(user.display_name) : null

  // ── Fetch dashboard data ──
  const fetchData = useCallback(async () => {
    if (!teamId) return
    setDataLoading(true)

    const [locsResult, reviewsResult, compsResult] = await Promise.allSettled([
      apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`),
      apiGet<{ reviews: Review[] }>(`/api/teams/${teamId}/reviews?limit=10`),
      apiGet<{ competitors: Competitor[] }>(`/api/teams/${teamId}/competitors`).catch(() => ({ competitors: [] })),
    ])

    if (locsResult.status === 'fulfilled') setLocations(locsResult.value.locations || [])
    if (reviewsResult.status === 'fulfilled') setRecentReviews(reviewsResult.value.reviews || [])
    if (compsResult.status === 'fulfilled') setCompetitors((compsResult.value as any).competitors || [])
    setDataLoading(false)
  }, [teamId])

  useEffect(() => {
    if (!authLoading && currentTeam) fetchData()
    else if (!authLoading) setDataLoading(false)
  }, [authLoading, currentTeam, fetchData])

  // ── Auto-sync stale locations ──
  useEffect(() => {
    if (dataLoading || syncing || syncResult) return
    if (locations.length > 0 && locations.some(l => needsSync(l.last_google_sync_at))) {
      handleSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, locations.length])

  // ── Sync handler ──
  const handleSync = useCallback(async () => {
    if (!teamId || syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await apiPost<{ locationsSynced: number; totalLocations: number; errors?: string[] }>(
        `/api/teams/${teamId}/reviews/sync`
      )
      setSyncResult({ synced: res.locationsSynced, errors: res.errors?.length || 0 })
      // Refresh data
      const [reviewsRes, locsRes] = await Promise.all([
        apiGet<{ reviews: Review[] }>(`/api/teams/${teamId}/reviews?limit=10`),
        apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`),
      ])
      setRecentReviews(reviewsRes.reviews || [])
      setLocations(locsRes.locations || [])
    } catch {
      setSyncResult({ synced: 0, errors: 1 })
    } finally {
      setSyncing(false)
    }
  }, [teamId, syncing])

  // ── Computed values ──
  const unrepliedReviews = recentReviews.filter(r => r.reply_status === 'none' || r.reply_status === 'draft')
  const avgRating = recentReviews.length > 0
    ? (recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length).toFixed(1)
    : '—'
  const lastSyncedLocation = locations
    .filter(l => l.last_google_sync_at)
    .sort((a, b) => new Date(b.last_google_sync_at!).getTime() - new Date(a.last_google_sync_at!).getTime())[0]

  const dismissCTA = (key: string) => setDismissedCTAs(prev => new Set(prev).add(key))

  // ── Loading state ──
  if (authLoading || dataLoading) {
    return <DashboardSkeleton />
  }

  if (!user || !currentTeam) return null

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with {currentTeam.name}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer active:scale-[0.98] ${
            syncing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
          }`}
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync Reviews'}
        </button>
      </div>

      {/* ── Sync banner ── */}
      {syncResult && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
          syncResult.errors > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-teal-50 text-teal-700 border border-teal-100'
        }`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {syncResult.errors > 0 ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            )}
          </svg>
          {syncResult.errors > 0
            ? `Synced ${syncResult.synced} location(s) with ${syncResult.errors} error(s)`
            : `Successfully synced ${syncResult.synced} location(s)`}
          <button onClick={() => setSyncResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Locations"
          value={locations.length.toString()}
          icon={<LocationIcon />}
          sub={lastSyncedLocation ? `Last sync ${timeAgo(lastSyncedLocation.last_google_sync_at!)}` : 'Never synced'}
          color="teal"
        />
        <KpiCard
          label="Avg Rating"
          value={avgRating}
          icon={<StarIconLg />}
          sub={`From ${recentReviews.length} recent reviews`}
          color="amber"
        />
        <KpiCard
          label="Needs Reply"
          value={unrepliedReviews.length.toString()}
          icon={<ReplyIcon />}
          sub={unrepliedReviews.length > 0 ? 'Reviews awaiting response' : 'All caught up!'}
          color={unrepliedReviews.length > 0 ? 'rose' : 'teal'}
        />
      </div>

      {/* ── CTA Banners ── */}
      {(() => {
        const ctas: React.ReactNode[] = []

        if (unrepliedReviews.length > 0 && !dismissedCTAs.has('unreplied')) {
          ctas.push(
            <div key="unreplied" className="flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border-l-4 border-teal-500 border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                <ReplyIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{unrepliedReviews.length} review{unrepliedReviews.length !== 1 ? 's' : ''} need a reply</p>
                <p className="text-xs text-gray-500">Respond to keep your reputation strong</p>
              </div>
              <button
                onClick={() => router.push(`/teams/${teamId}/reviews`)}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-all active:scale-[0.98] cursor-pointer shrink-0"
              >
                Reply now
              </button>
              <button onClick={() => dismissCTA('unreplied')} className="text-gray-300 hover:text-gray-500 cursor-pointer shrink-0">
                <XIcon />
              </button>
            </div>
          )
        }

        if (tier !== 'FREE' && !dismissedCTAs.has('insights')) {
          ctas.push(
            <div key="insights" className="flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border-l-4 border-violet-400 border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                <SparklesIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Uncover trends with AI Insights</p>
                <p className="text-xs text-gray-500">Get actionable recommendations from your review data</p>
              </div>
              <button
                onClick={() => router.push(`/teams/${teamId}/insights`)}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-all active:scale-[0.98] cursor-pointer shrink-0"
              >
                Run insights
              </button>
              <button onClick={() => dismissCTA('insights')} className="text-gray-300 hover:text-gray-500 cursor-pointer shrink-0">
                <XIcon />
              </button>
            </div>
          )
        }

        if (tier === 'FREE' && !dismissedCTAs.has('upgrade')) {
          ctas.push(
            <div key="upgrade" className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <TrendIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Unlock AI Insights & Competitive Analysis</p>
                <p className="text-xs text-gray-600">Upgrade to PRO to get the most out of your reviews</p>
              </div>
              <button
                onClick={() => router.push(`/teams/${teamId}/billing`)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.98] cursor-pointer shrink-0 shadow-sm"
              >
                Upgrade now
              </button>
              <button onClick={() => dismissCTA('upgrade')} className="text-amber-400 hover:text-amber-600 cursor-pointer shrink-0">
                <XIcon />
              </button>
            </div>
          )
        }

        return ctas.length > 0 ? <div className="space-y-3">{ctas.slice(0, 2)}</div> : null
      })()}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reviews — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Reviews</h2>
            <button
              onClick={() => router.push(`/teams/${teamId}/reviews`)}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
            >
              View all
            </button>
          </div>
          {recentReviews.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No reviews yet. Sync your locations to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentReviews.slice(0, 6).map(review => (
                <div key={review.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                      {review.reviewer_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{review.reviewer_name}</span>
                        <StarRating rating={review.rating} />
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(review.review_date)}</span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {review.location_name && (
                          <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{review.location_name}</span>
                        )}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                          review.reply_status === 'posted' || review.reply_status === 'synced_external'
                            ? 'bg-teal-50 text-teal-600'
                            : review.reply_status === 'draft'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {review.reply_status === 'posted' || review.reply_status === 'synced_external'
                            ? 'Replied'
                            : review.reply_status === 'draft'
                              ? 'Draft'
                              : 'No reply'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-6">
          {/* Location Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Location Status</h2>
            </div>
            {locations.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-sm text-gray-400 mb-3">No locations connected</p>
                <button
                  onClick={() => router.push(`/teams/${teamId}/locations`)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                >
                  Add a location
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {locations.map(loc => (
                  <div key={loc.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{loc.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {loc.last_google_sync_at ? `Synced ${timeAgo(loc.last_google_sync_at)}` : 'Never synced'}
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      !loc.last_google_sync_at ? 'bg-gray-300'
                        : loc.last_google_sync_status === 'success' ? 'bg-teal-400'
                          : 'bg-amber-400'
                    }`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competitors */}
          {tier !== 'FREE' && competitors.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Competitors</h2>
                <button
                  onClick={() => router.push(`/teams/${teamId}/competitive`)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                >
                  Analyze
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {competitors.slice(0, 5).map(comp => (
                  <div key={comp.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{comp.name}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {comp.rating != null && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs font-medium text-gray-600">{comp.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {comp.review_count != null && (
                        <span className="text-[11px] text-gray-400">({comp.review_count})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-1">
              <QuickAction
                label="Reply to reviews"
                icon={<ReplyIcon />}
                onClick={() => router.push(`/teams/${teamId}/reviews`)}
                badge={unrepliedReviews.length > 0 ? unrepliedReviews.length.toString() : undefined}
              />
              <QuickAction
                label="Run insights"
                icon={<InsightsIcon />}
                onClick={() => router.push(`/teams/${teamId}/insights`)}
              />
              <QuickAction
                label="Manage locations"
                icon={<LocationIcon />}
                onClick={() => router.push(`/teams/${teamId}/locations`)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function KpiCard({ label, value, icon, sub, color }: {
  label: string; value: string; icon: React.ReactNode; sub: string; color: string
}) {
  const bgMap: Record<string, string> = { teal: 'bg-teal-50', amber: 'bg-amber-50', rose: 'bg-rose-50' }
  const iconColorMap: Record<string, string> = { teal: 'text-teal-600', amber: 'text-amber-600', rose: 'text-rose-600' }
  const hoverBorderMap: Record<string, string> = { teal: 'hover:border-teal-200', amber: 'hover:border-amber-200', rose: 'hover:border-rose-200' }
  const glowMap: Record<string, string> = { teal: 'rgba(13,148,136,0.04)', amber: 'rgba(217,119,6,0.04)', rose: 'rgba(244,63,94,0.04)' }

  return (
    <div className={`group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-default ${hoverBorderMap[color] || ''}`}>
      <span className="pointer-events-none absolute -right-6 -top-6 inline-flex h-16 w-16 rounded-full bg-black/[0.02]" />
      <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-8 w-8 rounded-full bg-black/[0.02]" />
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl ${bgMap[color] || ''} flex items-center justify-center ${iconColorMap[color] || ''} transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${glowMap[color] || 'transparent'}, transparent 70%)` }}
      />
    </div>
  )
}

function QuickAction({ label, icon, onClick, badge, sub }: {
  label: string; icon: React.ReactNode; onClick: () => void; badge?: string; sub?: string
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer text-left active:scale-[0.98]"
    >
      <div className="text-gray-400">{icon}</div>
      <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{badge}</span>
      )}
      {sub && (
        <span className="text-[11px] text-gray-400">{sub}</span>
      )}
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="h-8 w-64 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-full bg-gray-50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ──────────────────────────────────────────────────────

function LocationIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function StarIconLg() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
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

function SparklesIcon() {
  return (
    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
