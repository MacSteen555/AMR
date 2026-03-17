'use client'

import { useParams, useSearchParams } from 'next/navigation'
import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import { Toast } from '@/components/Toast'
import { MetricsView, type TeamAnalytics } from '@/components/insights/MetricsView'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comparison {
  totalReviews: { current: number; previous: number; deltaPercent: number | null }
  averageRating: { current: number; previous: number; delta: number }
  responseRate: { current: number; previous: number; deltaPercent: number | null }
  averageResponseTimeHours: { current: number | null; previous: number | null; deltaPercent: number | null }
}

interface ThemeMention { label: string; count: number }

// ─── Period Helpers ──────────────────────────────────────────────────────────

type PeriodKey = '30d' | '90d' | '6m' | '1y'

function getPeriodDates(key: PeriodKey): { start: string; end: string; previousStart: string; previousEnd: string } {
  const now = new Date()
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const start = new Date(end)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  switch (key) {
    case '30d': start.setUTCDate(start.getUTCDate() - 30); break
    case '90d': start.setUTCDate(start.getUTCDate() - 90); break
    case '6m':  start.setUTCMonth(start.getUTCMonth() - 6); break
    case '1y':  start.setUTCMonth(start.getUTCMonth() - 12); break
  }

  const previousEnd = new Date(start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd)

  switch (key) {
    case '30d': previousStart.setUTCDate(previousStart.getUTCDate() - 30); break
    case '90d': previousStart.setUTCDate(previousStart.getUTCDate() - 90); break
    case '6m':  previousStart.setUTCMonth(previousStart.getUTCMonth() - 6); break
    case '1y':  previousStart.setUTCMonth(previousStart.getUTCMonth() - 12); break
  }

  return { start: fmt(start), end: fmt(end), previousStart: fmt(previousStart), previousEnd: fmt(previousEnd) }
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '6m',  label: '6 months' },
  { key: '1y',  label: '1 year' },
]

function formatMonth(str: string) {
  const [year, month] = str.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, 15))
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

// ─── Page Component ──────────────────────────────────────────────────────────

function MetricsPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const teamId = params.teamId as string
  const locationId = searchParams.get('location')

  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [themeMentions, setThemeMentions] = useState<ThemeMention[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isTeamView = !locationId

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
      const locParam = locationId ? `&location=${locationId}` : ''
      const res = await apiGet<any>(
        `/api/teams/${teamId}/insights/data?period_start=${start}&period_end=${end}&previous_start=${previousStart}&previous_end=${previousEnd}${locParam}`
      )
      setAnalytics(res.analytics)
      setComparison(res.comparison || null)
      setThemeMentions(res.themeMentions || [])
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load metrics', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [teamId, locationId, start, end, previousStart, previousEnd])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{isTeamView ? 'Team Metrics' : 'Location Metrics'}</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {isTeamView
              ? `Performance across ${locations.length} location${locations.length !== 1 ? 's' : ''}`
              : locations.find(l => l.id === locationId)?.name || 'Location'}
          </p>
        </div>

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

      {/* Content */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 animate-pulse">
                <div className="h-4 w-32 bg-[#E5E7EB] rounded mb-4" />
                <div className="h-[280px] bg-[#F3F4F6] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !analytics && (
        <div className="text-center py-20">
          <p className="text-[#9CA3AF] text-lg">No review data yet.</p>
          <p className="text-[#9CA3AF] text-sm mt-1">Sync your Google Business reviews to see metrics.</p>
        </div>
      )}

      {!loading && analytics && (
        <MetricsView
          teamId={teamId}
          locationId={locationId}
          isTeamView={isTeamView}
          analytics={analytics}
          comparison={comparison}
          themeMentions={themeMentions}
          locations={locations}
          formatMonth={formatMonth}
        />
      )}
    </div>
  )
}

export default function MetricsPage() {
  return (
    <Suspense>
      <MetricsPageContent />
    </Suspense>
  )
}
