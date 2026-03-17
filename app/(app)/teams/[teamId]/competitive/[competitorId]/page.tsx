'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiGet, apiPatch, apiDelete } from '@/lib/api'
import { CompetitiveReportPanel } from '@/components/CompetitiveReportPanel'
import { Toast } from '@/components/Toast'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Competitor {
  id: string
  name: string
  place_id: string
  address?: string
  rating?: number
  review_count?: number
  location_ids: string[]
  latest_report_date: string | null
}

interface CompetitiveRun {
  id: string
  competitor_ids: string[]
  created_at: string
  data: Record<string, any>
  owned_location_ids: string[]
  model: string
}

interface DeltaComparison {
  scoreChange?: number
  momentumChange?: number
  newThreats?: string[]
  resolvedThreats?: string[]
  summary?: string
}

interface Location {
  id: string
  name: string
  address?: string
}

interface CompetitorReview {
  id: string
  rating: number
  reviewer_name: string | null
  reviewer_is_local_guide: boolean | null
  reviewer_reviews_count: number | null
  comment: string | null
  review_date: string
  owner_response: string | null
  likes: number | null
}

type Timeframe = '30d' | '90d' | '6m' | '1y'
type MainTab = 'report' | 'reviews' | 'metrics'

const TIMEFRAMES: Timeframe[] = ['30d', '90d', '6m', '1y']

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '30d': '30 days',
  '90d': '90 days',
  '6m': '6 months',
  '1y': '1 year',
}

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'report', label: 'Report' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'metrics', label: 'Metrics' },
]

const TEAL_500 = '#14b8a6'
const TEAL_600 = '#0d9488'
const GRAY_400 = '#9ca3af'

// ─── Sub-components ─────────────────────────────────────────────────────────

function DeltaBanner({ delta }: { delta: DeltaComparison }) {
  if (!delta) return null

  const hasChanges =
    delta.scoreChange != null ||
    delta.momentumChange != null ||
    (delta.newThreats && delta.newThreats.length > 0) ||
    (delta.resolvedThreats && delta.resolvedThreats.length > 0)

  if (!hasChanges && !delta.summary) return null

  return (
    <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/80 to-emerald-50/50 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span className="text-sm font-semibold text-teal-800">Since last report</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {delta.scoreChange != null && (
          <div className="flex items-center gap-1.5 bg-white/80 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Score</span>
            <span className={`text-sm font-bold ${delta.scoreChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {delta.scoreChange > 0 ? '+' : ''}{delta.scoreChange}
            </span>
          </div>
        )}
        {delta.momentumChange != null && (
          <div className="flex items-center gap-1.5 bg-white/80 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Momentum</span>
            <span className={`text-sm font-bold ${delta.momentumChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {delta.momentumChange > 0 ? '+' : ''}{delta.momentumChange}
            </span>
          </div>
        )}
        {delta.newThreats && delta.newThreats.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white/80 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">New threats</span>
            <span className="text-sm font-bold text-red-500">{delta.newThreats.length}</span>
          </div>
        )}
        {delta.resolvedThreats && delta.resolvedThreats.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white/80 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Resolved</span>
            <span className="text-sm font-bold text-emerald-600">{delta.resolvedThreats.length}</span>
          </div>
        )}
      </div>
      {delta.summary && (
        <p className="text-sm text-teal-700/80 leading-relaxed">{delta.summary}</p>
      )}
    </div>
  )
}

