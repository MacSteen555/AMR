'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { apiGet, apiPost, apiPatch, streamDraft } from '@/lib/api'
import { Toast } from '@/components/Toast'
import { GbpPermissionsModal } from '@/components/GbpPermissionsModal'
import { useRouter, useParams } from 'next/navigation'

/* ─── Types ─── */

interface Review {
    id: string
    google_review_id: string
    reviewer_name: string
    rating: number
    comment: string
    review_date: string
    reply_status: 'none' | 'draft' | 'posted' | 'dismissed'
    draft_text?: string
    reply_text?: string
    location_name?: string
    location_id?: string
}

type SortBy = 'newest' | 'oldest' | 'highest' | 'lowest'
type ViewMode = 'list' | 'focus'

interface ReviewsViewProps {
    mode: 'team' | 'location'
    entityId: string
    title: string
    subtitle: string
    reviewsManaged?: number
    reviewsMax?: number
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING (SVG)
   ═══════════════════════════════════════════════════════════════ */

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <svg key={star} className={`${dims} ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; dot: string; text: string; label: string }> = {
        draft: { bg: 'bg-teal-50 border-teal-100', dot: 'bg-teal-500', text: 'text-teal-700', label: 'Draft' },
        posted: { bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Replied' },
        dismissed: { bg: 'bg-gray-100 border-gray-200', dot: 'bg-gray-400', text: 'text-gray-600', label: 'Dismissed' },
        none: { bg: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', label: 'Needs Reply' },
    }
    const c = config[status] || config.none
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${c.bg} ${c.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    )
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR (color-coded by rating)
   ═══════════════════════════════════════════════════════════════ */

function ReviewerAvatar({ name, rating, size = 'sm' }: { name: string; rating: number; size?: 'sm' | 'lg' }) {
    const bg = rating >= 4 ? 'bg-emerald-100 text-emerald-700' : rating === 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    const dims = size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
    return (
        <div className={`${dims} ${bg} rounded-full flex items-center justify-center font-bold shrink-0`}>
            {name?.charAt(0)?.toUpperCase() || '?'}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   STATS BAR
   ═══════════════════════════════════════════════════════════════ */

function StatsBar({ reviews, reviewsManaged, reviewsMax }: { reviews: Review[]; reviewsManaged?: number; reviewsMax?: number }) {
    const total = reviews.length
    const needsReply = reviews.filter(r => r.reply_status === 'none').length
    const drafts = reviews.filter(r => r.reply_status === 'draft').length
    const posted = reviews.filter(r => r.reply_status === 'posted').length
    const avgRating = total > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total) : 0

    const stats = [
        { label: 'Total Reviews', value: total, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />, color: 'text-gray-600' },
        { label: 'Needs Reply', value: needsReply, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, color: 'text-amber-600' },
        { label: 'Drafts Ready', value: drafts, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />, color: 'text-teal-600' },
        { label: 'Avg Rating', value: avgRating.toFixed(1), icon: <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />, color: 'text-amber-500', isFilled: true },
    ]

    const managed = reviewsManaged ?? 0
    const max = reviewsMax ?? 0
    const pct = max > 0 ? Math.min(100, (managed / max) * 100) : 0

    return (
        <div className="grid grid-cols-5 gap-3 mb-6">
            {stats.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center ${s.color}`}>
                        <svg className="w-[18px] h-[18px]" fill={s.isFilled ? 'currentColor' : 'none'} stroke={s.isFilled ? 'none' : 'currentColor'} viewBox="0 0 24 24">{s.icon}</svg>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-900 leading-tight">{s.value}</div>
                        <div className="text-[11px] text-gray-500 font-medium">{s.label}</div>
                    </div>
                </div>
            ))}
            {/* Reviews Managed — far right */}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-900 leading-tight">
                            {managed}<span className="text-sm font-medium text-gray-400">/{max}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium">Reviews Managed</div>
                    </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2.5">
                    <div
                        className="bg-emerald-500 rounded-full h-1.5 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */

