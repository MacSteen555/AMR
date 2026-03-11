'use client'

import { useState, useMemo } from 'react'

interface ReferencedReview {
  rating: number
  comment: string | null
  review_date: string
  reviewer_name?: string | null
}

interface AIInsight {
  id: string
  period_start: string
  period_end: string
  period_window: string | null
  data: any
  generated_at: string
  model: string
}

// ── Review Reference Modal ──────────────────────────────────────────────────

function ReviewModal({ review, onClose }: { review: ReferencedReview; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">
              {review.reviewer_name || 'Anonymous Reviewer'}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(review.review_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-5 h-5 ${star <= review.rating ? 'text-amber-400' : 'text-gray-200'}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-sm font-semibold text-gray-700 ml-1">{review.rating}/5</span>
        </div>

        {review.comment ? (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-400 italic">No comment left with this review</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Rich Text: parses {{REV:id}} into inline clickable links ────────────────

// Matches {{REV:uuid:display text}} (with display text) or {{REV:uuid}} (legacy, no display text)
const REV_PATTERN = /\{\{REV:([a-f0-9-]+)(?::([^}]+))?\}\}/g

function RichText({
  text,
  referencedReviews,
  onReviewClick,
  className = '',
  variant = 'default',
}: {
  text: string
  referencedReviews: Record<string, ReferencedReview>
  onReviewClick: (review: ReferencedReview) => void
  className?: string
  variant?: 'default' | 'light'
}) {
  const parts = useMemo(() => {
    const result: Array<
      | { type: 'text'; value: string }
      | { type: 'ref'; id: string; review: ReferencedReview; displayText: string }
    > = []
    let lastIndex = 0
    let match

    const pattern = new RegExp(REV_PATTERN.source, 'g')
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: text.slice(lastIndex, match.index) })
      }
      const reviewId = match[1]
      const displayText = match[2] || null // capture group 2 = display text
      const review = referencedReviews[reviewId]
      if (review) {
        result.push({
          type: 'ref',
          id: reviewId,
          review,
          displayText: displayText || review.reviewer_name || `${review.rating}★ review`,
        })
      } else if (displayText) {
        // Review not in map but display text exists — render as plain text
        result.push({ type: 'text', value: displayText })
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.slice(lastIndex) })
    }
    return result
  }, [text, referencedReviews])

  if (parts.length === 1 && parts[0].type === 'text') {
    return <span className={className}>{text}</span>
  }

  const linkClass = variant === 'light'
    ? 'text-amber-200 hover:text-amber-100 decoration-amber-300/50 hover:decoration-amber-200'
    : 'text-teal-600 hover:text-teal-800 decoration-teal-400/60 hover:decoration-teal-600'

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>
        }
        return (
          <button
            key={i}
            onClick={() => onReviewClick(part.review)}
            className={`inline cursor-pointer transition-colors underline underline-offset-2 decoration-dotted font-medium ${linkClass}`}
            title={`View review by ${part.review.reviewer_name || 'reviewer'} (${part.review.rating}★)`}
          >
            {part.displayText}
          </button>
        )
      })}
    </span>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export function AIInsightsPanel({ insight }: { insight: AIInsight }) {
  const [activeReview, setActiveReview] = useState<ReferencedReview | null>(null)

  const d = insight.data
  const referencedReviews: Record<string, ReferencedReview> = d.referencedReviews || {}

  // Support both old format (string customerPersona) and new format (object)
  const summary = d.executiveSummary || d.summary || ''
  const strengths = d.keyStrengths || []
  const weaknesses = d.keyWeaknesses || []
  const topics = d.emergingTopics || []
  const alerts = d.riskAlerts || []
  const recs = d.recommendations || []
  const quotes = d.notableQuotes || []
  const sentiment = typeof d.overallSentiment === 'number' ? d.overallSentiment : null
  const momentum = typeof d.momentumScore === 'number' ? d.momentumScore : null
  const topAction = d.topActionItem || null
  // Badge derivation for emerging topics
  const getTopicBadge = (t: any) => {
    if (t.previousMentions != null && t.currentMentions != null) {
      if (t.previousMentions === 0 && t.currentMentions >= 1) return { label: 'NEW', cls: 'bg-purple-200 text-purple-800' }
      if (t.currentMentions > t.previousMentions) return { label: 'RISING', cls: 'bg-green-200 text-green-800' }
      if (t.currentMentions < t.previousMentions) return { label: 'FADING', cls: 'bg-red-200 text-red-800' }
      return { label: 'STEADY', cls: 'bg-gray-200 text-gray-700' }
    }
    // Fallback for old data with trend field
    if (t.trend === 'rising') return { label: 'RISING', cls: 'bg-green-200 text-green-800' }
    if (t.trend === 'falling') return { label: 'FADING', cls: 'bg-red-200 text-red-800' }
    return { label: 'STEADY', cls: 'bg-gray-200 text-gray-700' }
  }

  // Sentiment gauge helpers
  const sentimentStroke = sentiment !== null
    ? sentiment >= 80 ? '#22c55e' : sentiment >= 60 ? '#0d9488' : sentiment >= 40 ? '#d97706' : sentiment >= 20 ? '#ea580c' : '#ef4444'
    : '#d1d5db'
  const sentimentColor = sentiment !== null
    ? sentiment >= 80 ? 'text-green-600' : sentiment >= 60 ? 'text-teal-600' : sentiment >= 40 ? 'text-amber-600' : sentiment >= 20 ? 'text-orange-600' : 'text-red-600'
    : 'text-gray-400'
  const sentimentLabel = sentiment !== null
    ? sentiment >= 80 ? 'Excellent' : sentiment >= 60 ? 'Good' : sentiment >= 40 ? 'Mixed' : sentiment >= 20 ? 'Concerning' : 'Critical'
    : 'N/A'
  const gaugeRadius = 54
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = sentiment !== null ? gaugeCircumference - (sentiment / 100) * gaugeCircumference : gaugeCircumference

  const momentumLabel = momentum !== null
    ? momentum > 3 ? 'Strong upward' : momentum > 0 ? 'Slight upward' : momentum === 0 ? 'Flat' : momentum > -3 ? 'Slight decline' : 'Sharp decline'
    : null
  const momentumPercent = momentum !== null ? Math.abs(momentum) / 10 * 100 : 0

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

  // Shorthand for rendering rich text with review references
  const rt = (text: string, extraClass?: string, variant?: 'default' | 'light') => (
    <RichText text={text} referencedReviews={referencedReviews} onReviewClick={setActiveReview} className={extraClass} variant={variant} />
  )

  return (
    <div className="space-y-8">
      {/* Review Modal */}
      {activeReview && (
        <ReviewModal review={activeReview} onClose={() => setActiveReview(null)} />
      )}

      {/* ── Comparison Block ── */}
      {d.comparison && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border border-gray-200 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4">vs Previous Period</h4>
          <p className="text-base font-semibold text-gray-800 mb-4">{d.comparison.headline}</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{d.comparison.currentAvgRating?.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Avg Rating</div>
              <div className={`text-xs font-medium mt-1 ${
                d.comparison.currentAvgRating > d.comparison.previousAvgRating ? 'text-green-600' :
                d.comparison.currentAvgRating < d.comparison.previousAvgRating ? 'text-red-600' : 'text-gray-500'
              }`}>
                was {d.comparison.previousAvgRating?.toFixed(1)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{d.comparison.currentReviewCount}</div>
              <div className="text-xs text-gray-500">Reviews</div>
              <div className={`text-xs font-medium mt-1 ${
                d.comparison.currentReviewCount > d.comparison.previousReviewCount ? 'text-green-600' :
                d.comparison.currentReviewCount < d.comparison.previousReviewCount ? 'text-red-600' : 'text-gray-500'
              }`}>
                was {d.comparison.previousReviewCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{d.comparison.currentSentiment}</div>
              <div className="text-xs text-gray-500">Sentiment</div>
              <div className={`text-xs font-medium mt-1 ${
                d.comparison.currentSentiment > d.comparison.previousSentiment ? 'text-green-600' :
                d.comparison.currentSentiment < d.comparison.previousSentiment ? 'text-red-600' : 'text-gray-500'
              }`}>
                was {d.comparison.previousSentiment}
              </div>
            </div>
          </div>
          {d.comparison.keyDeltas?.length > 0 && (
            <div className="space-y-2">
              {d.comparison.keyDeltas.map((delta: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    delta.direction === 'up' ? 'bg-green-100 text-green-600' :
                    delta.direction === 'down' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className={`w-3 h-3 ${delta.direction === 'down' ? 'rotate-180' : delta.direction === 'flat' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700"><strong>{delta.metric}:</strong> {delta.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hero Section: Sentiment Gauge + Momentum + Top Action ── */}
      {(sentiment !== null || momentum !== null || topAction) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Sentiment Score — Circular SVG Gauge */}
          {sentiment !== null && (
            <div className="group bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center hover:shadow-lg hover:border-teal-200/50 transition-all duration-300">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Sentiment Score</div>
              <div className="relative w-36 h-36 mb-3">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={gaugeRadius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r={gaugeRadius}
                    fill="none"
                    stroke={sentimentStroke}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold ${sentimentColor}`}>{sentiment}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">/ 100</span>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                sentiment >= 80 ? 'bg-green-100 text-green-700' :
                sentiment >= 60 ? 'bg-teal-100 text-teal-700' :
                sentiment >= 40 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sentimentStroke }} />
                {sentimentLabel}
              </div>
            </div>
          )}

          {/* Momentum — Dynamic indicator */}
          {momentum !== null && (
            <div className="group bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center hover:shadow-lg hover:border-teal-200/50 transition-all duration-300">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Momentum</div>
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
          )}

          {/* Top Action Item */}
          {topAction && (
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
                <div className="text-lg font-bold mb-2 leading-tight">{rt(topAction.title, undefined, 'light')}</div>
                <p className="text-teal-100 text-sm leading-relaxed">{rt(topAction.description, undefined, 'light')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Executive Summary ── */}
      {summary && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Executive Summary</h4>
          </div>
          <p className="text-gray-700 leading-relaxed text-[15px]">{rt(summary)}</p>
          {d.ratingTrend && (
            <div className="mt-4 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                d.ratingTrend === 'improving' ? 'bg-green-100 text-green-700' :
                d.ratingTrend === 'declining' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                <svg className={`w-3 h-3 ${d.ratingTrend === 'declining' ? 'rotate-180' : d.ratingTrend === 'stable' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {d.ratingTrend.charAt(0).toUpperCase() + d.ratingTrend.slice(1)}
              </span>
              {d.ratingTrendDescription && (
                <span className="text-sm text-gray-500">{rt(d.ratingTrendDescription)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Risk Alerts ── */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert: any, i: number) => (
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
                <span className="font-bold text-sm text-gray-900">{rt(alert.title)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  alert.urgency === 'high' ? 'bg-red-200 text-red-800' :
                  alert.urgency === 'medium' ? 'bg-amber-200 text-amber-800' :
                  'bg-blue-200 text-blue-800'
                }`}>{alert.urgency}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-7">{rt(alert.description)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Strengths & Weaknesses ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h4 className="text-sm font-bold text-gray-900">Key Strengths</h4>
              <span className="text-xs text-gray-400 ml-auto">{strengths.length} identified</span>
            </div>
            <div className="divide-y divide-gray-50">
              {strengths.map((s: any, i: number) => (
                <div key={i} className="px-6 py-4 hover:bg-green-50/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gray-900">{s.theme}</span>
                    {s.mentionCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{s.mentionCount} mentions</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{rt(s.description)}</p>
                  {s.exampleQuote && (
                    <div className="mt-2 pl-3 border-l-2 border-green-200">
                      <p className="text-xs text-gray-500 italic">{rt(s.exampleQuote)}</p>
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
              <h4 className="text-sm font-bold text-gray-900">Areas for Improvement</h4>
              <span className="text-xs text-gray-400 ml-auto">{weaknesses.length} identified</span>
            </div>
            <div className="divide-y divide-gray-50">
              {weaknesses.map((w: any, i: number) => (
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
                  <p className="text-sm text-gray-600 leading-relaxed">{rt(w.description)}</p>
                  {w.exampleQuote && (
                    <div className="mt-2 pl-3 border-l-2 border-red-200">
                      <p className="text-xs text-gray-500 italic">{rt(w.exampleQuote)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Emerging Topics ── */}
      {topics.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4">Emerging Topics</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map((t: any, i: number) => (
              <div key={i} className={`rounded-xl border p-4 ${
                t.sentiment === 'positive' ? 'bg-green-50/50 border-green-200' :
                t.sentiment === 'negative' ? 'bg-red-50/50 border-red-200' :
                'bg-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${
                    t.sentiment === 'positive' ? 'text-green-800' :
                    t.sentiment === 'negative' ? 'text-red-800' : 'text-amber-800'
                  }`}>{t.topic}</span>
                  {(() => {
                    const badge = getTopicBadge(t)
                    return (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{rt(t.description)}</p>
                {(t.previousMentions != null || t.currentMentions != null) && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    {t.currentMentions} mentions now{t.previousMentions != null ? ` vs ${t.previousMentions} last period` : ''}
                  </div>
                )}
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
            {recs.map((r: any, i: number) => (
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
                <p className="text-sm text-gray-600 leading-relaxed pl-[42px]">{rt(r.description)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notable Quotes ── */}
      {quotes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4">Customer Voices</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotes.map((q: any, i: number) => (
              <div key={i} className={`rounded-xl p-5 border-l-4 ${
                q.sentiment === 'positive' ? 'bg-green-50/50 border-l-green-400' : 'bg-red-50/50 border-l-red-400'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex text-amber-400 text-sm">
                    {'★'.repeat(q.rating)}
                    <span className="text-gray-300">{'★'.repeat(5 - q.rating)}</span>
                  </div>
                  {q.theme && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-medium">{q.theme}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{q.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Metadata Footer ── */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-4 border-t border-gray-100">
        <span>Generated {new Date(insight.generated_at).toLocaleString()}</span>
        <span>Model: {insight.model}</span>
        <span>Period: {insight.period_start} to {insight.period_end}</span>
      </div>
    </div>
  )
}
