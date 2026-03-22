'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart,
} from 'recharts'
import type { UnifiedReportData } from '@/lib/openai/insights'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReferencedReview {
  rating: number
  comment: string | null
  review_date: string
  reviewer_name?: string | null
}

// ── Review Modal ─────────────────────────────────────────────────────────────

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

// ── Review Popover ───────────────────────────────────────────────────────────

function ReviewPopover({ review, position }: { review: ReferencedReview; position: { top: number; left: number } }) {
  return (
    <div
      className="fixed z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 pointer-events-none"
      style={{ top: position.top - 8, left: position.left, transform: 'translate(-50%, -100%)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-900">
          {review.reviewer_name || 'Anonymous'}
        </span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-3.5 h-3.5 ${star <= review.rating ? 'text-amber-400' : 'text-gray-200'}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {new Date(review.review_date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        })}
      </div>
      {review.comment ? (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{review.comment}</p>
      ) : (
        <p className="text-xs text-gray-400 italic">No comment</p>
      )}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45" />
    </div>
  )
}

// ── Rich Text ────────────────────────────────────────────────────────────────

const REV_PATTERN = /\{\{REV:([a-f0-9-]+)(?::([^}]+))?\}\}/g

function RichText({
  text,
  referencedReviews,
  onReviewClick,
  onReviewHover,
  onReviewLeave,
  className = '',
  variant = 'default',
}: {
  text: string
  referencedReviews: Record<string, ReferencedReview>
  onReviewClick: (review: ReferencedReview) => void
  onReviewHover: (review: ReferencedReview, e: React.MouseEvent) => void
  onReviewLeave: () => void
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
      const displayText = match[2] || null
      const review = referencedReviews[reviewId]
      if (review) {
        result.push({
          type: 'ref',
          id: reviewId,
          review,
          displayText: displayText || review.reviewer_name || `${review.rating}★ review`,
        })
      } else if (displayText) {
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
            onMouseEnter={(e) => onReviewHover(part.review, e)}
            onMouseLeave={onReviewLeave}
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

// ── Star Rating (inline) ─────────────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${cls} ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ── Chevron SVG ──────────────────────────────────────────────────────────────

function ChevronDown({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Nav Sections ─────────────────────────────────────────────────────────────

interface NavSection {
  id: string
  label: string
  zone: 1 | 2
}

// ── Impact/Effort Dots ───────────────────────────────────────────────────────

function DotLevel({ level, color }: { level: 'low' | 'medium' | 'high'; color: string }) {
  const count = level === 'low' ? 1 : level === 'medium' ? 2 : 3
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((d) => (
        <span
          key={d}
          className={`inline-block w-2 h-2 rounded-full ${d <= count ? color : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

// ── Category Colors ──────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  service: 'bg-teal-50 text-teal-700 border-teal-200',
  staff: 'bg-blue-50 text-blue-700 border-blue-200',
  operations: 'bg-purple-50 text-purple-700 border-purple-200',
  marketing: 'bg-amber-50 text-amber-700 border-amber-200',
  product: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

// ── Month Formatter ──────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtMonth(m: string) {
  const [, month] = m.split('-')
  return MONTH_NAMES[parseInt(month, 10) - 1] || m
}

// ── Sentiment Dot ────────────────────────────────────────────────────────────

function SentimentDot({ sentiment }: { sentiment: string }) {
  const color =
    sentiment === 'positive' ? 'bg-emerald-400'
    : sentiment === 'negative' ? 'bg-red-400'
    : 'bg-gray-400'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function UnifiedReportPanel({ data }: { data: UnifiedReportData }) {
  const [modalReview, setModalReview] = useState<ReferencedReview | null>(null)
  const [popover, setPopover] = useState<{ review: ReferencedReview; position: { top: number; left: number } } | null>(null)
  const [activeSection, setActiveSection] = useState<string>('snapshot')
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set())

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const refs = data.referencedReviews || {}

  // Build nav sections (conditional recommendations)
  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [
      { id: 'snapshot', label: 'Snapshot', zone: 1 },
      { id: 'trends', label: 'Trends', zone: 1 },
      { id: 'themes', label: 'Themes', zone: 1 },
      { id: 'big-picture', label: 'Big Picture', zone: 2 },
      { id: 'strengths-weaknesses', label: 'Strengths & Weaknesses', zone: 2 },
      { id: 'timeline', label: 'Timeline', zone: 2 },
    ]
    if (data.recommendations && data.recommendations.length > 0) {
      sections.push({ id: 'recommendations', label: 'Recommendations', zone: 2 })
    }
    return sections
  }, [data.recommendations])

  // Scroll spy via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visibleSections = new Map<string, number>()

    navSections.forEach((section) => {
      const el = sectionRefs.current[section.id]
      if (!el) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSections.set(section.id, entry.intersectionRatio)
            } else {
              visibleSections.delete(section.id)
            }
          })
          // Pick the section with highest intersection ratio
          let best = ''
          let bestRatio = 0
          visibleSections.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              best = id
              bestRatio = ratio
            }
          })
          if (best) setActiveSection(best)
        },
        { threshold: [0, 0.1, 0.25, 0.5], rootMargin: '-96px 0px -20% 0px' }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [navSections])

  const scrollTo = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleReviewHover = useCallback((review: ReferencedReview, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopover({ review, position: { top: rect.top, left: rect.left + rect.width / 2 } })
  }, [])

  const handleReviewLeave = useCallback(() => {
    setPopover(null)
  }, [])

  const rt = (text: string, extraClass?: string, variant?: 'default' | 'light') => (
    <RichText
      text={text}
      referencedReviews={refs}
      onReviewClick={setModalReview}
      onReviewHover={handleReviewHover}
      onReviewLeave={handleReviewLeave}
      className={extraClass}
      variant={variant}
    />
  )

  const toggleTheme = (idx: number) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // ── Trend stats ──
  const ts = data.trendStats
  const statCards = [
    { label: 'Avg Rating', value: ts.currentAvgRating.toFixed(1), prev: ts.previousAvgRating?.toFixed(1) ?? null },
    { label: 'Reviews', value: String(ts.currentReviewCount), prev: ts.previousReviewCount != null ? String(ts.previousReviewCount) : null },
    { label: 'Sentiment', value: `${ts.currentSentiment}%`, prev: ts.previousSentiment != null ? `${ts.previousSentiment}%` : null },
    { label: 'Response Rate', value: `${ts.currentResponseRate}%`, prev: ts.previousResponseRate != null ? `${ts.previousResponseRate}%` : null },
    { label: '5-Star %', value: `${ts.currentFiveStarPct}%`, prev: ts.previousFiveStarPct != null ? `${ts.previousFiveStarPct}%` : null },
  ]

  // ── Distribution chart data ──
  const distributionData = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => ({
      star: `${star}★`,
      current: ts.currentDistribution[star - 1] ?? 0,
      previous: ts.previousDistribution ? ts.previousDistribution[star - 1] ?? 0 : 0,
    }))
  }, [ts])

  // ── Weekly volume chart data ──
  const weeklyData = data.weeklyVolume || []

  return (
    <div className="flex gap-8 relative">
      {/* ── Desktop Sticky Left Nav ── */}
      <nav className="hidden lg:block w-48 flex-shrink-0">
        <div className="sticky top-24 space-y-1">
          {navSections.map((section) => (
            <div key={section.id}>
              {/* Zone label before Big Picture section */}
              {section.id === 'big-picture' && (
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 mt-4 border-t border-gray-200 pt-4">Big Picture</div>
              )}
              <button
                onClick={() => scrollTo(section.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeSection === section.id
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {section.label}
              </button>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar">
          {navSections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeSection === section.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-12 pb-20 lg:pb-0">

        {/* ═══ Recent Trends ═══ */}
        <div>

          {/* ── Section 1: Snapshot ── */}
          <section
            ref={(el) => { sectionRefs.current['snapshot'] = el }}
            id="snapshot"
            className="scroll-mt-28"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Snapshot</h3>
            <div className="space-y-3">
              {(data.snapshot || []).map((card, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3">
                  <SentimentDot sentiment={card.sentiment} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{card.headline}</span>
                      {card.delta && !card.delta.includes('n/a') && !card.delta.includes('null') && !card.delta.includes('small sample') && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          card.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700'
                          : card.sentiment === 'negative' ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {card.delta}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      {rt(card.description)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 2: Trends ── */}
          <section
            ref={(el) => { sectionRefs.current['trends'] = el }}
            id="trends"
            className="scroll-mt-28 mt-10"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Trends</h3>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {statCards.map((card) => (
                <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                  {card.prev != null && (
                    <div className="text-xs text-gray-400 mt-0.5">prev: {card.prev}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Rating Distribution Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              <h4 className="text-sm font-bold text-gray-900 mb-4">Rating Distribution</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="star" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                    <Bar dataKey="current" fill="#0d9488" radius={[4, 4, 0, 0]} name="Current" />
                    {ts.previousDistribution && (
                      <Bar dataKey="previous" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Previous" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Volume Chart */}
            {weeklyData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h4 className="text-sm font-bold text-gray-900 mb-4">Weekly Volume</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis yAxisId="count" tick={{ fontSize: 12, fill: '#9ca3af' }} orientation="left" />
                      <YAxis yAxisId="rating" domain={[1, 5]} tick={{ fontSize: 12, fill: '#9ca3af' }} orientation="right" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                        formatter={(value: any, name: any) => [
                          name === 'avgRating' ? Number(value).toFixed(2) : value,
                          name === 'avgRating' ? 'Avg Rating' : 'Reviews',
                        ]}
                      />
                      <Bar yAxisId="count" dataKey="reviewCount" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} name="reviewCount" />
                      <Line yAxisId="rating" type="monotone" dataKey="avgRating" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3, fill: '#0d9488' }} name="avgRating" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          {/* ── Section 3: Themes ── */}
          <section
            ref={(el) => { sectionRefs.current['themes'] = el }}
            id="themes"
            className="scroll-mt-28 mt-10"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Themes</h3>
            <div className="space-y-2">
              {(data.themes || []).map((theme, i) => {
                const expanded = expandedThemes.has(i)
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleTheme(i)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <SentimentDot sentiment={theme.sentiment} />
                      <span className="font-semibold text-gray-900 text-sm">{theme.theme}</span>
                      {theme.isNew && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">new</span>
                      )}
                      <span className="flex-1" />
                      <span className="text-xs text-gray-500 whitespace-nowrap">{theme.mentionCount} mentions</span>
                      <ChevronDown expanded={expanded} />
                    </button>
                    {expanded && theme.topQuotes && theme.topQuotes.length > 0 && (
                      <div className="px-5 pb-4 space-y-2">
                        {theme.topQuotes.map((q, qi) => (
                          <div key={qi} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 leading-relaxed">
                            {rt(q)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* ═══ Zone Divider ═══ */}
        <div className="border-t-2 border-dashed border-gray-200 my-12" />

        {/* ═══ ZONE 2: Big Picture ═══ */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">Zone 2: Big Picture</div>

          {/* ── Section 4: Big Picture Overview ── */}
          <section
            ref={(el) => { sectionRefs.current['big-picture'] = el }}
            id="big-picture"
            className="scroll-mt-28"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Big Picture</h3>

            {/* Dark Hero Stats */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-4xl font-bold">{data.bigPictureStats.totalReviews}</div>
                  <div className="text-sm text-slate-400 mt-1">Total Reviews</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">{data.bigPictureStats.averageRating.toFixed(1)}</div>
                  <div className="text-sm text-slate-400 mt-1">Average Rating</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">{data.bigPictureStats.fiveStarPercentage}%</div>
                  <div className="text-sm text-slate-400 mt-1">5-Star Reviews</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">{data.bigPictureStats.responseRate}%</div>
                  <div className="text-sm text-slate-400 mt-1">Response Rate</div>
                </div>
              </div>
            </div>

            {/* Narrative */}
            {data.bigPictureNarrative && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="text-gray-700 leading-relaxed text-[15px] whitespace-pre-line">
                  {rt(data.bigPictureNarrative)}
                </div>
              </div>
            )}
          </section>

          {/* ── Section 5: Strengths & Weaknesses ── */}
          <section
            ref={(el) => { sectionRefs.current['strengths-weaknesses'] = el }}
            id="strengths-weaknesses"
            className="scroll-mt-28 mt-10"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Strengths &amp; Weaknesses</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Strengths</h4>
                {(data.keyStrengths || []).map((s, i) => (
                  <div key={i} className="bg-white border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-gray-900 text-sm">{s.theme}</span>
                      <span className="text-xs text-gray-400 ml-auto">{s.mentionCount} mentions</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">{rt(s.description)}</p>
                    {s.exampleQuote && (
                      <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-800 italic leading-relaxed">
                        {rt(s.exampleQuote)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Weaknesses */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider">Weaknesses</h4>
                {(data.keyWeaknesses || []).map((w, i) => {
                  const severityColor =
                    w.severity === 'high' ? 'bg-red-50 text-red-700'
                    : w.severity === 'medium' ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                  return (
                    <div key={i} className="bg-white border border-red-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="font-semibold text-gray-900 text-sm">{w.theme}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${severityColor}`}>
                          {w.severity}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">{w.mentionCount} mentions</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-2">{rt(w.description)}</p>
                      {w.exampleQuote && (
                        <div className="bg-red-50 rounded-lg p-3 text-sm text-red-800 italic leading-relaxed">
                          {rt(w.exampleQuote)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── Section 6: Timeline ── */}
          <section
            ref={(el) => { sectionRefs.current['timeline'] = el }}
            id="timeline"
            className="scroll-mt-28 mt-10"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Timeline</h3>

            {/* Monthly Combo Chart */}
            {(data.monthlyTimeline || []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={(data.monthlyTimeline || []).map((m) => ({ ...m, label: fmtMonth(m.month) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis yAxisId="rating" domain={[1, 5]} tick={{ fontSize: 12, fill: '#9ca3af' }} orientation="left" />
                      <YAxis yAxisId="count" tick={{ fontSize: 12, fill: '#9ca3af' }} orientation="right" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                        formatter={(value: any, name: any) => [
                          name === 'avgRating' ? Number(value).toFixed(2) : value,
                          name === 'avgRating' ? 'Avg Rating' : 'Reviews',
                        ]}
                        labelFormatter={(label: any, payload: any) => {
                          const entry = payload?.[0]?.payload
                          return entry?.annotation ? `${label} — ${entry.annotation}` : String(label)
                        }}
                      />
                      <Bar yAxisId="count" dataKey="reviewCount" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={24} name="reviewCount" />
                      <Line yAxisId="rating" type="monotone" dataKey="avgRating" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0d9488' }} name="avgRating" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Annotated Months */}
                {(data.monthlyTimeline || []).some((m) => m.annotation) && (
                  <div className="mt-4 space-y-2">
                    {(data.monthlyTimeline || []).filter((m) => m.annotation).map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="font-semibold text-teal-700 whitespace-nowrap">{fmtMonth(m.month)}</span>
                        <span className="text-gray-600">{m.annotation}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Highlights & Lowlights */}
            {((data.highlights || []).length > 0 || (data.lowlights || []).length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Highlights */}
                {(data.highlights || []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Highlights</h4>
                    {(data.highlights || []).map((h, i) => (
                      <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="font-semibold text-gray-900 text-sm mb-1">{h.title}</div>
                        <p className="text-sm text-gray-600 leading-relaxed">{rt(h.description)}</p>
                        {h.quote && (
                          <div className="mt-2 text-xs text-emerald-700 italic">{rt(h.quote)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Lowlights */}
                {(data.lowlights || []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider">Lowlights</h4>
                    {(data.lowlights || []).map((l, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="font-semibold text-gray-900 text-sm mb-1">{l.title}</div>
                        <p className="text-sm text-gray-600 leading-relaxed">{rt(l.description)}</p>
                        {l.quote && (
                          <div className="mt-2 text-xs text-red-700 italic">{rt(l.quote)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section 7: Recommendations (conditional) ── */}
          {data.recommendations && data.recommendations.length > 0 && (
            <section
              ref={(el) => { sectionRefs.current['recommendations'] = el }}
              id="recommendations"
              className="scroll-mt-28 mt-10"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.recommendations.map((rec, i) => {
                  const catClass = categoryColors[rec.category] || 'bg-gray-50 text-gray-700 border-gray-200'
                  return (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h5 className="font-semibold text-gray-900 text-sm">{rec.title}</h5>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${catClass}`}>
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{rt(rec.description)}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>Impact</span>
                          <DotLevel level={rec.impact} color="bg-teal-500" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Effort</span>
                          <DotLevel level={rec.effort} color="bg-amber-500" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Popover Overlay ── */}
      {popover && <ReviewPopover review={popover.review} position={popover.position} />}

      {/* ── Modal Overlay ── */}
      {modalReview && <ReviewModal review={modalReview} onClose={() => setModalReview(null)} />}
    </div>
  )
}
