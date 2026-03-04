'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { Toast } from '@/components/Toast'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
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
}

interface TimePoint { month: string; averageRating: number | null; count: number }
interface VolumePoint { month: string; total: number; positive: number; neutral: number; negative: number }
interface ResponseRatePoint { month: string; rate: number | null; replied: number; total: number }
interface RatingBucket { rating: number; count: number }

interface AnalyticsData {
  kpis: KPIs
  ratingOverTime: TimePoint[]
  volumeOverTime: VolumePoint[]
  responseRateOverTime: ResponseRatePoint[]
  ratingDistribution: RatingBucket[]
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
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
    // Legacy format support
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

// ─── Chart Formatters ────────────────────────────────────────────────────────

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

export default function LocationInsightsPage() {
  const { locationId } = useParams() as { locationId: string }
  const router = useRouter()
  const [period, setPeriod] = useState<PeriodKey>('6m')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [tier, setTier] = useState<string>('FREE')
  const [teamId, setTeamId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const { start, end } = useMemo(() => getPeriodDates(period), [period])

  useEffect(() => {
    loadData()
  }, [locationId, start, end])

  const loadData = async () => {
    setLoading(true)
    try {
      const [analyticsRes, insightsRes] = await Promise.all([
        apiGet<{ analytics: AnalyticsData; tier: string; teamId?: string }>(`/api/locations/${locationId}/insights/data?period_start=${start}&period_end=${end}`),
        apiGet<{ insights: AIInsight[] }>(`/api/locations/${locationId}/insights/run?period_window=${period}`),
      ])
      setAnalytics(analyticsRes.analytics)
      setTier(analyticsRes.tier || 'FREE')
      if (analyticsRes.teamId) setTeamId(analyticsRes.teamId)
      setAiInsights(insightsRes.insights || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load insights', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInsights = async () => {
    setGenerating(true)
    try {
      await apiPost(`/api/locations/${locationId}/insights/run`, {})
      setToast({ message: 'AI insights generated!', type: 'success' })
      const insightsRes = await apiGet<{ insights: AIInsight[] }>(`/api/locations/${locationId}/insights/run?period_window=${period}`)
      setAiInsights(insightsRes.insights || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to generate insights', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const kpis = analytics?.kpis
  const latestAI = aiInsights[0] || null

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Insights</h1>
            <p className="text-gray-500 mt-1">Review analytics and AI-powered insights for this location.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPeriod(opt.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === opt.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : !analytics || kpis?.totalReviews === 0 ? (
          <div className="text-center py-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No review data yet</h2>
            <p className="text-gray-500">Sync your reviews first to see analytics here.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KPICard
                label="Total Reviews"
                value={kpis!.totalReviews.toLocaleString()}
                icon={<ChatIcon />}
                color="indigo"
              />
              <KPICard
                label="Average Rating"
                value={kpis!.averageRating.toFixed(1)}
                suffix="/ 5"
                icon={<StarIcon />}
                color="yellow"
              />
              <KPICard
                label="Response Rate"
                value={`${kpis!.responseRate.toFixed(0)}%`}
                icon={<ReplyIcon />}
                color="green"
              />
              <KPICard
                label="Positive Reviews"
                value={`${kpis!.positivePercent.toFixed(0)}%`}
                icon={<ThumbsUpIcon />}
                color="emerald"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Rating Over Time */}
              <ChartCard title="Average Rating Over Time" subtitle="Monthly trend">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.ratingOverTime.filter(d => d.averageRating !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      formatter={(value: any) => [Number(value).toFixed(2), 'Avg Rating']}
                      labelFormatter={(label: any) => formatMonth(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageRating"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ fill: '#6366f1', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
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
                    <Tooltip
                      labelFormatter={(label: any) => formatMonth(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive (4-5)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="neutral" stackId="a" fill="#eab308" name="Neutral (3)" />
                    <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative (1-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Response Rate Over Time */}
              <ChartCard title="Response Rate Over Time" subtitle="Percentage of reviews replied to">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={analytics.responseRateOverTime.filter(d => d.rate !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Response Rate']}
                      labelFormatter={(label: any) => formatMonth(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <defs>
                      <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#responseGradient)"
                      dot={{ fill: '#6366f1', r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Rating Distribution */}
              <ChartCard title="Rating Distribution" subtitle="Breakdown by star rating">
                <div className="px-4 pt-2">
                  {analytics.ratingDistribution.map(bucket => {
                    const pct = kpis!.totalReviews > 0
                      ? (bucket.count / kpis!.totalReviews) * 100
                      : 0
                    return (
                      <div key={bucket.rating} className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1 w-16 text-sm font-medium text-gray-700">
                          {bucket.rating} <span className="text-yellow-400">★</span>
                        </div>
                        <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: RATING_COLORS[bucket.rating],
                            }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm text-gray-600">
                          {bucket.count} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Sentiment Donut */}
                <div className="flex items-center justify-center gap-6 pt-2 pb-1 border-t border-gray-100 mt-2">
                  {Object.entries(analytics.sentimentBreakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SENTIMENT_COLORS[key as keyof typeof SENTIMENT_COLORS] }}
                      />
                      <span className="text-sm text-gray-600 capitalize">{key}</span>
                      <span className="text-sm font-semibold text-gray-900">{val}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

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
                {tier === 'FREE' ? (
                  <button
                    onClick={() => router.push(teamId ? `/teams/${teamId}/billing` : '#')}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-medium text-sm flex items-center gap-2 shadow hover:shadow-md transition-all"
                  >
                    <SparklesIcon /> Upgrade Now
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generating}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2 transition-colors"
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
                        Generate Insights (3 credits)
                      </>
                    )}
                  </button>
                )}
              </div>

              {tier === 'FREE' ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-12 text-center shadow-inner">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-amber-500">
                    <SparklesIcon />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">PRO Subscription Required</h3>
                  <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                    Upgrade to the PRO plan to automatically analyze customer sentiment, extract key themes, and get actionable recommendations for this location.
                  </p>
                  <button
                    onClick={() => router.push(teamId ? `/teams/${teamId}/billing` : '#')}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-bold shadow transition-all"
                  >
                    Upgrade Now
                  </button>
                </div>
              ) : latestAI ? (
                <AIInsightsPanel insight={latestAI} />
              ) : (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-12 text-center">
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No AI insights yet</h3>
                  <p className="text-gray-500 text-sm mb-4">Generate AI-powered analysis to uncover hidden patterns in your reviews.</p>
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generating}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                  >
                    Generate First Report
                  </button>
                </div>
              )}

              {/* Past Insights */}
              {aiInsights.length > 1 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Reports</h3>
                  <div className="space-y-2">
                    {aiInsights.slice(1).map(insight => (
                      <details key={insight.id} className="bg-white border border-gray-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                          <span className="font-medium">{insight.period_start} to {insight.period_end}</span>
                          <span className="text-gray-400 ml-3">
                            Generated {new Date(insight.generated_at).toLocaleDateString()}
                          </span>
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
  label: string
  value: string
  suffix?: string
  icon: React.ReactNode
  color: string
}) {
  const bgMap: Record<string, string> = {
    indigo: 'bg-indigo-50',
    yellow: 'bg-yellow-50',
    green: 'bg-green-50',
    emerald: 'bg-emerald-50',
  }
  const iconColorMap: Record<string, string> = {
    indigo: 'text-indigo-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${bgMap[color]} rounded-lg flex items-center justify-center ${iconColorMap[color]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {suffix && <span className="text-lg text-gray-400">{suffix}</span>}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function AIInsightsPanel({ insight }: { insight: AIInsight }) {
  const d = insight.data

  // Support both new and legacy formats
  const summary = d.executiveSummary || d.summary || ''
  const strengths = d.keyStrengths || []
  const weaknesses = d.keyWeaknesses || []
  const topics = d.emergingTopics || []
  const alerts = d.riskAlerts || []
  const recs = d.recommendations || []
  const quotes = d.notableQuotes || []

  const urgencyColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const impactColors: Record<string, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {summary && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
          <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
            <SparklesIcon /> Executive Summary
          </h4>
          <p className="text-gray-700 leading-relaxed">{summary}</p>
          {d.ratingTrend && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${d.ratingTrend === 'improving' ? 'bg-green-100 text-green-700' :
                d.ratingTrend === 'declining' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                {d.ratingTrend === 'improving' ? '↑' : d.ratingTrend === 'declining' ? '↓' : '→'}
                {d.ratingTrend.charAt(0).toUpperCase() + d.ratingTrend.slice(1)}
              </span>
              {d.ratingTrendDescription && (
                <span className="text-sm text-gray-500">{d.ratingTrendDescription}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risk Alerts */}
      {alerts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Risk Alerts</h4>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`p-4 rounded-lg border ${urgencyColors[alert.urgency] || urgencyColors.low}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{alert.title}</span>
                  <span className="text-xs uppercase font-bold opacity-60">{alert.urgency}</span>
                </div>
                <p className="text-sm opacity-80">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Key Strengths
            </h4>
            <div className="space-y-2">
              {strengths.map((s, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-green-800">{s.theme}</span>
                    {s.mentionCount > 0 && (
                      <span className="text-xs text-green-600">{s.mentionCount} mentions</span>
                    )}
                  </div>
                  <p className="text-sm text-green-700">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {weaknesses.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Key Weaknesses
            </h4>
            <div className="space-y-2">
              {weaknesses.map((w, i) => (
                <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-red-800">{w.theme}</span>
                    <div className="flex items-center gap-2">
                      {w.mentionCount > 0 && (
                        <span className="text-xs text-red-600">{w.mentionCount} mentions</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${w.severity === 'high' ? 'bg-red-200 text-red-800' :
                        w.severity === 'medium' ? 'bg-amber-200 text-amber-800' :
                          'bg-gray-200 text-gray-700'
                        }`}>{w.severity}</span>
                    </div>
                  </div>
                  <p className="text-sm text-red-700">{w.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Emerging Topics */}
      {topics.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Emerging Topics</h4>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <div key={i} className={`px-4 py-2 rounded-lg border text-sm ${t.sentiment === 'positive' ? 'bg-green-50 border-green-200 text-green-800' :
                t.sentiment === 'negative' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                <span className="font-semibold">{t.topic}</span>
                <span className="opacity-60 ml-1">- {t.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recommendations</h4>
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900">{r.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${impactColors[r.impact] || impactColors.low}`}>
                      {r.impact} impact
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      {r.effort} effort
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notable Quotes */}
      {quotes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Notable Customer Voices</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quotes.map((q, i) => (
              <div key={i} className={`p-4 rounded-lg border-l-4 bg-gray-50 ${q.sentiment === 'positive' ? 'border-l-green-500' : 'border-l-red-500'
                }`}>
                <p className="text-sm text-gray-700 italic mb-2">"{q.quote}"</p>
                <div className="flex text-yellow-400 text-xs">
                  {'★'.repeat(q.rating)}{'☆'.repeat(5 - q.rating)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Persona */}
      {d.customerPersona && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-purple-800 mb-1">Typical Reviewer</h4>
          <p className="text-sm text-purple-700">{d.customerPersona}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>Generated {new Date(insight.generated_at).toLocaleString()}</span>
        <span>Model: {insight.model}</span>
        <span>Period: {insight.period_start} to {insight.period_end}</span>
      </div>
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

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