function MainTabNav({
  active,
  onChange,
}: {
  active: MainTab
  onChange: (t: MainTab) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1.5 w-fit mb-6">
      {MAIN_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
            active === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function TimeframeTabs({
  active,
  onChange,
}: {
  active: Timeframe
  onChange: (t: Timeframe) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
            active === tf
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

function ReportHistory({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: CompetitiveRun[]
  selectedRunId: string | null
  onSelect: (run: CompetitiveRun) => void
}) {
  if (runs.length <= 1) return null

  return (
    <div className="mt-10">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Report History</h3>
      <div className="space-y-2">
        {runs.map((run) => {
          const isActive = run.id === selectedRunId
          const date = new Date(run.created_at)
          return (
            <button
              key={run.id}
              onClick={() => onSelect(run)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-teal-50/60 border-teal-200 ring-1 ring-teal-100'
                  : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-sm font-medium ${isActive ? 'text-teal-800' : 'text-gray-700'}`}>
                    {date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {date.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {isActive && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                    Viewing
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EditLocationsModal({
  open,
  onClose,
  competitorId,
  teamId,
  currentLocationIds,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  competitorId: string
  teamId: string
  currentLocationIds: string[]
  onSaved: (ids: string[]) => void
}) {
  const [locations, setLocations] = useState<Location[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentLocationIds))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(currentLocationIds))
    setLoading(true)
    apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`)
      .then((res) => setLocations(res.locations))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, teamId, currentLocationIds])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiPatch(`/api/competitors/${competitorId}/locations`, {
        location_ids: Array.from(selected),
      })
      onSaved(Array.from(selected))
      onClose()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-black/10">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Competing Locations</h3>
        <p className="text-sm text-gray-500 mb-5">
          Select up to 3 of your locations that compete with this business.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No locations found for this team.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {locations.map((loc) => {
              const isSelected = selected.has(loc.id)
              const disabled = !isSelected && selected.size >= 3
              return (
                <label
                  key={loc.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isSelected
                      ? 'bg-teal-50/50 border-teal-200 ring-1 ring-teal-100'
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(loc.id)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500/30"
                  />
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-teal-800' : 'text-gray-700'}`}>
                      {loc.name}
                    </div>
                    {loc.address && (
                      <div className="text-xs text-gray-400 truncate">{loc.address}</div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selected.size === 0}
            className="px-5 py-2.5 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-xl
                       shadow-sm shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed
                       active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stars helper ───────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ─── Reviews Tab ────────────────────────────────────────────────────────────

function ReviewsTab({ competitorId }: { competitorId: string }) {
  const [reviews, setReviews] = useState<CompetitorReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiGet<{ reviews: CompetitorReview[] }>(`/api/competitors/${competitorId}/reviews?limit=50`)
      .then((res) => setReviews(res.reviews))
      .catch(() => setError('Failed to load reviews'))
      .finally(() => setLoading(false))
  }, [competitorId])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
            <div className="h-3 w-full bg-gray-100 rounded mb-2" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center">
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center">
        <p className="text-gray-500">No reviews synced yet.</p>
        <p className="text-xs text-gray-400 mt-2">Reviews will be available after the next sync.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-2xl border border-gray-100 bg-white p-5">
          {/* Header: stars, name, badges, date */}
          <div className="flex items-center flex-wrap gap-2 mb-2.5">
            <Stars rating={review.rating} />
            {review.reviewer_name && (
              <span className="text-sm font-medium text-gray-700">{review.reviewer_name}</span>
            )}
            {review.reviewer_is_local_guide && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                Local Guide
              </span>
            )}
            {review.reviewer_reviews_count != null && review.reviewer_reviews_count > 0 && (
              <span className="text-[11px] text-gray-400">
                {review.reviewer_reviews_count} review{review.reviewer_reviews_count !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {new Date(review.review_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Comment */}
          {review.comment ? (
            <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
          ) : (
            <p className="text-sm text-gray-300 italic">No comment</p>
          )}

          {/* Likes */}
          {review.likes != null && review.likes > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              {review.likes}
            </div>
          )}

          {/* Owner response */}
          {review.owner_response && (
            <div className="mt-3 ml-4 pl-4 border-l-2 border-teal-200 bg-teal-50/40 rounded-r-xl py-3 pr-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-xs font-semibold text-teal-700">Owner Response</span>
              </div>
              <p className="text-sm text-teal-800/80 leading-relaxed">{review.owner_response}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Chart Card wrapper ─────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4">{title}</h4>
      {children}
    </div>
  )
}

// ─── Metrics Tab ────────────────────────────────────────────────────────────

interface TrendPoint {
  month: string
  youRating: number | null
  youVolume: number
  themRating: number | null
  themVolume: number
}

function MetricsTab({
  runs,
  selectedRun,
  competitorId,
  activeTimeframe,
  onTimeframeChange,
}: {
  runs: CompetitiveRun[]
  selectedRun: CompetitiveRun | null
  competitorId: string
  activeTimeframe: Timeframe
  onTimeframeChange: (t: Timeframe) => void
}) {
  const reportData = selectedRun?.data?.[activeTimeframe] || null
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [trendsLoading, setTrendsLoading] = useState(true)

  // Fetch monthly trends from actual review dates
  useEffect(() => {
    setTrendsLoading(true)
    apiGet<{ timeline: TrendPoint[] }>(`/api/competitors/${competitorId}/trends`)
      .then(res => setTrends(res.timeline || []))
      .catch(() => {})
      .finally(() => setTrendsLoading(false))
  }, [competitorId])

  // Format month labels: "2026-01" -> "Jan"
  const formatMonth = (m: string) => {
    const [year, month] = m.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  // Prepare line chart data from trends
  const ratingTimeline = trends
    .filter(t => t.youRating != null || t.themRating != null)
    .map(t => ({ month: formatMonth(t.month), You: t.youRating, Them: t.themRating }))

  const volumeTimeline = trends
    .filter(t => t.youVolume > 0 || t.themVolume > 0)
    .map(t => ({ month: formatMonth(t.month), You: t.youVolume, Them: t.themVolume }))

  // Position score over time from runs (one per report, still useful)
  const positionOverTime = useMemo(() => {
    const points = runs
      .filter(r => r.data?.[activeTimeframe]?.competitivePositionScore != null)
      .map(r => ({
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Score: r.data[activeTimeframe].competitivePositionScore,
      }))
      .reverse()
    return points.length >= 2 ? points : null
  }, [runs, activeTimeframe])

  if (!reportData && ratingTimeline.length === 0) {
    return (
      <>
        <div className="mb-6">
          <TimeframeTabs active={activeTimeframe} onChange={onTimeframeChange} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center">
          <p className="text-gray-500">
            No data available for the <span className="font-medium text-gray-700">{TIMEFRAME_LABELS[activeTimeframe]}</span> window.
          </p>
          <p className="text-xs text-gray-400 mt-2">Try selecting a different timeframe above.</p>
        </div>
      </>
    )
  }

  const headToHead = reportData?.headToHead?.[0]
  const responseComparison = reportData?.responseComparison
  const sentimentComparison = reportData?.sentimentComparison

  // Current snapshot data for bar charts
  const comparisonData = headToHead ? [
    { metric: 'Rating', You: headToHead.yourRating, Them: headToHead.theirRating },
    { metric: 'Reviews', You: headToHead.yourVolume, Them: headToHead.theirVolume },
  ] : null

  const responseAndSentiment = []
  if (responseComparison) {
    responseAndSentiment.push({
      metric: 'Response Rate',
      You: responseComparison.yourResponseRate ?? 0,
      Them: responseComparison.competitorAvgResponseRate ?? 0,
    })
  }
  if (sentimentComparison) {
    responseAndSentiment.push({
      metric: 'Sentiment',
      You: sentimentComparison.yourSentiment ?? 0,
      Them: sentimentComparison.competitorSentiment ?? 0,
    })
  }

  return (
    <>
      <div className="mb-6">
        <TimeframeTabs active={activeTimeframe} onChange={onTimeframeChange} />
      </div>

      {trendsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-[300px] animate-pulse">
              <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
              <div className="h-[230px] bg-gray-50 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Monthly Rating Trend (from actual review dates) */}
        {ratingTimeline.length >= 2 && (
          <ChartCard title="Average Rating by Month">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ratingTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="You" stroke={TEAL_600} strokeWidth={2.5} dot={{ fill: TEAL_600, r: 4 }} connectNulls />
                <Line type="monotone" dataKey="Them" stroke={GRAY_400} strokeWidth={2.5} dot={{ fill: GRAY_400, r: 4 }} strokeDasharray="6 3" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 2. Monthly Review Volume (from actual review dates) */}
        {volumeTimeline.length >= 2 && (
          <ChartCard title="Review Volume by Month">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={volumeTimeline} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="You" fill={TEAL_600} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Them" fill={GRAY_400} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 3. Head-to-Head Snapshot (latest report) */}
        {comparisonData && (
          <ChartCard title="Head-to-Head Snapshot">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="You" fill={TEAL_600} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Them" fill={GRAY_400} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 4. Response Rate & Sentiment Snapshot */}
        {responseAndSentiment.length > 0 && (
          <ChartCard title="Response & Sentiment">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={responseAndSentiment} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="You" fill={TEAL_600} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Them" fill={GRAY_400} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 5. Competitive Position Score Over Time (from reports) */}
        {positionOverTime && (
          <ChartCard title="Competitive Position Over Time">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={positionOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Line type="monotone" dataKey="Score" stroke={TEAL_600} strokeWidth={2.5} dot={{ fill: TEAL_600, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CompetitorDetailPage() {
  const params = useParams<{ teamId: string; competitorId: string }>()
  const router = useRouter()
  const { teamId, competitorId } = params

  const [competitor, setCompetitor] = useState<Competitor | null>(null)
  const [runs, setRuns] = useState<CompetitiveRun[]>([])
  const [selectedRun, setSelectedRun] = useState<CompetitiveRun | null>(null)
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('30d')
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('report')
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(false)
  const [editLocationsOpen, setEditLocationsOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [compRes, runsRes] = await Promise.all([
        apiGet<{ competitors: Competitor[] }>(`/api/teams/${teamId}/competitors`),
        apiGet<{ runs: CompetitiveRun[] }>(
          `/api/teams/${teamId}/competitive-runs?competitorId=${competitorId}`
        ),
      ])

      const found = compRes.competitors.find((c) => c.id === competitorId)
      if (!found) {
        setToast({ message: 'Competitor not found', type: 'error' })
        router.push(`/teams/${teamId}/competitive`)
        return
      }

      setCompetitor(found)
      setRuns(runsRes.runs)

      if (runsRes.runs.length > 0) {
        setSelectedRun(runsRes.runs[0])
      }
    } catch {
      setToast({ message: 'Failed to load competitor data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [teamId, competitorId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRemove = async () => {
    if (!confirm('Remove this competitor? This cannot be undone.')) return
    setRemoving(true)
    try {
      await apiDelete(`/api/competitors/${competitorId}`)
      router.push(`/teams/${teamId}/competitive`)
    } catch {
      setToast({ message: 'Failed to remove competitor', type: 'error' })
      setRemoving(false)
    }
  }

  const reportData = selectedRun?.data?.[activeTimeframe] || null
  const deltaComparison: DeltaComparison | null =
    selectedRun?.data?.[activeTimeframe]?.deltaComparison || null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!competitor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <p>Competitor not found.</p>
        <button
          onClick={() => router.push(`/teams/${teamId}/competitive`)}
          className="mt-4 text-teal-600 hover:text-teal-500 text-sm cursor-pointer"
        >
          Back to Competitors
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(`/teams/${teamId}/competitive`)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Competitors
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{competitor.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              {competitor.address && (
                <span className="text-sm text-gray-500">{competitor.address}</span>
              )}
              {competitor.rating != null && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {competitor.rating.toFixed(1)}
                  {competitor.review_count != null && (
                    <span className="text-gray-400">({competitor.review_count})</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditLocationsOpen(true)}
              className="px-3.5 py-2 text-sm font-medium border border-gray-200 text-gray-600
                         hover:border-gray-300 hover:bg-gray-50 rounded-xl transition-all duration-150 cursor-pointer"
            >
              Edit Locations
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="px-3.5 py-2 text-sm font-medium border border-red-200 text-red-500
                         hover:bg-red-50 hover:border-red-300 rounded-xl disabled:opacity-50
                         transition-all duration-150 cursor-pointer"
            >
              {removing ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <MainTabNav active={activeMainTab} onChange={setActiveMainTab} />

      {/* Report Tab */}
      {activeMainTab === 'report' && (
        <>
          {/* Delta Comparison Banner */}
          {deltaComparison && <DeltaBanner delta={deltaComparison} />}

          {/* Timeframe Tabs */}
          <div className="mb-6">
            <TimeframeTabs active={activeTimeframe} onChange={setActiveTimeframe} />
          </div>

          {/* Report Content */}
          {reportData ? (
            <CompetitiveReportPanel data={reportData} periodWindow={activeTimeframe} />
          ) : selectedRun ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center">
              <p className="text-gray-500">
                No data available for the <span className="font-medium text-gray-700">{TIMEFRAME_LABELS[activeTimeframe]}</span> window in this report.
              </p>
              <p className="text-xs text-gray-400 mt-2">Try selecting a different timeframe above.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center">
              <p className="text-gray-500">No reports have been generated for this competitor yet.</p>
              <p className="text-xs text-gray-400 mt-2">
                Reports are generated automatically every two weeks.
              </p>
            </div>
          )}

          {/* Report History */}
          <ReportHistory
            runs={runs}
            selectedRunId={selectedRun?.id || null}
            onSelect={setSelectedRun}
          />
        </>
      )}

      {/* Reviews Tab */}
      {activeMainTab === 'reviews' && (
        <ReviewsTab competitorId={competitorId} />
      )}

      {/* Metrics Tab */}
      {activeMainTab === 'metrics' && (
        <MetricsTab
          runs={runs}
          selectedRun={selectedRun}
          competitorId={competitorId}
          activeTimeframe={activeTimeframe}
          onTimeframeChange={setActiveTimeframe}
        />
      )}

      {/* Edit Locations Modal */}
      <EditLocationsModal
        open={editLocationsOpen}
        onClose={() => setEditLocationsOpen(false)}
        competitorId={competitorId}
        teamId={teamId}
        currentLocationIds={competitor.location_ids}
        onSaved={(ids) => {
          setCompetitor((prev) => (prev ? { ...prev, location_ids: ids } : prev))
          setToast({ message: 'Locations updated', type: 'success' })
        }}
      />
    </div>
  )
}
