'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Toast } from '@/components/Toast'
import { AIInsightsPanel } from '@/components/AIInsightsPanel'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  totalReviews: number
  averageRating: number
  responseRate: number
  averageResponseTimeHours: number | null
  positivePercent: number
  negativePercent: number
  locationCount: number
}

interface TimePoint { month: string; averageRating: number | null; count: number }
interface VolumePoint { month: string; total: number; positive: number; neutral: number; negative: number }
interface ResponseRatePoint { month: string; rate: number | null; replied: number; total: number }
interface RatingBucket { rating: number; count: number }
interface LocationStat {
  locationId: string
  locationName: string
  totalReviews: number
  averageRating: number
  responseRate: number
}

interface TeamAnalytics {
  kpis: KPIs
  ratingOverTime: TimePoint[]
  volumeOverTime: VolumePoint[]
  responseRateOverTime: ResponseRatePoint[]
  ratingDistribution: RatingBucket[]
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  perLocation: LocationStat[]
}

interface AIInsight {
  id: string
  period_start: string
  period_end: string
  period_window: string | null
  data: {
    executiveSummary?: string
    ratingTrend?: string
    ratingTrendDescription?: string
    keyStrengths?: Array<{ theme: string; description: string; mentionCount: number }>
    keyWeaknesses?: Array<{ theme: string; description: string; mentionCount: number; severity: string }>
    emergingTopics?: Array<{ topic: string; sentiment: string; description: string }>
    riskAlerts?: Array<{ title: string; description: string; urgency: string }>
    recommendations?: Array<{ title: string; description: string; impact: string; effort: string }>
    customerPersona?: string
    notableQuotes?: Array<{ quote: string; rating: number; sentiment: string }>
    summary?: string
    topThemes?: string[]
  }
  generated_at: string
  model: string
}

// ─── Period Helpers ──────────────────────────────────────────────────────────

type PeriodKey = '30d' | '90d' | '6m' | '1y' | 'all'

function getPeriodDates(key: PeriodKey): { start: string; end: string } {
  const end = new Date()
  const endStr = end.toISOString().split('T')[0]
  const start = new Date()
  switch (key) {
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '6m': start.setMonth(start.getMonth() - 6); break
    case '1y': start.setFullYear(start.getFullYear() - 1); break
    case 'all': start.setFullYear(start.getFullYear() - 5); break
  }
  return { start: start.toISOString().split('T')[0], end: endStr }
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: '6m', label: 'Last 6 months' },
  { key: '1y', label: 'Last year' },
]

