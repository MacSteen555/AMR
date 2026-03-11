'use client'

interface CompetitiveData {
  competitivePositionScore?: number
  marketMomentum?: number
  executiveSummary?: string
  ownedAverageRating?: number
  competitorAverageRating?: number
  ownedReviewCount?: number
  competitorReviewCount?: number
  ratingGap?: number
  topActionItem?: { title: string; description: string }
  headToHead?: Array<{
    competitorName: string
    yourRating: number
    theirRating: number
    yourVolume: number
    theirVolume: number
    youWinOn: string[]
    theyWinOn: string[]
    verdict: string
  }>
  thematicGaps?: Array<{
    theme: string
    yourSentiment: string
    competitorSentiment: string
    description: string
    gapType: string
  }>
  competitiveStrengths?: Array<{
    theme: string
    description: string
    mentionCount: number
    exampleQuote?: string
  }>
  competitiveWeaknesses?: Array<{
    theme: string
    description: string
    mentionCount: number
    severity: string
    exampleQuote?: string
  }>
  threatAlerts?: Array<{
    title: string
    description: string
    urgency: string
  }>
  opportunities?: Array<{
    title: string
    description: string
    impact: string
    effort: string
  }>
  recommendations?: Array<{
    title: string
    description: string
    impact: string
    effort: string
    category: string
  }>
  stealWorthy?: Array<{
    competitorName: string
    theme: string
    quote: string
    takeaway: string
  }>
  responseComparison?: {
    yourResponseRate: number
    competitorAvgResponseRate: number
    analysis: string
  }
  sentimentComparison?: {
    yourSentiment: number
    competitorSentiment: number
    analysis: string
  }