function SkeletonCards() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 bg-gray-200 rounded-full" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="h-3.5 bg-gray-200 rounded w-28" />
                                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <div key={s} className="w-3.5 h-3.5 bg-gray-100 rounded" />)}</div>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded w-20" />
                        </div>
                        <div className="h-6 bg-gray-100 rounded-full w-20" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-full" />
                        <div className="h-3 bg-gray-100 rounded w-4/5" />
                    </div>
                    {i % 2 === 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
                            <div className="h-20 bg-gray-50 rounded-lg" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATES
   ═══════════════════════════════════════════════════════════════ */

function EmptyInbox() {
    return (
        <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-5">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">All caught up!</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">No reviews need your attention right now. New reviews will appear here automatically.</p>
        </div>
    )
}

function EmptyHistory() {
    return (
        <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-5">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No history yet</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">Once you post or dismiss reviews, they&apos;ll show up here for your records.</p>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   FOCUS VIEW (Tinder-like single-card flow)
   ═══════════════════════════════════════════════════════════════ */

function FocusView({
    reviews, stackIndex, streamingId, streamingText, edits, publishingId,
    canPost, showLocation, onGenerate, onPublish, onDismiss, onEditChange, onSkip, onBack, onLocationClick,
}: {
    reviews: Review[]
    stackIndex: number
    streamingId: string | null
    streamingText: Record<string, string>
    edits: Record<string, string>
    publishingId: string | null
    canPost: (review: Review) => boolean
    showLocation: boolean
    onGenerate: (id: string, prev?: string, mode?: 'generate' | 'regenerate') => void
    onPublish: (id: string) => void
    onDismiss: (id: string) => void
    onEditChange: (id: string, text: string) => void
    onSkip: () => void
    onBack: () => void
    onLocationClick?: (id: string) => void
}) {
    const review = reviews[stackIndex]
    const [cardKey, setCardKey] = useState(0)

    useEffect(() => { setCardKey(k => k + 1) }, [stackIndex])

    const getDisplayText = (r: Review): string => {
        if (streamingText[r.id] !== undefined) return streamingText[r.id]
        return edits[r.id] ?? r.draft_text ?? r.reply_text ?? ''
    }

    const isStreaming = review ? streamingId === review.id : false
    const progress = reviews.length > 0 ? ((stackIndex) / reviews.length) * 100 : 0

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!review) return
            const tag = document.activeElement?.tagName
            if (tag === 'TEXTAREA' || tag === 'INPUT') return

            if (e.key === 'ArrowLeft') { e.preventDefault(); onDismiss(review.id) }
            if (e.key === 'ArrowUp') { e.preventDefault(); onSkip() }
            if (e.key === 'ArrowRight' && review.reply_status === 'draft' && !publishingId && canPost(review)) {
                e.preventDefault(); onPublish(review.id)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [review, publishingId, onSkip, onDismiss, onPublish, canPost])

    if (!review) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full mb-4">
                        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">All caught up!</h2>
                    <p className="text-gray-500 text-sm mb-4">You&apos;ve reviewed everything in the queue.</p>
                    <button onClick={onBack} className="text-teal-600 hover:text-teal-800 font-medium text-sm transition-all duration-200 cursor-pointer">
                        Back to list
                    </button>
                </div>
            </div>
        )
    }

    const displayText = getDisplayText(review)

    return (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
            {/* Minimal progress */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-gray-400 tabular-nums shrink-0">{stackIndex + 1}/{reviews.length}</span>
            </div>

            {/* Card */}
            <div key={cardKey} className="flex-1 flex flex-col min-h-0" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                    {/* Review */}
                    <div className="px-6 pt-6 pb-4 flex-shrink-0">
                        <div className="flex items-center gap-3 mb-3">
                            <ReviewerAvatar name={review.reviewer_name} rating={review.rating} size="lg" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 truncate">{review.reviewer_name}</span>
                                    <StarRating rating={review.rating} size="md" />
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-gray-400">{getTimeAgo(review.review_date)}</span>
                                    {showLocation && review.location_name && (
                                        <>
                                            <span className="text-xs text-gray-300">·</span>
                                            <button onClick={() => onLocationClick?.(review.location_id || '')}
                                                className="text-xs text-teal-500 font-medium hover:underline cursor-pointer truncate">
                                                {review.location_name}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-700 text-[15px] leading-relaxed">
                            {review.comment || <span className="italic text-gray-400">No comment</span>}
                        </p>
                    </div>

                    {/* Reply */}
                    <div className="px-6 pb-5 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                {isStreaming ? (
                                    <><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500" /></span>Generating</>
                                ) : review.reply_status === 'draft' ? 'Reply' : 'Waiting...'}
                            </span>
                            {review.reply_status === 'draft' && !isStreaming && (
                                <button onClick={() => onGenerate(review.id, displayText, 'regenerate')}
                                    disabled={!!streamingId}
                                    className="text-[11px] text-gray-400 hover:text-teal-600 font-medium px-2 py-0.5 rounded hover:bg-teal-50 transition-all duration-200 cursor-pointer disabled:opacity-40">
                                    Regenerate
                                </button>
                            )}
                        </div>

                        {(review.reply_status === 'draft' || isStreaming) ? (
                            <textarea
                                className={`flex-1 w-full bg-gray-50 p-3.5 border border-gray-200 rounded-xl text-gray-800 text-sm leading-relaxed focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white outline-none resize-none transition-all min-h-[100px] ${isStreaming ? 'border-teal-200 bg-teal-50/30' : ''}`}
                                value={displayText}
                                onChange={e => onEditChange(review.id, e.target.value)}
                                readOnly={isStreaming}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 min-h-[100px]">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <div className="w-4 h-4 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                                    Generating...
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Compact actions */}
                <div className="flex items-center justify-between mt-3 mb-2">
                    <button onClick={() => onDismiss(review.id)}
                        className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Dismiss
                        <kbd className="text-[9px] font-mono text-gray-300 ml-0.5">←</kbd>
                    </button>

                    <button onClick={onSkip}
                        className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5">
                        Skip
                        <kbd className="text-[9px] font-mono text-gray-300 ml-0.5">↑</kbd>
                    </button>

                    <button onClick={() => onPublish(review.id)}
                        disabled={review.reply_status !== 'draft' || !!publishingId || !canPost(review)}
                        className="px-5 py-2 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-1.5">
                        {publishingId === review.id ? (
                            <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Posting</>
                        ) : (
                            <>Post<kbd className="text-[9px] font-mono text-teal-300 ml-0.5">→</kbd></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   REVIEW CARD
   ═══════════════════════════════════════════════════════════════ */

function ReviewCard({
    review, tab, displayText, isStreaming, canPost, fadingOut, publishingId, streamingId,
    onGenerate, onPublish, onDismiss, onEditChange, showLocation, onLocationClick,
}: {
    review: Review
    tab: 'inbox' | 'history'
    displayText: string
    isStreaming: boolean
    canPost: boolean
    fadingOut: boolean
    publishingId: string | null
    streamingId: string | null
    onGenerate: (id: string, prev?: string, mode?: 'generate' | 'regenerate') => void
    onPublish: (id: string, text?: string) => void
    onDismiss: (id: string) => void
    onEditChange: (id: string, text: string) => void
    showLocation: boolean
    onLocationClick?: (locationId: string) => void
}) {
    const hasDraft = review.reply_status === 'draft' || review.reply_status === 'posted' || review.reply_status === 'dismissed' || isStreaming
    const borderAccent = review.reply_status === 'posted' ? 'border-l-emerald-400' : review.reply_status === 'dismissed' ? 'border-l-gray-300' : 'border-l-teal-400'
    const timeAgo = getTimeAgo(review.review_date)

    return (
        <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md ${fadingOut ? 'opacity-30 scale-[0.98]' : 'opacity-100'}`}>
            {/* Review header */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <ReviewerAvatar name={review.reviewer_name} rating={review.rating} />
                        <div>
                            <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</span>
                                <StarRating rating={review.rating} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-gray-400">{timeAgo}</span>
                                {showLocation && review.location_name && (
                                    <>
                                        <span className="text-xs text-gray-300">·</span>
                                        <button
                                            onClick={() => onLocationClick?.(review.location_id || '')}
                                            className="text-xs text-teal-500 font-medium hover:text-teal-700 hover:underline cursor-pointer transition-colors"
                                        >
                                            {review.location_name}
                                        </button>
                                    </>
                                )}
                                {!canPost && showLocation && (
                                    <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-medium">View only</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {tab === 'inbox' && review.reply_status !== 'dismissed' && (
                            <button onClick={() => onDismiss(review.id)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all duration-200 cursor-pointer" title="Dismiss">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        <StatusBadge status={review.reply_status} />
                    </div>
                </div>
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">{review.comment || <span className="italic text-gray-400">No comment provided</span>}</p>
            </div>

            {/* Draft / Reply section */}
            {review.reply_status === 'none' && !isStreaming ? (
                <div className="px-5 pb-5">
                    <button
                        onClick={() => onGenerate(review.id)}
                        disabled={!!streamingId}
                        className="group w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all duration-200 disabled:opacity-40 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4 group-hover:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate AI Draft
                    </button>
                </div>
            ) : hasDraft ? (
                <div className="border-t border-gray-100">
                    <div className={`border-l-[3px] ${borderAccent}`}>
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    {isStreaming ? (
                                        <>
                                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" /></span>
                                            Generating...
                                        </>
                                    ) : review.reply_status === 'posted' ? (
                                        <><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Posted Reply</>
                                    ) : review.reply_status === 'dismissed' ? (
                                        'Dismissed'
                                    ) : (
                                        <><svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>AI Draft</>
                                    )}
                                </span>
                            </div>
                            <textarea
                                className={`w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3.5 resize-y min-h-[80px] focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white outline-none transition-all ${isStreaming ? 'border-teal-200 bg-teal-50/30' : ''}`}
                                value={displayText}
                                onChange={e => onEditChange(review.id, e.target.value)}
                                readOnly={isStreaming}
                                placeholder={isStreaming ? '' : 'Draft text...'}
                            />
                            {!isStreaming && (
                                <div className="flex justify-between items-center mt-3">
                                    {tab === 'inbox' && (
                                        <button onClick={() => onDismiss(review.id)}
                                            className="text-xs text-gray-400 hover:text-red-500 font-medium transition-all duration-200 cursor-pointer flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Dismiss
                                        </button>
                                    )}
                                    {tab === 'history' && <div />}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onGenerate(review.id, displayText, 'regenerate')}
                                            disabled={!!streamingId}
                                            className="text-xs text-gray-500 hover:text-teal-600 font-medium px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-all duration-200 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Regenerate
                                        </button>
                                        {review.reply_status !== 'posted' ? (
                                            <button
                                                onClick={() => onPublish(review.id)}
                                                disabled={!!publishingId || !canPost}
                                                className="text-xs px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:shadow-md hover:shadow-teal-200/60 disabled:opacity-40 font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                                            >
                                                {publishingId === review.id ? (
                                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Posting...</>
                                                ) : (
                                                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Post Reply</>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onPublish(review.id)}
                                                disabled={!!publishingId || !canPost}
                                                className="text-xs px-4 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-40 font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                                            >
                                                {publishingId === review.id ? (
                                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</>
                                                ) : (
                                                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Update Reply</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN VIEW
   ═══════════════════════════════════════════════════════════════ */

export default function ReviewsView({ mode, entityId, title, subtitle, reviewsManaged, reviewsMax }: ReviewsViewProps) {
    const router = useRouter()
    const params = useParams()
    const teamId = params?.teamId as string | undefined
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'inbox' | 'history'>('inbox')
    const [sortBy, setSortBy] = useState<SortBy>('newest')
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [stackIndex, setStackIndex] = useState(0)

    const [edits, setEdits] = useState<Record<string, string>>({})
    const [isSyncing, setIsSyncing] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [streamingId, setStreamingId] = useState<string | null>(null)
    const [streamingText, setStreamingText] = useState<Record<string, string>>({})
    const [publishingId, setPublishingId] = useState<string | null>(null)
    const [fadingOut, setFadingOut] = useState<string | null>(null)

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [isGbpHelpOpen, setIsGbpHelpOpen] = useState(false)

    // Team-mode: per-location permissions; Location-mode: single boolean
    const [manageableLocationIds, setManageableLocationIds] = useState<Set<string>>(new Set())
    const [canPostReplies, setCanPostReplies] = useState<boolean | null>(null)

    const canPost = (review: Review) => {
        if (mode === 'team') return manageableLocationIds.has(review.location_id || '')
        return canPostReplies !== false
    }

    useEffect(() => { loadReviews() }, [entityId])

    const loadReviews = async () => {
        setLoading(true)
        try {
            if (mode === 'team') {
                const data = await apiGet<{ reviews: Review[]; manageableLocationIds: string[] }>(`/api/teams/${entityId}/reviews?limit=1000`)
                setReviews(data.reviews)
                setManageableLocationIds(new Set(data.manageableLocationIds || []))
            } else {
                const data = await apiGet<{ reviews: Review[]; canPostReplies: boolean }>(`/api/locations/${entityId}/reviews?limit=1000`)
                setReviews(data.reviews)
                setCanPostReplies(data.canPostReplies)
            }
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const filteredReviews = useMemo(() => {
        return reviews
            .filter(r => {
                if (!r) return false
                if (tab === 'inbox') return r.reply_status === 'none' || r.reply_status === 'draft'
                return r.reply_status === 'posted' || r.reply_status === 'dismissed'
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'oldest': return new Date(a.review_date).getTime() - new Date(b.review_date).getTime()
                    case 'highest': return b.rating - a.rating || new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                    case 'lowest': return a.rating - b.rating || new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                    default: return new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                }
            })
    }, [reviews, tab, sortBy])

    const inboxCount = reviews.filter(r => r.reply_status === 'none' || r.reply_status === 'draft').length
    const historyCount = reviews.filter(r => r.reply_status === 'posted' || r.reply_status === 'dismissed').length

    const currentFocusReview = filteredReviews[stackIndex]

    // Auto-generate draft when entering focus mode on a 'none' review
    useEffect(() => {
        if (viewMode === 'focus' && currentFocusReview && currentFocusReview.reply_status === 'none' && !streamingId) {
            handleGenerate(currentFocusReview.id)
        }
    }, [viewMode, currentFocusReview?.id, streamingId])

    // ─── Handlers ─────────────────────────────────────────────

    const handleGenerate = useCallback(async (reviewId: string, previousDraft?: string, genMode: 'generate' | 'regenerate' = 'generate') => {
        if (streamingId) return
        setStreamingId(reviewId)
        setStreamingText(prev => ({ ...prev, [reviewId]: '' }))
        setEdits(prev => { const n = { ...prev }; delete n[reviewId]; return n })
        try {
            await streamDraft(reviewId, {
                previousDraft, mode: genMode,
                onDelta: delta => setStreamingText(prev => ({ ...prev, [reviewId]: (prev[reviewId] || '') + delta })),
                onDone: updatedReview => { setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...updatedReview } : r)); setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n }); setStreamingId(null) },
                onError: err => { setToast({ message: err, type: 'error' }); setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n }); setStreamingId(null) },
            })
        } catch (err: any) { setToast({ message: err.message || 'Failed to generate draft', type: 'error' }); setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n }); setStreamingId(null) }
    }, [streamingId])

    const handleSync = async () => {
        try {
            setIsSyncing(true)
            if (mode === 'team') {
                const res = await apiPost<{ locationsSynced: number }>(`/api/teams/${entityId}/reviews/sync`, {})
                setToast({ message: `Synced reviews for ${res.locationsSynced} locations!`, type: 'success' })
            } else {
                await apiPost(`/api/locations/${entityId}/reviews/sync`, { page_size: 50 })
                setToast({ message: 'Sync complete!', type: 'success' })
            }
            await loadReviews()
        } catch { setToast({ message: 'Sync failed', type: 'error' }) }
        finally { setIsSyncing(false) }
    }

    const handleBulkGenerate = async () => {
        try {
            setIsGenerating(true)
            const endpoint = mode === 'team' ? `/api/teams/${entityId}/reviews/bulk-generate` : `/api/locations/${entityId}/reviews/bulk-generate`
            const limit = mode === 'team' ? 50 : 20
            const res = await apiPost<{ generated: number }>(endpoint, { limit })
            setToast({ message: `Generated ${res.generated} drafts!`, type: 'success' })
            await loadReviews()
        } catch { setToast({ message: 'Generation failed', type: 'error' }) }
        finally { setIsGenerating(false) }
    }

    const handleBulkPublish = async () => {
        if (!confirm(mode === 'team' ? 'Publish all approved drafts for ALL locations?' : 'Publish all approved drafts?')) return
        const prev = [...reviews]
        try {
            setIsPublishing(true)
            setReviews(r => r.map(x => x.reply_status === 'draft' ? { ...x, reply_status: 'posted' as const, reply_text: x.draft_text } : x))
            const endpoint = mode === 'team' ? `/api/teams/${entityId}/reviews/bulk-publish` : `/api/locations/${entityId}/reviews/bulk-publish`
            const res = await apiPost<{ published: number }>(endpoint, {})
            setToast({ message: `Published ${res.published} replies!`, type: 'success' })
            await loadReviews()
        } catch { setReviews(prev); setToast({ message: 'Publishing failed', type: 'error' }) }
        finally { setIsPublishing(false) }
    }

    const handlePublish = async (reviewId: string, overrideText?: string) => {
        if (publishingId) return
        const prevReviews = [...reviews]; const prevEdits = { ...edits }
        const review = reviews.find(r => r.id === reviewId)
        const text = overrideText || edits[reviewId] || review?.draft_text || ''
        try {
            setPublishingId(reviewId); setFadingOut(reviewId)
            setReviews(r => r.map(x => x.id === reviewId ? { ...x, reply_status: 'posted' as const, reply_text: text } : x))
            setEdits(prev => { const n = { ...prev }; delete n[reviewId]; return n })
            const res = await apiPost<{ review: Review }>(`/api/reviews/${reviewId}/publish`, { reply_text: edits[reviewId] || undefined })
            if (res.review) { setToast({ message: 'Reply posted!', type: 'success' }); setReviews(r => r.map(x => x.id === reviewId ? { ...x, ...res.review } : x)) }
        } catch { setReviews(prevReviews); setEdits(prevEdits); setToast({ message: 'Failed to publish', type: 'error' }) }
        finally { setPublishingId(null); setTimeout(() => setFadingOut(null), 400) }
    }

    const handleDismiss = async (reviewId: string) => {
        const prev = [...reviews]
        try {
            setFadingOut(reviewId)
            setReviews(r => r.map(x => x.id === reviewId ? { ...x, reply_status: 'dismissed' as const } : x))
            await apiPatch(`/api/reviews/${reviewId}`, { reply_status: 'dismissed' })
            setToast({ message: 'Review dismissed', type: 'success' })
        } catch { setReviews(prev); setToast({ message: 'Failed to dismiss', type: 'error' }) }
        finally { setTimeout(() => setFadingOut(null), 400) }
    }

    const handleFocusSkip = useCallback(() => {
        setStackIndex(prev => Math.min(prev + 1, filteredReviews.length))
    }, [filteredReviews.length])

    const handleFocusPublish = useCallback(async (reviewId: string) => {
        await handlePublish(reviewId, edits[reviewId])
        setStackIndex(prev => Math.min(prev, filteredReviews.length - 1))
    }, [edits, filteredReviews.length, handlePublish])

    const handleFocusDismiss = useCallback(async (reviewId: string) => {
        await handleDismiss(reviewId)
        setStackIndex(prev => Math.min(prev, filteredReviews.length - 1))
    }, [filteredReviews.length, handleDismiss])

    const getDisplayText = (review: Review): string => {
        if (streamingText[review.id] !== undefined) return streamingText[review.id]
        return edits[review.id] ?? review.draft_text ?? review.reply_text ?? ''
    }

    const bulkDisabled = mode === 'location' && canPostReplies === false

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="p-8 h-screen flex flex-col">

                {/* Read-only banner */}
                {mode === 'location' && canPostReplies === false && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <svg className="w-4.5 h-4.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <p className="text-sm text-amber-800"><strong>Read-only access.</strong> You can view reviews and generate drafts, but you don&apos;t have permission to post replies.</p>
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>
                        <button
                            onClick={() => setIsGbpHelpOpen(true)}
                            className="text-xs text-gray-400 hover:text-teal-600 font-medium transition-colors cursor-pointer flex items-center gap-1 mt-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Not seeing your reviews?
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSync} disabled={isSyncing || bulkDisabled}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-40 transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-2 hover:shadow-sm">
                            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            {isSyncing ? 'Syncing...' : 'Sync Reviews'}
                        </button>
                        <button onClick={handleBulkGenerate} disabled={isGenerating}
                            className="px-4 py-2 text-sm bg-teal-50 text-teal-700 border border-teal-100 rounded-xl hover:bg-teal-100 disabled:opacity-40 font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            {isGenerating ? 'Generating...' : 'Auto-Generate'}
                        </button>
                        <button onClick={handleBulkPublish} disabled={isPublishing || bulkDisabled}
                            className="px-4 py-2 text-sm bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl hover:shadow-lg hover:shadow-teal-200/60 disabled:opacity-40 font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            {isPublishing ? 'Publishing...' : 'Post All Drafts'}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {!loading && reviews.length > 0 && <StatsBar reviews={reviews} reviewsManaged={reviewsManaged} reviewsMax={reviewsMax} />}

                {/* Tabs + Controls */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => { setTab('inbox'); setStackIndex(0) }}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-2 ${tab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                Inbox
                                {inboxCount > 0 && <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{inboxCount}</span>}
                            </button>
                            <button onClick={() => { setTab('history'); setViewMode('list') }}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-2 ${tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                History
                                {historyCount > 0 && <span className="bg-gray-200 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full">{historyCount}</span>}
                            </button>
                        </div>

                        {tab === 'inbox' && (
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => setViewMode('list')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    List
                                </button>
                                <button onClick={() => { setViewMode('focus'); setStackIndex(0) }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${viewMode === 'focus' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    Focus
                                </button>
                            </div>
                        )}
                    </div>
                    {(viewMode === 'list' || tab === 'history') && (
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="highest">Highest rating</option>
                                <option value="lowest">Lowest rating</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {loading ? (
                        <SkeletonCards />
                    ) : tab === 'inbox' && viewMode === 'focus' ? (
                        <FocusView
                            reviews={filteredReviews}
                            stackIndex={stackIndex}
                            streamingId={streamingId}
                            streamingText={streamingText}
                            edits={edits}
                            publishingId={publishingId}
                            canPost={canPost}
                            showLocation={mode === 'team'}
                            onGenerate={handleGenerate}
                            onPublish={handleFocusPublish}
                            onDismiss={handleFocusDismiss}
                            onEditChange={(id, text) => setEdits(prev => ({ ...prev, [id]: text }))}
                            onSkip={handleFocusSkip}
                            onBack={() => setViewMode('list')}
                            onLocationClick={id => teamId ? router.push(`/teams/${teamId}/reviews?location=${id}`) : router.push(`/locations/${id}/reviews`)}
                        />
                    ) : filteredReviews.length === 0 ? (
                        tab === 'inbox' ? <EmptyInbox /> : <EmptyHistory />
                    ) : (
                        <div className="space-y-3 pb-4">
                            {filteredReviews.map(review => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    tab={tab}
                                    displayText={getDisplayText(review)}
                                    isStreaming={streamingId === review.id}
                                    canPost={canPost(review)}
                                    fadingOut={fadingOut === review.id}
                                    publishingId={publishingId}
                                    streamingId={streamingId}
                                    onGenerate={handleGenerate}
                                    onPublish={(id) => handlePublish(id, edits[id])}
                                    onDismiss={handleDismiss}
                                    onEditChange={(id, text) => setEdits(prev => ({ ...prev, [id]: text }))}
                                    showLocation={mode === 'team'}
                                    onLocationClick={id => teamId ? router.push(`/teams/${teamId}/reviews?location=${id}`) : router.push(`/locations/${id}/reviews`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <GbpPermissionsModal isOpen={isGbpHelpOpen} onClose={() => setIsGbpHelpOpen(false)} />
        </>
    )
}

/* ─── Helpers ─── */

function getTimeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return date.toLocaleDateString()
}