function formatMonth(month: any): string {
  if (typeof month !== 'string') return String(month)
  const [y, m] = month.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const RATING_COLORS: Record<number, string> = {
  5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444',
}

const SENTIMENT_COLORS = { positive: '#22c55e', neutral: '#eab308', negative: '#ef4444' }

// ─── Component ───────────────────────────────────────────────────────────────

export default function TeamInsightsPage() {
  const { teamId } = useParams() as { teamId: string }
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationId = searchParams?.get('location') || null
  const isTeamView = !locationId
  const { teams } = useAuth()
  const [period, setPeriod] = useState<PeriodKey>('6m')
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null)
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const currentTeam = teams.find(t => t.id === teamId)
  const tier = currentTeam?.subscription?.tier || 'FREE'
  const insightsEnabled = tier !== 'FREE'

  const { start, end } = useMemo(() => getPeriodDates(period), [period])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const locParam = locationId ? `&location=${locationId}` : ''
      const [analyticsRes, insightsRes] = await Promise.all([
        apiGet<any>(`/api/teams/${teamId}/insights/data?period_start=${start}&period_end=${end}${locParam}`),
        apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?period_window=${period}${locParam}`),
      ])
      setAnalytics(analyticsRes.analytics)
      setAiInsights(insightsRes.insights || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load insights', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [teamId, locationId, start, end, period])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGenerateInsights = async () => {
    setGenerating(true)
    try {
      const locParam = locationId ? `?location=${locationId}` : ''
      await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, {})
      setToast({ message: 'AI insights generated!', type: 'success' })
      const locQp = locationId ? `&location=${locationId}` : ''
      const insightsRes = await apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?period_window=${period}${locQp}`)
      setAiInsights(insightsRes.insights || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to generate insights', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  // removed full page gate

  const kpis = analytics?.kpis
  const latestAI = aiInsights[0] || null

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{isTeamView ? 'Team Insights' : 'Insights'}</h1>
            <p className="text-gray-500 mt-1">{isTeamView ? 'Review analytics across all your locations.' : 'Review analytics and AI-powered insights for this location.'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPeriod(opt.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 active:scale-[0.98] ${period === opt.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className={`grid grid-cols-2 ${isTeamView ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
              {Array.from({ length: isTeamView ? 5 : 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-56 bg-gray-100 rounded mb-4" />
                  <div className="h-[260px] bg-gray-50 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="h-4 w-44 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-64 bg-gray-100 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ) : !analytics || kpis?.totalReviews === 0 ? (
          <div className="text-center py-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="w-14 h-14 mx-auto mb-4 text-gray-400">
              <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h2v8H3zM9 8h2v13H9zM15 11h2v10h-2zM21 4h2v17h-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No review data yet</h2>
            <p className="text-gray-500">Sync your reviews first to see analytics here.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className={`grid grid-cols-2 ${isTeamView ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-8`}>
              <KPICard label="Total Reviews" value={kpis!.totalReviews.toLocaleString()} icon={<ChatIcon />} color="teal" />
              <KPICard label="Average Rating" value={kpis!.averageRating.toFixed(1)} suffix="/ 5" icon={<StarIcon />} color="yellow" />
              <KPICard label="Response Rate" value={`${kpis!.responseRate.toFixed(0)}%`} icon={<ReplyIcon />} color="green" />
              <KPICard label="Positive" value={`${kpis!.positivePercent.toFixed(0)}%`} icon={<ThumbsUpIcon />} color="emerald" />
              {isTeamView && <KPICard label="Locations" value={String(kpis!.locationCount)} icon={<LocationIcon />} color="amber" />}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Rating Over Time */}
              <ChartCard title="Average Rating Over Time" subtitle={isTeamView ? "Monthly trend across all locations" : "Monthly rating trend"}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.ratingOverTime.filter(d => d.averageRating !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      formatter={(value: any, name: any) => [Number(value).toFixed(2), name === 'averageRating' ? (isTeamView ? 'Team Avg' : 'Avg Rating') : name]}
                      labelFormatter={(label: any) => formatMonth(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Line type="monotone" dataKey="averageRating" name={isTeamView ? 'Team Avg' : 'Avg Rating'} stroke="#0d9488" strokeWidth={3} dot={{ fill: '#0d9488', r: 4 }} activeDot={{ r: 6 }} />
                    {isTeamView && analytics.perLocation?.map((loc, i) => (
                      <Line
                        key={loc.locationId}
                        type="monotone"
                        dataKey={loc.locationName}
                        name={loc.locationName}
                        stroke={`hsl(${i * 137.5 % 360}, 70%, 50%)`}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Review Volume */}
              <ChartCard title="Review Volume" subtitle="Monthly breakdown by sentiment">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.volumeOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip labelFormatter={(label: any) => formatMonth(label)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive (4-5)" />
                    <Bar dataKey="neutral" stackId="a" fill="#eab308" name="Neutral (3)" />
                    <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative (1-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Response Rate Over Time */}
              {isTeamView ? (
                <ChartCard title="Response Rate Over Time" subtitle="Percentage of reviews replied to">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={analytics.responseRateOverTime.filter(d => d.rate !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={v => `${v}%`} />
                      <Tooltip
                        formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name === 'rate' ? 'Team Avg' : name]}
                        labelFormatter={(label: any) => formatMonth(label)}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <defs>
                        <linearGradient id="teamResponseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="rate" name="Team Avg" stroke="#0d9488" strokeWidth={3} fill="url(#teamResponseGradient)" dot={{ fill: '#0d9488', r: 3 }} />
                      {analytics.perLocation?.map((loc, i) => (
                        <Line
                          key={loc.locationId}
                          type="monotone"
                          dataKey={loc.locationName}
                          name={loc.locationName}
                          stroke={`hsl(${i * 137.5 % 360}, 70%, 50%)`}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              ) : (
                <ChartCard title="Response Rate Over Time" subtitle="Percentage of reviews replied to">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={analytics.responseRateOverTime.filter(d => d.rate !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Response Rate']} labelFormatter={(label: any) => formatMonth(label)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <defs>
                        <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2.5} fill="url(#responseGradient)" dot={{ fill: '#0d9488', r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Rating Distribution */}
              <ChartCard title="Rating Distribution" subtitle="Breakdown by star rating">
                <div className="px-4 pt-2">
                  {analytics.ratingDistribution.map(bucket => {
                    const pct = kpis!.totalReviews > 0 ? (bucket.count / kpis!.totalReviews) * 100 : 0
                    return (
                      <div key={bucket.rating} className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1 w-16 text-sm font-medium text-gray-700">
                          {bucket.rating} <span className="text-yellow-400">★</span>
                        </div>
                        <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: RATING_COLORS[bucket.rating] }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm text-gray-600">
                          {bucket.count} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 pt-2 pb-1 border-t border-gray-100 mt-2">
                  {Object.entries(analytics.sentimentBreakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[key as keyof typeof SENTIMENT_COLORS] }} />
                      <span className="text-sm text-gray-600 capitalize">{key}</span>
                      <span className="text-sm font-semibold text-gray-900">{val}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            {/* Per-Location Breakdown */}
            {isTeamView && analytics.perLocation?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 mb-8 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">Location Breakdown</h3>
                  <p className="text-xs text-gray-400">Performance comparison across locations</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviews</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Rating</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Response Rate</th>
                        <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.perLocation?.map((loc, i) => (
                        <tr
                          key={loc.locationId}
                          className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-25'}`}
                          onClick={() => {
                            const searchQuery = new URLSearchParams(searchParams?.toString() || '')
                            searchQuery.set('location', loc.locationId)
                            router.replace(`/teams/${teamId}/insights?${searchQuery.toString()}`)
                          }}
                        >
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-medium text-gray-900 hover:text-teal-600">{loc.locationName}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-gray-600">{loc.totalReviews}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="text-sm font-semibold text-gray-900">{loc.averageRating.toFixed(1)}</span>
                            <span className="text-yellow-400 ml-1 text-xs">★</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`text-sm font-semibold ${loc.responseRate >= 80 ? 'text-green-600' : loc.responseRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {loc.responseRate.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(loc.averageRating / 5) * 100}%`,
                                  backgroundColor: loc.averageRating >= 4 ? '#22c55e' : loc.averageRating >= 3 ? '#eab308' : '#ef4444',
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI Insights Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI-Powered Insights</h2>
                  <p className="text-sm text-gray-500">
                    {latestAI ? (
                      <>Last generated {new Date(latestAI.generated_at).toLocaleDateString()} for {PERIOD_OPTIONS.find(o => o.key === period)?.label || period}</>
                    ) : (
                      <>Deep analysis generated by AI (3 credits)</>
                    )}
                  </p>
                </div>
                {!insightsEnabled ? (
                  <button
                    onClick={() => router.push(`/teams/${teamId}/billing`)}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-medium text-sm flex items-center gap-2 shadow hover:shadow-md transition-all duration-200 active:scale-[0.98]"
                  >
                    <SparklesIcon /> Upgrade Now
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generating}
                    className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2 transition-all duration-200 active:scale-[0.98]"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : latestAI ? (
                      <>
                        <SparklesIcon />
                        Regenerate (3 credits)
                      </>
                    ) : (
                      <>
                        <SparklesIcon />
                        {isTeamView ? 'Generate Team Insights (3 credits)' : 'Generate Insights (3 credits)'}
                      </>
                    )}
                  </button>
                )}
              </div>

              {!insightsEnabled ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-12 text-center shadow-inner">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-amber-500">
                    <SparklesIcon />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">PRO Subscription Required</h3>
                  <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                    Upgrade to the PRO plan to automatically analyze customer sentiment, extract key themes, and get actionable recommendations.
                  </p>
                  <button
                    onClick={() => router.push(`/teams/${teamId}/billing`)}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-bold shadow transition-all duration-200 active:scale-[0.98]"
                  >
                    Upgrade Now
                  </button>
                </div>
              ) : latestAI ? (
                <AIInsightsPanel insight={latestAI} />
              ) : (
                <div className="bg-teal-50 rounded-xl border border-teal-100 p-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 text-teal-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No AI insights yet</h3>
                  <p className="text-gray-500 text-sm mb-4">Generate AI-powered analysis to uncover hidden patterns across all your locations.</p>
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generating}
                    className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium transition-all duration-200 active:scale-[0.98]"
                  >
                    Generate First Report
                  </button>
                </div>
              )}

              {aiInsights.length > 1 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Reports</h3>
                  <div className="space-y-2">
                    {aiInsights.slice(1).map(insight => (
                      <details key={insight.id} className="bg-white border border-gray-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                          <span className="font-medium">{insight.period_start} to {insight.period_end}</span>
                          <span className="text-gray-400 ml-3">Generated {new Date(insight.generated_at).toLocaleDateString()}</span>
                        </summary>
                        <div className="px-4 pb-4">
                          <AIInsightsPanel insight={insight} />
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({ label, value, suffix, icon, color }: {
  label: string; value: string; suffix?: string; icon: React.ReactNode; color: string
}) {
  const bgMap: Record<string, string> = {
    teal: 'bg-teal-50', yellow: 'bg-yellow-50', green: 'bg-green-50',
    emerald: 'bg-emerald-50', amber: 'bg-amber-50',
  }
  const iconColorMap: Record<string, string> = {
    teal: 'text-teal-600', yellow: 'text-yellow-600', green: 'text-green-600',
    emerald: 'text-emerald-600', amber: 'text-amber-600',
  }
  const hoverBorderMap: Record<string, string> = {
    teal: 'hover:border-teal-200', yellow: 'hover:border-yellow-200', green: 'hover:border-green-200',
    emerald: 'hover:border-emerald-200', amber: 'hover:border-amber-200',
  }
  return (
    <div className={`group relative bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${hoverBorderMap[color] || ''} cursor-default`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-3">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900 tracking-tight">{value}</span>
            {suffix && <span className="text-lg text-gray-400 font-medium">{suffix}</span>}
          </div>
        </div>
        <div className={`${bgMap[color]} ${iconColorMap[color]} p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color === 'teal' ? 'rgba(13,148,136,0.04)' : color === 'amber' ? 'rgba(217,119,6,0.04)' : color === 'yellow' ? 'rgba(234,179,8,0.04)' : color === 'green' ? 'rgba(34,197,94,0.04)' : 'rgba(16,185,129,0.04)'}, transparent 70%)` }}
      />
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
function ReplyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  )
}
function ThumbsUpIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  )
}
function LocationIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