  // Legacy fallback fields
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface CompetitiveReportPanelProps {
  data: CompetitiveData
  periodWindow: string
}

export function CompetitiveReportPanel({ data: d, periodWindow }: CompetitiveReportPanelProps) {
  // Detect if this is legacy (old SWOT format) vs new rich format
  const isLegacy = !d.competitivePositionScore && !d.headToHead

  if (isLegacy) {
    return <LegacyReport data={d} />
  }

  const posScore = d.competitivePositionScore ?? 50
  const momentum = d.marketMomentum ?? 0
  const ratingGap = d.ratingGap ?? 0

  // Score color helpers
  const posColor = posScore >= 70 ? 'text-green-600' : posScore >= 45 ? 'text-teal-600' : posScore >= 25 ? 'text-amber-600' : 'text-red-600'
  const posStroke = posScore >= 70 ? '#22c55e' : posScore >= 45 ? '#0d9488' : posScore >= 25 ? '#d97706' : '#ef4444'
  const posLabel = posScore >= 70 ? 'Market Leader' : posScore >= 45 ? 'Competitive' : posScore >= 25 ? 'Catching Up' : 'Behind'
  const posBg = posScore >= 70 ? 'bg-green-100 text-green-700' : posScore >= 45 ? 'bg-teal-100 text-teal-700' : posScore >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  const gaugeRadius = 54
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCircumference - (posScore / 100) * gaugeCircumference

  const momentumLabel = momentum > 3 ? 'Gaining fast' : momentum > 0 ? 'Gaining ground' : momentum === 0 ? 'Holding steady' : momentum > -3 ? 'Losing ground' : 'Falling behind'
  const momentumPercent = Math.abs(momentum) / 10 * 100

  const categoryIcons: Record<string, string> = {
    service: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    staff: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    operations: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    marketing: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    product: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  }

  const categoryColors: Record<string, string> = {
    service: 'bg-teal-50 text-teal-700 border-teal-200',
    staff: 'bg-blue-50 text-blue-700 border-blue-200',
    operations: 'bg-purple-50 text-purple-700 border-purple-200',
    marketing: 'bg-amber-50 text-amber-700 border-amber-200',
    product: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }

  const headToHead = d.headToHead || []
  const thematicGaps = d.thematicGaps || []
  const strengths = d.competitiveStrengths || []
  const weaknesses = d.competitiveWeaknesses || []
  const threats = d.threatAlerts || []
  const opportunities = d.opportunities || []
  const recs = d.recommendations || []
  const stealWorthy = d.stealWorthy || []
  const respComp = d.responseComparison
  const sentComp = d.sentimentComparison

  return (
    <div className="space-y-8">
      {/* ── Hero Section: Position Score + Momentum + Top Action ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Competitive Position Score */}
        <div className="group bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center hover:shadow-lg hover:border-teal-200/50 transition-all duration-300">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Market Position</div>
          <div className="relative w-36 h-36 mb-3">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={gaugeRadius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle
                cx="60" cy="60" r={gaugeRadius}
                fill="none"
                stroke={posStroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeOffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${posColor}`}>{posScore}</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">/ 100</span>
            </div>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${posBg}`}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: posStroke }} />
            {posLabel}
          </div>
        </div>

        {/* Momentum */}
        <div className="group bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center hover:shadow-lg hover:border-teal-200/50 transition-all duration-300">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Market Momentum</div>
          <div className="relative w-36 h-36 mb-3 flex items-center justify-center">
            <div className={`absolute inset-3 rounded-full ${
              momentum > 0 ? 'bg-green-50' : momentum < 0 ? 'bg-red-50' : 'bg-gray-50'
            } transition-colors duration-300`} />
            <div className="relative flex flex-col items-center">
              <svg
                className={`w-10 h-10 mb-1 transition-all duration-500 ${
                  momentum > 0 ? 'text-green-500 -translate-y-1' :
                  momentum < 0 ? 'text-red-500 translate-y-1 rotate-180' :
                  'text-gray-400 rotate-90'
                }`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className={`text-3xl font-bold ${
                momentum > 0 ? 'text-green-600' : momentum < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {momentum > 0 ? '+' : ''}{momentum}
              </span>
            </div>
          </div>
          <div className="w-full max-w-[140px]">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  momentum > 0 ? 'bg-green-500' : momentum < 0 ? 'bg-red-500' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.max(momentumPercent, 5)}%` }}
              />
            </div>
            <div className={`text-xs font-medium text-center mt-1.5 ${
              momentum > 0 ? 'text-green-600' : momentum < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>{momentumLabel}</div>
          </div>
        </div>

        {/* Top Action Item */}
        {d.topActionItem && (
          <div className="group relative bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white overflow-hidden hover:shadow-lg hover:shadow-teal-200/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-teal-200 uppercase tracking-wider">Priority Action</span>
              </div>
              <div className="text-lg font-bold mb-2 leading-tight">{d.topActionItem.title}</div>
              <p className="text-teal-100 text-sm leading-relaxed">{d.topActionItem.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Rating Comparison Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-teal-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">★</div>
          <div>
            <div className="text-3xl font-black text-gray-900">{d.ownedAverageRating?.toFixed(1) || 'N/A'}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Your Average</div>
            {d.ownedReviewCount != null && <div className="text-xs text-gray-400">{d.ownedReviewCount} reviews</div>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-rose-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">★</div>
          <div>
            <div className="text-3xl font-black text-gray-900">{d.competitorAverageRating?.toFixed(1) || 'N/A'}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Competitor Avg</div>
            {d.competitorReviewCount != null && <div className="text-xs text-gray-400">{d.competitorReviewCount} reviews</div>}
          </div>
        </div>
        <div className={`bg-white rounded-2xl border p-5 flex items-center gap-4 ${ratingGap >= 0 ? 'border-green-100' : 'border-red-100'}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${ratingGap >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {ratingGap >= 0 ? '+' : ''}{ratingGap.toFixed(1)}
          </div>
          <div>
            <div className={`text-lg font-bold ${ratingGap >= 0 ? 'text-green-700' : 'text-red-700'}`}>{ratingGap >= 0 ? 'Ahead' : 'Behind'}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rating Gap</div>
          </div>
        </div>
      </div>

      {/* ── Executive Summary ── */}
      {d.executiveSummary && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Executive Summary</h4>
          </div>
          <p className="text-gray-700 leading-relaxed text-[15px]">{d.executiveSummary}</p>
        </div>
      )}

      {/* ── Threat Alerts ── */}
      {threats.length > 0 && (
        <div className="space-y-3">
          {threats.map((alert, i) => (
            <div key={i} className={`rounded-2xl border-l-4 p-5 ${
              alert.urgency === 'high' ? 'bg-red-50 border-l-red-500' :
              alert.urgency === 'medium' ? 'bg-amber-50 border-l-amber-500' :
              'bg-blue-50 border-l-blue-500'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <svg className={`w-5 h-5 ${
                  alert.urgency === 'high' ? 'text-red-500' :
                  alert.urgency === 'medium' ? 'text-amber-500' : 'text-blue-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="font-bold text-sm text-gray-900">{alert.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  alert.urgency === 'high' ? 'bg-red-200 text-red-800' :
                  alert.urgency === 'medium' ? 'bg-amber-200 text-amber-800' :
                  'bg-blue-200 text-blue-800'
                }`}>{alert.urgency}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-7">{alert.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Head-to-Head Breakdown ── */}
      {headToHead.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-gray-900">Head-to-Head</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {headToHead.map((h2h, i) => {
              const diff = h2h.yourRating - h2h.theirRating
              return (
                <div key={i} className="px-6 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-gray-900">vs. {h2h.competitorName}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">You</span>
                        <span className="text-sm font-bold text-teal-600">{h2h.yourRating.toFixed(1)} ★</span>
                        <span className="text-xs text-gray-400 ml-1">({h2h.yourVolume})</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                      </div>
                      <div className="text-left">
                        <span className="text-xs text-gray-400 block">Them</span>
                        <span className="text-sm font-bold text-rose-600">{h2h.theirRating.toFixed(1)} ★</span>
                        <span className="text-xs text-gray-400 ml-1">({h2h.theirVolume})</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{h2h.verdict}</p>
                  <div className="flex flex-wrap gap-4">
                    {h2h.youWinOn.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-green-600">You win:</span>
                        {h2h.youWinOn.map((t, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{t}</span>
                        ))}
                      </div>
                    )}
                    {h2h.theyWinOn.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-rose-600">They win:</span>
                        {h2h.theyWinOn.map((t, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sentiment & Response Rate Comparison ── */}
      {(sentComp || respComp) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sentComp && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Customer Sentiment</div>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-teal-600">You</span>
                    <span className="text-sm font-bold text-teal-700">{sentComp.yourSentiment}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-700" style={{ width: `${sentComp.yourSentiment}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-rose-600">Competitors</span>
                    <span className="text-sm font-bold text-rose-700">{sentComp.competitorSentiment}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all duration-700" style={{ width: `${sentComp.competitorSentiment}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{sentComp.analysis}</p>
            </div>
          )}
          {respComp && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Review Response Rate</div>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-teal-600">You</span>
                    <span className="text-sm font-bold text-teal-700">{respComp.yourResponseRate}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-700" style={{ width: `${respComp.yourResponseRate}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-rose-600">Competitors</span>
                    <span className="text-sm font-bold text-rose-700">{respComp.competitorAvgResponseRate}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all duration-700" style={{ width: `${respComp.competitorAvgResponseRate}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{respComp.analysis}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Thematic Gap Analysis ── */}
      {thematicGaps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-gray-900">Thematic Gap Analysis</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {thematicGaps.map((gap, i) => {
              const gapColors: Record<string, string> = {
                advantage: 'bg-green-50/50 border-green-200',
                disadvantage: 'bg-red-50/50 border-red-200',
                opportunity: 'bg-blue-50/50 border-blue-200',
                threat: 'bg-amber-50/50 border-amber-200',
              }
              const gapBadgeColors: Record<string, string> = {
                advantage: 'bg-green-100 text-green-700',
                disadvantage: 'bg-red-100 text-red-700',
                opportunity: 'bg-blue-100 text-blue-700',
                threat: 'bg-amber-100 text-amber-700',
              }
              const sentimentIcon = (s: string) => {
                if (s === 'positive') return <span className="text-green-500 text-xs font-bold">+</span>
                if (s === 'negative') return <span className="text-red-500 text-xs font-bold">-</span>
                if (s === 'absent') return <span className="text-gray-300 text-xs font-bold">?</span>
                return <span className="text-amber-500 text-xs font-bold">~</span>
              }
              return (
                <div key={i} className={`rounded-xl border p-4 ${gapColors[gap.gapType] || 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">{gap.theme}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${gapBadgeColors[gap.gapType] || 'bg-gray-100 text-gray-700'}`}>
                      {gap.gapType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">You: {sentimentIcon(gap.yourSentiment)} {gap.yourSentiment}</span>
                    <span className="flex items-center gap-1">Them: {sentimentIcon(gap.competitorSentiment)} {gap.competitorSentiment}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{gap.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Competitive Strengths & Weaknesses ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h4 className="text-sm font-bold text-gray-900">Where You Win</h4>
              <span className="text-xs text-gray-400 ml-auto">{strengths.length} areas</span>
            </div>
            <div className="divide-y divide-gray-50">
              {strengths.map((s, i) => (
                <div key={i} className="px-6 py-4 hover:bg-green-50/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-900">{s.theme}</span>
                    {s.mentionCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{s.mentionCount} mentions</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>
                  {s.exampleQuote && (
                    <div className="mt-2 pl-3 border-l-2 border-green-200">
                      <p className="text-xs text-gray-500 italic">&ldquo;{s.exampleQuote}&rdquo;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <h4 className="text-sm font-bold text-gray-900">Where They Win</h4>
              <span className="text-xs text-gray-400 ml-auto">{weaknesses.length} areas</span>
            </div>
            <div className="divide-y divide-gray-50">
              {weaknesses.map((w, i) => (
                <div key={i} className="px-6 py-4 hover:bg-red-50/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-900">{w.theme}</span>
                    <div className="flex items-center gap-2">
                      {w.mentionCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{w.mentionCount} mentions</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        w.severity === 'high' ? 'bg-red-200 text-red-800' :
                        w.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>{w.severity}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{w.description}</p>
                  {w.exampleQuote && (
                    <div className="mt-2 pl-3 border-l-2 border-red-200">
                      <p className="text-xs text-gray-500 italic">&ldquo;{w.exampleQuote}&rdquo;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Opportunities ── */}
      {opportunities.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-gray-900">Opportunities</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {opportunities.map((o, i) => (
              <div key={i} className="px-6 py-4 hover:bg-blue-50/30 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <span className="font-semibold text-sm text-gray-900">{o.title}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 uppercase mb-0.5">Impact</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(dot => (
                          <div key={dot} className={`w-2 h-2 rounded-full ${
                            (o.impact === 'high' && dot <= 3) || (o.impact === 'medium' && dot <= 2) || (o.impact === 'low' && dot <= 1)
                              ? 'bg-blue-500' : 'bg-gray-200'
                          }`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 uppercase mb-0.5">Effort</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(dot => (
                          <div key={dot} className={`w-2 h-2 rounded-full ${
                            (o.effort === 'high' && dot <= 3) || (o.effort === 'medium' && dot <= 2) || (o.effort === 'low' && dot <= 1)
                              ? 'bg-amber-500' : 'bg-gray-200'
                          }`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{o.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommendations ── */}
      {recs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="text-sm font-bold text-gray-900">Recommendations</h4>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by impact. Quick wins first.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {recs.map((r, i) => (
              <div key={i} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${categoryColors[r.category] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={categoryIcons[r.category] || categoryIcons.service} />
                      </svg>
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-gray-900">{r.title}</span>
                      {r.category && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider ml-2">{r.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 uppercase mb-0.5">Impact</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(dot => (
                          <div key={dot} className={`w-2 h-2 rounded-full ${
                            (r.impact === 'high' && dot <= 3) || (r.impact === 'medium' && dot <= 2) || (r.impact === 'low' && dot <= 1)
                              ? 'bg-green-500' : 'bg-gray-200'
                          }`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 uppercase mb-0.5">Effort</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(dot => (
                          <div key={dot} className={`w-2 h-2 rounded-full ${
                            (r.effort === 'high' && dot <= 3) || (r.effort === 'medium' && dot <= 2) || (r.effort === 'low' && dot <= 1)
                              ? 'bg-amber-500' : 'bg-gray-200'
                          }`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed pl-[42px]">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Steal-Worthy: Learn from Competitors ── */}
      {stealWorthy.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-gray-900">Learn from Competitors</h4>
            <span className="text-xs text-gray-400 ml-1">What their customers love</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stealWorthy.map((sw, i) => (
              <div key={i} className="rounded-xl bg-amber-50/50 border border-amber-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{sw.competitorName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-600 font-medium">{sw.theme}</span>
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed mb-3">&ldquo;{sw.quote}&rdquo;</p>
                <div className="flex items-start gap-2 pt-3 border-t border-amber-200/50">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-xs text-gray-600">{sw.takeaway}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Legacy report renderer (for old SWOT-style data) ──

function LegacyReport({ data: d }: { data: CompetitiveData }) {
  return (
    <div className="space-y-8">
      {/* Stats Comparison */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-white p-5 rounded-xl border border-teal-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center font-bold text-xl">★</div>
          <div>
            <div className="text-3xl font-black text-gray-900">{d.ownedAverageRating?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Your Average</div>
          </div>
        </div>
        <div className="flex-1 bg-white p-5 rounded-xl border border-rose-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-xl">★</div>
          <div>
            <div className="text-3xl font-black text-gray-900">{d.competitorAverageRating?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Competitor Avg</div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {(d.summary || d.executiveSummary) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-3">Summary</h4>
          <p className="text-gray-800 text-lg leading-relaxed">{d.summary || d.executiveSummary}</p>
        </div>
      )}

      {/* SWOT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {d.strengths && d.strengths.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm">
            <h4 className="flex items-center gap-2 text-lg font-bold text-green-700 mb-4">Strengths</h4>
            <ul className="space-y-3">
              {d.strengths.map((s: string, i: number) => (
                <li key={i} className="flex gap-3 text-gray-700"><span className="text-green-500 flex-shrink-0 mt-0.5">&bull;</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        )}
        {d.weaknesses && d.weaknesses.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
            <h4 className="flex items-center gap-2 text-lg font-bold text-red-700 mb-4">Weaknesses</h4>
            <ul className="space-y-3">
              {d.weaknesses.map((w: string, i: number) => (
                <li key={i} className="flex gap-3 text-gray-700"><span className="text-red-500 flex-shrink-0 mt-0.5">&bull;</span><span>{w}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
