'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import { Toast } from '@/components/Toast'
import {
  AreaChart, Area,
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

interface Comparison {
  totalReviews: { current: number; previous: number; deltaPercent: number | null }
  averageRating: { current: number; previous: number; delta: number }
  responseRate: { current: number; previous: number; deltaPercent: number | null }
  averageResponseTimeHours: { current: number | null; previous: number | null; deltaPercent: number | null }
}

interface ThemeMention { label: string; count: number }
interface TimePoint { month: string; averageRating: number | null; count: number }
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
  responseRateOverTime: ResponseRatePoint[]
  ratingDistribution: RatingBucket[]
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

// ─── Period Helpers ──────────────────────────────────────────────────────────

type PeriodKey = '30d' | '90d' | '6m' | '1y' | 'all'

function getPeriodDates(key: PeriodKey): { start: string; end: string; previousStart: string; previousEnd: string } {
  const end = new Date()
  const endStr = end.toISOString().split('T')[0]

  let daysBack: number
  switch (key) {
    case '30d': daysBack = 30; break
    case '90d': daysBack = 90; break
    case '6m':  daysBack = 183; break
    case '1y':  daysBack = 365; break
    case 'all': daysBack = 730; break
  }

  const start = new Date(end)
  start.setDate(start.getDate() - daysBack)
  const startStr = start.toISOString().split('T')[0]

  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousEndStr = previousEnd.toISOString().split('T')[0]

  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - daysBack)
  const previousStartStr = previousStart.toISOString().split('T')[0]

  return { start: startStr, end: endStr, previousStart: previousStartStr, previousEnd: previousEndStr }
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '6m',  label: '6 months' },
  { key: '1y',  label: '1 year' },
]

