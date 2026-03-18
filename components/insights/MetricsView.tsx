'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import {
  LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comparison {
  totalReviews: { current: number; previous: number; deltaPercent: number | null }
  averageRating: { current: number; previous: number; delta: number }
  responseRate: { current: number; previous: number; deltaPercent: number | null }
  averageResponseTimeHours: { current: number | null; previous: number | null; deltaPercent: number | null }
}

interface ThemeMention { label: string; count: number; sentiment: 'positive' | 'negative' }
interface TimePoint { month: string; averageRating: number | null; count: number; [key: string]: any }
interface VolumePoint { month: string; total: number; positive: number; neutral: number; negative: number }
interface ResponseRatePoint { month: string; rate: number | null; replied: number; total: number; [key: string]: any }
interface RatingBucket { rating: number; count: number }
interface LocationStat {
  locationId: string
  locationName: string
  totalReviews: number
  averageRating: number
  responseRate: number
}

export interface TeamAnalytics {
  kpis: {
    totalReviews: number
    averageRating: number
    responseRate: number
    averageResponseTimeHours: number | null
    positivePercent: number
    negativePercent: number
    locationCount: number
  }
  ratingOverTime: TimePoint[]
  volumeOverTime: VolumePoint[]
  responseRateOverTime: ResponseRatePoint[]
  ratingDistribution: RatingBucket[]
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  perLocation: LocationStat[]
  replyGap?: Array<{
    reviewDate: string
    rating: number
    comment: string | null
    daysSince: number
    locationId: string | null
    locationName: string | null
  }>
}

