'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { AIInsightsPanel } from '@/components/AIInsightsPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIInsight {
  id: string
  period_start: string
  period_end: string
  period_window: string | null
  data: {
    executiveSummary?: string
    overallSentiment?: number
    keyStrengths?: Array<{ theme: string; description: string; mentionCount: number }>
    keyWeaknesses?: Array<{ theme: string; description: string; mentionCount: number; severity: string }>
    recommendations?: Array<{ title: string; description: string; impact: string; effort: string }>
    notableQuotes?: Array<{ quote: string; rating: number; sentiment: string }>
    [key: string]: any
  }
  generated_at: string
  model: string
}

type PeriodKey = '30d' | '90d' | '6m' | '1y'

interface ReportsViewProps {
  teamId: string
  locationId: string | null
  tier: string
  period: PeriodKey
  onToast: (message: string, type: 'success' | 'error') => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = { '30d': 'Last 30 Days', '90d': 'Last 90 Days', '6m': 'Last 6 Months', '1y': 'Year in Review' }

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportsView({ teamId, locationId, tier, period, onToast }: ReportsViewProps) {
  const router = useRouter()
  const { teams, refresh: refreshAuth } = useAuth()
  const currentTeam = teams.find(t => t.id === teamId)
  const insightsEnabled = tier !== 'FREE'
  const reportsGenerated = currentTeam?.reportsGenerated ?? 0
  const reportLimit = tier === 'ENTERPRISE' ? 20 : tier === 'BUSINESS' ? 10 : tier === 'PRO' ? 3 : 0
  const canGenerate = insightsEnabled && reportsGenerated < reportLimit

  const [allReports, setAllReports] = useState<AIInsight[]>([])
  const [viewingReport, setViewingReport] = useState<AIInsight | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filter reports for the selected period, sorted newest first
  const reportsForPeriod = useMemo(() => {
    return allReports
      .filter(r => r.period_window === period)
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
  }, [allReports, period])

  const latestReport = reportsForPeriod[0] || null
  const priorReports = reportsForPeriod.slice(1)

  const fetchReports = async () => {
    try {
      const locParam = locationId ? `location=${locationId}` : 'scope=all'
      const res = await apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?${locParam}`)
      setAllReports(res.insights || [])
    } catch {
      // silently fail — empty list is fine
    }
  }

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    const init = async () => {
      setLoading(true)
      await fetchReports()
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, locationId])

  // Reset detail view when period changes
  useEffect(() => {
    setViewingReport(null)
  }, [period])

  // Generate reports for all 4 time frames concurrently (1 report credit)
  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    try {
      const locParam = locationId ? `?location=${locationId}` : ''
      await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, { period_window: 'all' })
      onToast('Reports generated for all time frames!', 'success')
      await fetchReports()
      await refreshAuth()
    } catch (err: any) {
      onToast(err.message || 'Failed to generate', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Free tier upsell ──────────────────────────────────────────────────────

  if (!insightsEnabled) {
    return (
      <div className="bg-[#FFFBEB] border border-[#D97706]/20 rounded-xl p-12 text-center">
        <h3 className="text-lg font-bold text-[#111827] mb-2">PRO Subscription Required</h3>
        <p className="text-[#4B5563] text-sm mb-6 max-w-md mx-auto">
          Upgrade to generate AI-powered reports with sentiment analysis, recommendations, and actionable insights.
        </p>
        <button
          onClick={() => router.push(`/teams/${teamId}/billing`)}
          className="px-6 py-2.5 bg-[#0D9B8A] text-white rounded-lg hover:opacity-90 font-medium"
        >
          Upgrade Now
        </button>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D9B8A]" />
      </div>
    )
  }

  // ── Viewing a prior report detail ──────────────────────────────────────────

  if (viewingReport) {
    return (
      <div>
        <button
          onClick={() => setViewingReport(null)}
          className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#4B5563] mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to latest report
        </button>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#F0FDFA] text-[#0D9B8A]">
            {PERIOD_LABELS[viewingReport.period_window || ''] || viewingReport.period_window || 'custom'}
          </span>
          <span className="text-sm text-[#4B5563]">
            {viewingReport.period_start} — {viewingReport.period_end}
          </span>
          <span className="text-xs text-[#9CA3AF]">
            Generated {new Date(viewingReport.generated_at).toLocaleDateString()}
          </span>
        </div>
        <AIInsightsPanel insight={viewingReport} />
      </div>
    )
  }

  // ── Main view: latest report + generate + prior reports ────────────────────

  return (
    <div>
      {/* Generate header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-[#4B5563]">
            {latestReport
              ? <>Showing <span className="font-medium text-[#111827]">{PERIOD_LABELS[period]}</span> report</>
              : <>No report for <span className="font-medium text-[#111827]">{PERIOD_LABELS[period]}</span> yet</>
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#9CA3AF]">
            {reportsGenerated}/{reportLimit} reports this month
          </span>
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="px-5 py-2.5 bg-[#0D9B8A] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium text-sm flex items-center gap-2 transition-all"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Generating...
              </>
            ) : !canGenerate ? (
              'Report Limit Reached'
            ) : latestReport ? (
              'Regenerate Report'
            ) : (
              'Generate Report'
            )}
          </button>
        </div>
      </div>

      {/* Latest report — shown inline */}
      {latestReport ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#9CA3AF]">
              {latestReport.period_start} — {latestReport.period_end}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              Generated {new Date(latestReport.generated_at).toLocaleDateString()}
            </span>
            {latestReport.data?.overallSentiment != null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                latestReport.data.overallSentiment >= 70
                  ? 'bg-[#ECFDF5] text-[#059669]'
                  : latestReport.data.overallSentiment >= 40
                  ? 'bg-[#FFFBEB] text-[#D97706]'
                  : 'bg-[#FEF2F2] text-[#DC2626]'
              }`}>
                Sentiment: {latestReport.data.overallSentiment}/100
              </span>
            )}
          </div>
          <AIInsightsPanel insight={latestReport} />
        </div>
      ) : (
        <div className="bg-[#F0FDFA] rounded-xl border border-[#0D9B8A]/10 p-12 text-center">
          <h3 className="text-lg font-semibold text-[#111827] mb-1">No reports yet</h3>
          <p className="text-[#4B5563] text-sm mb-4">
            Generate AI-powered reports for all time frames. Use the period selector to view each report.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="px-5 py-2 bg-[#0D9B8A] text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
          >
            Generate Report
          </button>
        </div>
      )}

      {/* Prior reports for this period */}
      {priorReports.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-colors select-none">
            {priorReports.length} prior report{priorReports.length !== 1 ? 's' : ''} for this period
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {priorReports.map(report => (
              <button
                key={report.id}
                onClick={() => setViewingReport(report)}
                className="w-full text-left bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-[#0D9B8A]/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#111827]">
                    {report.period_start} — {report.period_end}
                  </span>
                  <div className="flex items-center gap-3">
                    {report.data?.overallSentiment != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        report.data.overallSentiment >= 70
                          ? 'bg-[#ECFDF5] text-[#059669]'
                          : report.data.overallSentiment >= 40
                          ? 'bg-[#FFFBEB] text-[#D97706]'
                          : 'bg-[#FEF2F2] text-[#DC2626]'
                      }`}>
                        {report.data.overallSentiment}/100
                      </span>
                    )}
                    <span className="text-xs text-[#9CA3AF]">
                      {new Date(report.generated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
