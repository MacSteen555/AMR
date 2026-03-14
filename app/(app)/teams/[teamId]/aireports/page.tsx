'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import React, { useState, useEffect, useMemo } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Toast } from '@/components/Toast'
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

interface Location {
  id: string
  name: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REPORT_CREDITS: Record<string, number> = { '30d': 3, '90d': 4, '6m': 7, '1y': 10 }
const REPORT_LABELS: Record<string, string> = { '30d': 'Last 30 Days', '90d': 'Last 90 Days', '6m': 'Last 6 Months', '1y': 'Year in Review' }

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AIReportsPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { teams, refresh: refreshAuth } = useAuth()

  const currentTeam = teams.find(t => t.id === teamId)
  const tier = currentTeam?.subscription?.tier || 'FREE'
  const insightsEnabled = tier !== 'FREE'

  // ── State ──────────────────────────────────────────────────────────────────

  const [locations, setLocations] = useState<Location[]>([])
  const [allReports, setAllReports] = useState<AIInsight[]>([])
  const [reportFilter, setReportFilter] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<AIInsight | null>(null)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────

  const locationIdParam = searchParams.get('location')
  const effectiveLocationId = locationIdParam
    || (locations.length === 1 ? locations[0].id : null)

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return allReports
    return allReports.filter(r => r.period_window === reportFilter)
  }, [allReports, reportFilter])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchReports = async () => {
    try {
      const locParam = effectiveLocationId ? `location=${effectiveLocationId}` : 'scope=all'
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
      try {
        const locRes = await apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`)
        if (!cancelled) setLocations(locRes.locations || [])
      } catch {
        // ignore
      }
      await fetchReports()
      if (!cancelled) setLoading(false)
    }

    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, effectiveLocationId])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerate = async (periodWindow: string) => {
    setGenerating(true)
    try {
      const locParam = effectiveLocationId ? `?location=${effectiveLocationId}` : ''
      await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, { period_window: periodWindow })
      setToast({ message: 'Report generated!', type: 'success' })
      await fetchReports()
      await refreshAuth()
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to generate', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">AI Reports</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">AI-generated analysis of your reviews</p>
        </div>
        {insightsEnabled && (
          <div className="relative">
            <button
              onClick={() => setShowPeriodPicker(!showPeriodPicker)}
              disabled={generating}
              className="px-5 py-2.5 bg-[#0D9B8A] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium text-sm flex items-center gap-2 transition-all"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
            {showPeriodPicker && !generating && (
              <>
                <div className="fixed inset-0 z-[9]" onClick={() => setShowPeriodPicker(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-[#E5E7EB] shadow-xl z-10 overflow-hidden">
                  {(['30d', '90d', '6m', '1y'] as const).map(pw => (
                    <button
                      key={pw}
                      onClick={() => { setShowPeriodPicker(false); handleGenerate(pw) }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F0FDFA] transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-[#111827]">{REPORT_LABELS[pw]}</span>
                      <span className="text-xs text-[#9CA3AF]">{REPORT_CREDITS[pw]} credits</span>
                    </button>
                  ))}
                  <div className="border-t border-[#E5E7EB]" />
                  <button
                    onClick={() => { setShowPeriodPicker(false); handleGenerate('all') }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F0FDFA] transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-[#0D9B8A]">Generate All</span>
                    <span className="text-xs text-[#9CA3AF]">24 credits</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Free tier upsell */}
      {!insightsEnabled && (
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
      )}

      {/* Loading state */}
      {insightsEnabled && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D9B8A]" />
        </div>
      )}

      {/* Selected report detail view */}
      {insightsEnabled && !loading && selectedReport && (
        <div>
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#4B5563] mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to reports
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#F0FDFA] text-[#0D9B8A]">
              {REPORT_LABELS[selectedReport.period_window || ''] || selectedReport.period_window || 'custom'}
            </span>
            <span className="text-sm text-[#4B5563]">
              {selectedReport.period_start} — {selectedReport.period_end}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              Generated {new Date(selectedReport.generated_at).toLocaleDateString()}
            </span>
          </div>
          <AIInsightsPanel insight={selectedReport} />
        </div>
      )}

      {/* Report list */}
      {insightsEnabled && !loading && !selectedReport && (
        <div>
          {/* Period filter pills */}
          <div className="flex gap-2 mb-4">
            {['all', '30d', '90d', '6m', '1y'].map(f => (
              <button
                key={f}
                onClick={() => setReportFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  reportFilter === f
                    ? 'bg-[#0D9B8A] text-white'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >
                {f === 'all' ? 'All' : REPORT_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Report cards or empty state */}
          {filteredReports.length === 0 ? (
            <div className="bg-[#F0FDFA] rounded-xl border border-[#0D9B8A]/10 p-12 text-center">
              <h3 className="text-lg font-semibold text-[#111827] mb-1">No reports yet</h3>
              <p className="text-[#4B5563] text-sm mb-4">
                Generate your first AI-powered report to uncover hidden patterns.
              </p>
              <button
                onClick={() => setShowPeriodPicker(true)}
                disabled={generating}
                className="px-5 py-2 bg-[#0D9B8A] text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
              >
                Generate First Report
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredReports.map(report => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="w-full text-left bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-[#0D9B8A]/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#F0FDFA] text-[#0D9B8A]">
                        {REPORT_LABELS[report.period_window || ''] || report.period_window || 'custom'}
                      </span>
                      <span className="text-sm font-medium text-[#111827]">
                        {report.period_start} — {report.period_end}
                      </span>
                    </div>
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
          )}
        </div>
      )}
    </div>
  )
}
