'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'

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
  comment: string
  review_date: string
  reply_status: string
  location_name?: string
}

interface InsightRow {
  id: string
  period_window: string
  data: any
  generated_at: string
}

interface Competitor {
  id: string
  name: string
  rating: number | null
  review_count: number | null
  last_serp_sync_at: string | null
}

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
  const last = new Date(lastSync)
  const now = new Date()
  return now.getTime() - last.getTime() > 24 * 60 * 60 * 1000
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

export default function DashboardPage() {
  const { user, teams, loading } = useAuth()
  const router = useRouter()

  const currentTeam = teams[0] || null
  const credits = currentTeam?.creditBalance || 0
  const tier = currentTeam?.subscription?.tier || 'FREE'

  const [locations, setLocations] = useState<Location[]>([])
  const [recentReviews, setRecentReviews] = useState<Review[]>([])
  const [latestInsight, setLatestInsight] = useState<InsightRow | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  const greeting = useMemo(() => getGreeting(), [])
  const firstName = user ? getFirstName(user.display_name) : null

  // Fetch all dashboard data
  useEffect(() => {
    if (!currentTeam) return
    setDataLoading(true)

    Promise.allSettled([
      apiGet<{ locations: Location[] }>(`/api/teams/${currentTeam.id}/locations`),
      apiGet<{ reviews: Review[] }>(`/api/teams/${currentTeam.id}/reviews?limit=10`),
      apiGet<{ competitors: Competitor[] }>(`/api/teams/${currentTeam.id}/competitors`).catch(() => ({ competitors: [] })),
    ]).then(([locsResult, reviewsResult, compsResult]) => {
      if (locsResult.status === 'fulfilled') setLocations(locsResult.value.locations || [])
      if (reviewsResult.status === 'fulfilled') setRecentReviews(reviewsResult.value.reviews || [])
      if (compsResult.status === 'fulfilled') setCompetitors((compsResult.value as any).competitors || [])
      setDataLoading(false)
    })
  }, [currentTeam?.id])

  // Fetch latest insight
  useEffect(() => {
    if (!currentTeam) return
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    apiGet<{ insights: InsightRow[] }>(
      `/api/teams/${currentTeam.id}/insights?period_start=${thirtyDaysAgo.toISOString().split('T')[0]}&period_end=${now.toISOString().split('T')[0]}`
    )
      .then(res => {
        const insights = res.insights || []
        if (insights.length > 0) {
          setLatestInsight(insights.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0])
        }
      })
      .catch(() => {})
  }, [currentTeam?.id])

  const locationsNeedingSync = locations.filter(l => needsSync(l.last_google_sync_at))
  const lastSyncedLocation = locations
    .filter(l => l.last_google_sync_at)
    .sort((a, b) => new Date(b.last_google_sync_at!).getTime() - new Date(a.last_google_sync_at!).getTime())[0]

  const handleSync = useCallback(async () => {
    if (!currentTeam || syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await apiPost<{ locationsSynced: number; totalLocations: number; errors?: string[] }>(
        `/api/teams/${currentTeam.id}/reviews/sync`
      )
      setSyncResult({ synced: res.locationsSynced, errors: res.errors?.length || 0 })
      // Refresh reviews after sync
      const reviewsRes = await apiGet<{ reviews: Review[] }>(`/api/teams/${currentTeam.id}/reviews?limit=10`)
      setRecentReviews(reviewsRes.reviews || [])
      // Refresh locations for updated sync times
      const locsRes = await apiGet<{ locations: Location[] }>(`/api/teams/${currentTeam.id}/locations`)
      setLocations(locsRes.locations || [])
    } catch {
      setSyncResult({ synced: 0, errors: 1 })
    } finally {
      setSyncing(false)
    }
  }, [currentTeam, syncing])

  // Auto-sync if needed
  useEffect(() => {
    if (!dataLoading && locationsNeedingSync.length > 0 && locations.length > 0 && !syncing && !syncResult) {
      handleSync()
    }
  }, [dataLoading, locationsNeedingSync.length, locations.length])

  const unrepliedReviews = recentReviews.filter(r => r.reply_status === 'none' || r.reply_status === 'draft')
  const avgRating = recentReviews.length > 0
    ? (recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length).toFixed(1)
    : '—'

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  // No teams — onboarding
  if (!currentTeam) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {greeting}{firstName ? `, ${firstName}` : ''}!
            </h1>
            <p className="text-gray-600 mb-8">
              Create your first team to start managing your Google Business Profile reviews
            </p>
            <button
              onClick={() => router.push('/teams/new')}
              className="cursor-pointer px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:scale-[0.98] transition-all duration-200"
            >
              Create Your First Team
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
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

      {/* Sync status banner */}
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
            : `Successfully synced ${syncResult.synced} location(s)`
          }
          <button onClick={() => setSyncResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Locations"
          value={locations.length.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          sub={lastSyncedLocation ? `Last sync ${timeAgo(lastSyncedLocation.last_google_sync_at!)}` : 'Never synced'}
          color="teal"
        />
        <KpiCard
          label="Avg Rating"
          value={avgRating}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
          sub={`From ${recentReviews.length} recent reviews`}
          color="amber"
        />
        <KpiCard
          label="Needs Reply"
          value={unrepliedReviews.length.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
          sub={unrepliedReviews.length > 0 ? 'Reviews awaiting response' : 'All caught up!'}
          color={unrepliedReviews.length > 0 ? 'rose' : 'teal'}
        />
        <KpiCard
          label="Credits"
          value={credits.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          sub={tier}
          color="violet"
          onClick={() => router.push(`/teams/${currentTeam.id}/billing`)}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reviews — takes 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Reviews</h2>
            <button
              onClick={() => router.push(`/teams/${currentTeam.id}/reviews`)}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
            >
              View all
            </button>
          </div>
          {dataLoading ? (
            <div className="p-5 space-y-4">
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
          ) : recentReviews.length === 0 ? (
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

        {/* Right column */}
        <div className="space-y-6">
          {/* Location Sync Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Location Status</h2>
            </div>
            {dataLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : locations.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-sm text-gray-400 mb-3">No locations connected</p>
                <button
                  onClick={() => router.push(`/teams/${currentTeam.id}/locations`)}
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
                  onClick={() => router.push(`/teams/${currentTeam.id}/competitive`)}
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
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                }
                onClick={() => router.push(`/teams/${currentTeam.id}/reviews`)}
                badge={unrepliedReviews.length > 0 ? unrepliedReviews.length.toString() : undefined}
              />
              <QuickAction
                label="Run insights"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                onClick={() => router.push(`/teams/${currentTeam.id}/insights`)}
                sub="3 credits"
              />
              <QuickAction
                label="Manage team"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                onClick={() => router.push('/teams')}
              />
              <QuickAction
                label="Add credits"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                }
                onClick={() => router.push(`/teams/${currentTeam.id}/billing`)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, sub, color, onClick }: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  color: string
  onClick?: () => void
}) {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
  }
  const c = colorClasses[color] || colorClasses.teal

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left ${onClick ? 'cursor-pointer hover:border-gray-200 transition-colors active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </Component>
  )
}

function QuickAction({ label, icon, onClick, badge, sub }: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  badge?: string
  sub?: string
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