function formatMonth(str: string) {
  const d = new Date(str + '-01')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatResponseTime(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

// ─── MetricCard ──────────────────────────────────────────────────────────────

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

// ─── Page Component ──────────────────────────────────────────────────────────

export default function InsightsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = params.teamId as string
  const locationId = searchParams.get('location')
  const [locations, setLocations] = useState<any[]>([])
  const [period, setPeriod] = useState<PeriodKey>('90d')
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [themeMentions, setThemeMentions] = useState<ThemeMention[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const effectiveLocationId = useMemo(() => {
    if (locationId) return locationId
    if (locations.length === 1) return locations[0].id
    return null
  }, [locationId, locations])

  // Load locations
  useEffect(() => {
    if (!teamId) return
    apiGet<any>(`/api/teams/${teamId}/locations`).then((data) => {
      setLocations(data.locations || data || [])
    }).catch(() => {})
  }, [teamId])

  const { start, end, previousStart, previousEnd } = useMemo(() => getPeriodDates(period), [period])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const locParam = effectiveLocationId ? `&location=${effectiveLocationId}` : ''
      const res = await apiGet<any>(
        `/api/teams/${teamId}/insights/data?period_start=${start}&period_end=${end}&previous_start=${previousStart}&previous_end=${previousEnd}${locParam}`
      )
      setAnalytics(res.analytics)
      setComparison(res.comparison || null)
      setThemeMentions(res.themeMentions || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load insights', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [teamId, effectiveLocationId, start, end, previousStart, previousEnd])

  useEffect(() => { loadData() }, [loadData])

  const isTeamView = !effectiveLocationId

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Insights</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {isTeamView
              ? `Performance across ${locations.length} location${locations.length !== 1 ? 's' : ''}`
              : locations.find((l: any) => l.id === effectiveLocationId)?.name || 'Location'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Location filter */}
          {locations.length > 1 && (
            <select
              className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] bg-white"
              value={effectiveLocationId}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  router.push(`/teams/${teamId}/insights?location=${val}`)
                } else {
                  router.push(`/teams/${teamId}/insights`)
                }
              }}
            >
              <option value="">All locations</option>
              {locations.map((loc: any) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}

          {/* Period picker */}
          <div className="flex bg-[#F3F4F6] rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === opt.key
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#F3F4F6] rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-24 bg-[#E5E7EB] rounded mb-3" />
                <div className="h-8 w-20 bg-[#E5E7EB] rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 animate-pulse">
            <div className="h-4 w-32 bg-[#E5E7EB] rounded mb-4" />
            <div className="h-64 bg-[#F3F4F6] rounded-xl" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !analytics && (
        <div className="text-center py-20">
          <p className="text-[#9CA3AF] text-lg">No review data yet.</p>
          <p className="text-[#9CA3AF] text-sm mt-1">Sync your Google Business reviews to see insights.</p>
        </div>
      )}

      {/* Content */}
      {!loading && analytics && (
        <>
          {/* Metric Cards */}
          {comparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Total Reviews" value={comparison.totalReviews.current.toLocaleString()} delta={comparison.totalReviews.deltaPercent} />
              <MetricCard label="Average Rating" value={comparison.averageRating.current.toFixed(1)} suffix="/ 5" delta={comparison.averageRating.delta} deltaLabel="pts" />
              <MetricCard label="Response Rate" value={`${comparison.responseRate.current.toFixed(0)}%`} delta={comparison.responseRate.deltaPercent} />
              <MetricCard label="Avg. Response Time" value={formatResponseTime(comparison.averageResponseTimeHours.current)} delta={comparison.averageResponseTimeHours.deltaPercent} invertColor />
            </div>
          )}

          {/* Rating Over Time */}
          {analytics.ratingOverTime && analytics.ratingOverTime.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-8">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#111827]">Rating Over Time</h3>
                <p className="text-xs text-[#9CA3AF]">Average rating by month</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.ratingOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CCFBF1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#CCFBF1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
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
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                    labelFormatter={formatMonth}
                    formatter={(value: any) => [value != null ? Number(value).toFixed(2) : '—', 'Avg Rating']}
                  />
                  <Area
                    type="monotone"
                    dataKey="averageRating"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    fill="url(#ratingGradient)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Theme Mentions */}
          {themeMentions.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-8">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#111827]">Review Themes</h3>
                <p className="text-xs text-[#9CA3AF]">{themeMentions.length} themes detected across reviews</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {themeMentions.map((t, i) => (
                  <div key={i} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F3F4F6]">
                    <span className="text-sm font-medium text-[#111827]">{t.label}</span>
                    <span className="text-xs font-medium text-[#4B5563] bg-white px-2 py-0.5 rounded-full">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-Location Breakdown */}
          {isTeamView && analytics.perLocation && analytics.perLocation.length > 0 && (
            <div className="bg-white rounded-2xl p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#111827]">Per-Location Breakdown</h3>
                <p className="text-xs text-[#9CA3AF]">{analytics.perLocation.length} locations</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-3 px-2 font-medium text-[#4B5563]">Location</th>
                      <th className="text-right py-3 px-2 font-medium text-[#4B5563]">Reviews</th>
                      <th className="text-right py-3 px-2 font-medium text-[#4B5563]">Avg Rating</th>
                      <th className="text-right py-3 px-2 font-medium text-[#4B5563]">Response Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.perLocation.map((loc) => (
                      <tr key={loc.locationId} className="border-b border-[#E5E7EB] last:border-0">
                        <td className="py-3 px-2 text-[#111827] font-medium">{loc.locationName}</td>
                        <td className="py-3 px-2 text-right text-[#111827]">{loc.totalReviews}</td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(loc.averageRating / 5) * 100}%`,
                                  backgroundColor: loc.averageRating >= 4 ? '#059669' : loc.averageRating >= 3 ? '#D97706' : '#DC2626',
                                }}
                              />
                            </div>
                            <span className="text-[#111827] tabular-nums">{loc.averageRating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className={`py-3 px-2 text-right font-medium ${
                          loc.responseRate >= 80 ? 'text-[#059669]' : loc.responseRate >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
                        }`}>
                          {loc.responseRate.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