interface MetricsViewProps {
  teamId: string
  locationId: string | null
  isTeamView: boolean
  analytics: TeamAnalytics
  comparison: Comparison | null
  themeMentions: ThemeMention[]
  locations: Array<{ id: string; name: string }>
  formatMonth: (str: string) => string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RATING_COLORS: Record<number, string> = {
  5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444',
}

const SENTIMENT_COLORS = { positive: '#22c55e', neutral: '#eab308', negative: '#ef4444' }

const TEAL_GRADIENT = [
  { bg: 'bg-[#F0FDFA]', text: 'text-[#0D9B8A]', count: 'bg-[#CCFBF1] text-[#0D9B8A]' },
  { bg: 'bg-[#CCFBF1]', text: 'text-[#0F766E]', count: 'bg-[#99F6E4] text-[#0F766E]' },
  { bg: 'bg-[#99F6E4]', text: 'text-[#115E59]', count: 'bg-[#5EEAD4] text-[#115E59]' },
  { bg: 'bg-[#5EEAD4]', text: 'text-[#134E4A]', count: 'bg-[#2DD4BF] text-[#134E4A]' },
  { bg: 'bg-[#14B8A6]', text: 'text-white',      count: 'bg-[#0D9B8A] text-white' },
]

const RED_GRADIENT = [
  { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', count: 'bg-[#FECACA] text-[#DC2626]' },
  { bg: 'bg-[#FECACA]', text: 'text-[#B91C1C]', count: 'bg-[#FCA5A5] text-[#B91C1C]' },
  { bg: 'bg-[#FCA5A5]', text: 'text-[#991B1B]', count: 'bg-[#F87171] text-[#991B1B]' },
  { bg: 'bg-[#F87171]', text: 'text-[#7F1D1D]', count: 'bg-[#EF4444] text-[#7F1D1D]' },
  { bg: 'bg-[#EF4444]', text: 'text-white',      count: 'bg-[#DC2626] text-white' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatResponseTime(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, suffix, delta, deltaLabel, invertColor }: {
  label: string
  value: string
  suffix?: string
  delta?: number | null
  deltaLabel?: string
  invertColor?: boolean
}) {
  const isPositive = invertColor ? (delta ?? 0) < 0 : (delta ?? 0) > 0
  const isNegative = invertColor ? (delta ?? 0) > 0 : (delta ?? 0) < 0
  return (
    <div className="bg-[#F3F4F6] rounded-2xl p-5">
      <p className="text-sm font-medium text-[#4B5563] mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#111827] tracking-tight">{value}</span>
        {suffix && <span className="text-lg text-[#9CA3AF] font-medium">{suffix}</span>}
      </div>
      {delta != null && delta !== 0 && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-[#ECFDF5] text-[#059669]' : isNegative ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
          }`}>
            {delta > 0 ? '+' : ''}{deltaLabel === 'pts' ? `${delta.toFixed(2)} pts` : `${delta.toFixed(0)}%`}
          </span>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-lg transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
        <p className="text-xs text-[#9CA3AF]">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function ThemeBadgeColumn({ title, dot, themes, gradient, onThemeClick }: {
  title: string
  dot: string
  themes: ThemeMention[]
  gradient: typeof TEAL_GRADIENT
  onThemeClick: (label: string, sentiment: 'positive' | 'negative') => void
}) {
  const maxCount = Math.max(...themes.map(t => t.count), 1)
  const minCount = Math.min(...themes.map(t => t.count), 1)
  const range = maxCount - minCount || 1

  function getTier(count: number): number {
    const t = (count - minCount) / range
    return Math.min(Math.floor(t * gradient.length), gradient.length - 1)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h4 className="text-sm font-semibold text-[#111827]">{title}</h4>
        <span className="text-xs text-[#9CA3AF]">({themes.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {themes.map((t, i) => {
          const tier = getTier(t.count)
          const colors = gradient[tier]
          return (
            <button
              key={i}
              onClick={() => onThemeClick(t.label, t.sentiment)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${colors.bg}`}
            >
              <span className={`text-sm font-medium ${colors.text}`}>{t.label}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colors.count}`}>{t.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ThemeBadges({ themes, onThemeClick }: { themes: ThemeMention[]; onThemeClick: (label: string, sentiment: 'positive' | 'negative') => void }) {
  const positive = themes.filter(t => t.sentiment === 'positive')
  const negative = themes.filter(t => t.sentiment === 'negative')
  const hasNegative = negative.length > 0

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#111827]">Review Themes</h3>
        <p className="text-xs text-[#9CA3AF]">{themes.length} themes detected — click to view reviews</p>
      </div>
      <div className={`grid gap-6 ${hasNegative ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {positive.length > 0 && (
          <ThemeBadgeColumn
            title="What Customers Love"
            dot="bg-[#22c55e]"
            themes={positive}
            gradient={TEAL_GRADIENT}
            onThemeClick={onThemeClick}
          />
        )}
        {hasNegative && (
          <ThemeBadgeColumn
            title="What Needs Attention"
            dot="bg-[#ef4444]"
            themes={negative}
            gradient={RED_GRADIENT}
            onThemeClick={onThemeClick}
          />
        )}
      </div>
    </div>
  )
}

interface ThemeReview {
  id: string
  rating: number
  comment: string | null
  reviewer_name: string | null
  review_date: string | null
  location_name?: string
}

function ThemeReviewsModal({ theme, sentiment, reviews, loading, onClose }: {
  theme: string
  sentiment: 'positive' | 'negative'
  reviews: ThemeReview[]
  loading: boolean
  onClose: () => void
}) {
  const STAR_COLORS: Record<number, string> = { 5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444' }
  const sentimentLabel = sentiment === 'positive' ? 'positive (4-5★)' : 'negative (1-3★)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Reviews about &ldquo;{theme}&rdquo;</h3>
            <p className="text-xs text-[#9CA3AF]">Most recent {sentimentLabel} reviews tagged with this theme</p>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D9B8A]" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-center text-[#9CA3AF] py-12">No reviews found for this theme.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="border border-[#E5E7EB] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className="text-sm" style={{ color: star <= review.rating ? STAR_COLORS[review.rating] : '#E5E7EB' }}>★</span>
                        ))}
                      </div>
                      <span className="text-sm font-medium text-[#111827]">{review.reviewer_name || 'Anonymous'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.location_name && (
                        <span className="text-xs text-[#9CA3AF]">{review.location_name}</span>
                      )}
                      {review.review_date && (
                        <span className="text-xs text-[#9CA3AF]">
                          {new Date(review.review_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[#4B5563] leading-relaxed">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MetricsView({
  teamId,
  locationId,
  isTeamView,
  analytics,
  comparison,
  themeMentions,
  locations,
  formatMonth,
}: MetricsViewProps) {
  const router = useRouter()
  const kpis = analytics.kpis

  // Theme modal state
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [selectedSentiment, setSelectedSentiment] = useState<'positive' | 'negative'>('positive')
  const [themeReviews, setThemeReviews] = useState<ThemeReview[]>([])
  const [themeLoading, setThemeLoading] = useState(false)

  const handleThemeClick = async (label: string, sentiment: 'positive' | 'negative') => {
    setSelectedTheme(label)
    setSelectedSentiment(sentiment)
    setThemeReviews([])
    setThemeLoading(true)
    try {
      const locParam = locationId ? `&location=${locationId}` : ''
      const res = await apiGet<{ reviews: ThemeReview[] }>(
        `/api/teams/${teamId}/reviews?theme=${encodeURIComponent(label)}&sentiment=${sentiment}&limit=10${locParam}`
      )
      setThemeReviews(res.reviews || [])
    } catch {
      setThemeReviews([])
    } finally {
      setThemeLoading(false)
    }
  }

  // Fill gaps in rating data: carry forward the last known rating for months with no reviews,
  // then drop any leading nulls that couldn't be filled
  const ratingData = analytics.ratingOverTime
    .map((pt, i, arr) => {
      if (pt.averageRating != null) return pt
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j].averageRating != null) {
          return { ...pt, averageRating: arr[j].averageRating }
        }
      }
      return pt
    })
    .filter(pt => pt.averageRating != null)

  // Location names for per-location overlays
  const locationNames = isTeamView ? locations.map(l => l.name) : []

  return (
    <>
      {/* KPI Cards */}
      {comparison && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Reviews" value={comparison.totalReviews.current.toLocaleString()} delta={comparison.totalReviews.deltaPercent} />
          <MetricCard label="Average Rating" value={comparison.averageRating.current.toFixed(1)} suffix="/ 5" delta={comparison.averageRating.delta} deltaLabel="pts" />
          <MetricCard label="Response Rate" value={`${comparison.responseRate.current.toFixed(0)}%`} delta={comparison.responseRate.deltaPercent} />
          <MetricCard label="Avg. Response Time" value={formatResponseTime(comparison.averageResponseTimeHours.current)} delta={comparison.averageResponseTimeHours.deltaPercent} invertColor />
        </div>
      )}

      {/* Theme Badges */}
      {themeMentions.length > 0 && (
        <div className="mb-8">
          <ThemeBadges themes={themeMentions} onThemeClick={handleThemeClick} />
        </div>
      )}

      {selectedTheme && (
        <ThemeReviewsModal
          theme={selectedTheme}
          sentiment={selectedSentiment}
          reviews={themeReviews}
          loading={themeLoading}
          onClose={() => setSelectedTheme(null)}
        />
      )}

      {/* Charts Grid — 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* 1. Average Rating Over Time */}
        <ChartCard title="Average Rating Over Time" subtitle={isTeamView ? 'Monthly trend across all locations' : 'Monthly rating trend'}>
          <ResponsiveContainer width="100%" height={280}>
            {isTeamView ? (
              <ComposedChart data={ratingData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }}
                  labelFormatter={(label: any) => formatMonth(String(label))}
                  formatter={(value: any, name: any, props: any) => {
                    const count = props?.payload?.count ?? 0
                    const displayName = name === 'averageRating'
                      ? (count === 0 ? 'Avg Rating (carried forward)' : 'Team Avg')
                      : name
                    return [value != null ? Number(value).toFixed(2) : '—', displayName]
                  }}
                />
                <Area type="monotone" dataKey="averageRating" name="Team Avg" stroke="#0d9488" strokeWidth={3} fill="url(#ratingGradient)" dot={{ fill: '#0d9488', r: 3, strokeWidth: 0 }} connectNulls />
                {locationNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={`hsl(${i * 137.5 % 360}, 70%, 50%)`}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                ))}
              </ComposedChart>
            ) : (
              <AreaChart data={ratingData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="ratingGradientSingle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }}
                  labelFormatter={(label: any) => formatMonth(String(label))}
                  formatter={(value: any, name: any, props: any) => {
                    const count = props?.payload?.count ?? 0
                    const displayName = count === 0 ? 'Avg Rating (carried forward)' : 'Avg Rating'
                    return [value != null ? Number(value).toFixed(2) : '—', displayName]
                  }}
                />
                <Area type="monotone" dataKey="averageRating" stroke="#0d9488" strokeWidth={2.5} fill="url(#ratingGradientSingle)" dot={{ fill: '#0d9488', r: 3, strokeWidth: 0 }} connectNulls />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Review Volume */}
        <ChartCard title="Review Volume" subtitle="Monthly breakdown by sentiment">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.volumeOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }}
                labelFormatter={(label: any) => formatMonth(String(label))}
              />
              <Bar dataKey="positive" stackId="volume" fill="#22c55e" name="Positive (4-5★)" />
              <Bar dataKey="neutral" stackId="volume" fill="#eab308" name="Neutral (3★)" />
              <Bar dataKey="negative" stackId="volume" fill="#ef4444" name="Negative (1-2★)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. Response Rate Over Time */}
        <ChartCard title="Response Rate Over Time" subtitle="Percentage of reviews replied to">
          <ResponsiveContainer width="100%" height={280}>
            {isTeamView ? (
              <ComposedChart data={analytics.responseRateOverTime.filter(d => d.rate !== null)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }}
                  labelFormatter={(label: any) => formatMonth(String(label))}
                  formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name === 'rate' ? 'Team Avg' : name]}
                />
                <Area type="monotone" dataKey="rate" name="Team Avg" stroke="#0d9488" strokeWidth={3} fill="url(#responseGradient)" dot={{ fill: '#0d9488', r: 3, strokeWidth: 0 }} />
                {locationNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={`hsl(${i * 137.5 % 360}, 70%, 50%)`}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                ))}
              </ComposedChart>
            ) : (
              <AreaChart data={analytics.responseRateOverTime.filter(d => d.rate !== null)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="responseGradientSingle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }}
                  labelFormatter={(label: any) => formatMonth(String(label))}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Response Rate']}
                />
                <Area type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2.5} fill="url(#responseGradientSingle)" dot={{ fill: '#0d9488', r: 3, strokeWidth: 0 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Rating Distribution */}
        <ChartCard title="Rating Distribution" subtitle="Breakdown by star rating">
          <div className="px-2 pt-2">
            {analytics.ratingDistribution.map(bucket => {
              const pct = kpis.totalReviews > 0 ? (bucket.count / kpis.totalReviews) * 100 : 0
              return (
                <div key={bucket.rating} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 w-14 text-sm font-medium text-[#4B5563]">
                    {bucket.rating} <span className="text-yellow-400">★</span>
                  </div>
                  <div className="flex-1 h-7 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: RATING_COLORS[bucket.rating] }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm text-[#4B5563]">
                    {bucket.count} <span className="text-[#9CA3AF]">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-6 pt-3 pb-1 border-t border-[#F3F4F6] mt-2">
            {Object.entries(analytics.sentimentBreakdown).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[key as keyof typeof SENTIMENT_COLORS] }} />
                <span className="text-sm text-[#4B5563] capitalize">{key}</span>
                <span className="text-sm font-semibold text-[#111827]">{val}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Location Breakdown — team view only */}
      {isTeamView && analytics.perLocation && analytics.perLocation.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="p-5 border-b border-[#F3F4F6]">
            <h3 className="text-base font-semibold text-[#111827]">Location Breakdown</h3>
            <p className="text-xs text-[#9CA3AF]">Performance comparison across {analytics.perLocation.length} locations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Location</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Reviews</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Avg Rating</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Response Rate</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#4B5563] uppercase tracking-wider w-48">Rating</th>
                </tr>
              </thead>
              <tbody>
                {analytics.perLocation.map((loc, i) => (
                  <tr
                    key={loc.locationId}
                    className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] cursor-pointer transition-colors`}
                    onClick={() => router.push(`/teams/${teamId}/insights?location=${loc.locationId}`)}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-[#111827] hover:text-[#0D9B8A] transition-colors">{loc.locationName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-[#4B5563]">{loc.totalReviews}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-semibold text-[#111827]">{loc.averageRating.toFixed(1)}</span>
                      <span className="text-yellow-400 ml-1 text-xs">★</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-semibold ${
                        loc.responseRate >= 80 ? 'text-[#059669]' : loc.responseRate >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
                      }`}>
                        {loc.responseRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
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
    </>
  )
}
