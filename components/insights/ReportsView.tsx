'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { AIInsightsPanel } from '@/components/AIInsightsPanel'
import UnifiedReportPanel from '@/components/insights/UnifiedReportPanel'
import type { UnifiedReportData } from '@/lib/openai/insights'

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

interface ReportsViewProps {
  teamId: string
  locationId: string | null
  tier: string
  onToast: (message: string, type: 'success' | 'error') => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportsView({ teamId, locationId, tier, onToast }: ReportsViewProps) {
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
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // Close history dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHistory])

  // Filter reports into unified and legacy, sorted newest first
  const unifiedReports = useMemo(() => {
    return allReports
      .filter(r => r.period_window === 'unified')
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
  }, [allReports])

  const legacyReports = useMemo(() => {
    return allReports
      .filter(r => r.period_window !== 'unified')
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
  }, [allReports])

  const latestReport = unifiedReports[0] || null
  const priorReports = [...unifiedReports.slice(1), ...legacyReports]

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

  // Generate unified report
  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    try {
      const locParam = locationId ? `?location=${locationId}` : ''
      await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, { period_window: 'unified' })
      onToast('Report generated!', 'success')
      await fetchReports()
      await refreshAuth()
    } catch (err: any) {
      onToast(err.message || 'Failed to generate', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Helper: render a report with the appropriate panel
  function renderReport(report: AIInsight) {
    if (report.period_window === 'unified') {
      return <UnifiedReportPanel data={report.data as unknown as UnifiedReportData} />
    }
    return <AIInsightsPanel insight={report} />
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
            {viewingReport.period_window === 'unified' ? 'unified' : 'legacy'}
          </span>
          <span className="text-sm text-[#4B5563]">
            {formatDate(viewingReport.period_start)} — {formatDate(viewingReport.period_end)}
          </span>
          <span className="text-xs text-[#9CA3AF]">
            Generated {new Date(viewingReport.generated_at).toLocaleDateString()}
          </span>
        </div>
        {renderReport(viewingReport)}
      </div>
    )
  }

  // ── Main view: latest report + generate + history dropdown ─────────────────

  return (
    <div>
      {/* Generate header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-[#4B5563]">
            {latestReport
              ? <span className="font-medium text-[#111827]">Latest Report</span>
              : <>No reports generated yet</>
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#9CA3AF]">
            {reportsGenerated}/{reportLimit} reports this month
          </span>

          {/* History dropdown */}
          {priorReports.length > 0 && (
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] bg-white border border-[#E5E7EB] rounded-lg hover:border-[#0D9B8A]/30 hover:text-[#111827] transition-all"
              >
                History ({priorReports.length})
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                  {priorReports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setViewingReport(report)
                        setShowHistory(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] border-b border-[#F3F4F6] last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#111827]">
                          {formatDate(report.period_start)} — {formatDate(report.period_end)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          report.period_window === 'unified'
                            ? 'bg-[#F0FDFA] text-[#0D9B8A]'
                            : 'bg-[#F3F4F6] text-[#9CA3AF]'
                        }`}>
                          {report.period_window === 'unified' ? 'unified' : 'legacy'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#9CA3AF]">
                          Generated {new Date(report.generated_at).toLocaleDateString()}
                        </span>
                        {report.data?.overallSentiment != null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            report.data.overallSentiment >= 70
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : report.data.overallSentiment >= 40
                              ? 'bg-[#FFFBEB] text-[#D97706]'
                              : 'bg-[#FEF2F2] text-[#DC2626]'
                          }`}>
                            {report.data.overallSentiment}/100
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!canGenerate && insightsEnabled ? (
            <button
              onClick={() => router.push(`/teams/${teamId}/billing`)}
              className="px-5 py-2.5 bg-[#D97706] text-white rounded-lg hover:opacity-90 font-medium text-sm transition-all"
            >
              Upgrade for More Reports
            </button>
          ) : (
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
              ) : latestReport ? (
                'Regenerate Report'
              ) : (
                'Generate Report'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Latest report — shown inline */}
      {latestReport ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#9CA3AF]">
              {formatDate(latestReport.period_start)} — {formatDate(latestReport.period_end)}
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
          {renderReport(latestReport)}
        </div>
      ) : (
        <div className="bg-[#F0FDFA] rounded-xl border border-[#0D9B8A]/10 p-12 text-center">
          <h3 className="text-lg font-semibold text-[#111827] mb-1">No reports yet</h3>
          <p className="text-[#4B5563] text-sm mb-4">
            Generate an AI-powered report with sentiment analysis, recommendations, and actionable insights.
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
    </div>
  )
}
