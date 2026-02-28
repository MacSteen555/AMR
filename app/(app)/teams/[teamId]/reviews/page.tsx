'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch, streamDraft } from '@/lib/api'
import { Toast } from '@/components/Toast'

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

export default function TeamReviewsPage() {
    const { teamId } = useParams() as { teamId: string }
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'list' | 'stack'>('list')
    const [tab, setTab] = useState<'inbox' | 'history'>('inbox')
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')

    const [edits, setEdits] = useState<Record<string, string>>({})

    const [isSyncing, setIsSyncing] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [streamingId, setStreamingId] = useState<string | null>(null)
    const [streamingText, setStreamingText] = useState<Record<string, string>>({})
    const [publishingId, setPublishingId] = useState<string | null>(null)

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [manageableLocationIds, setManageableLocationIds] = useState<Set<string>>(new Set())
    const [stackIndex, setStackIndex] = useState(0)
    const [fadingOut, setFadingOut] = useState<string | null>(null)
    const router = useRouter()

    const canPostFor = (review: Review) => manageableLocationIds.has(review.location_id || '')

    useEffect(() => { loadReviews() }, [teamId])

    const loadReviews = async () => {
        setLoading(true)
        try {
            const { reviews: data, manageableLocationIds: ids } = await apiGet<{ reviews: Review[]; manageableLocationIds: string[] }>(`/api/teams/${teamId}/reviews?limit=1000`)
            setReviews(data)
            setManageableLocationIds(new Set(ids || []))
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const filteredReviews = reviews
        .filter(r => {
            if (!r) return false
            if (tab === 'inbox') return r.reply_status === 'none' || r.reply_status === 'draft'
            if (tab === 'history') return r.reply_status === 'posted' || r.reply_status === 'dismissed'
            return false
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'oldest': return new Date(a.review_date).getTime() - new Date(b.review_date).getTime()
                case 'highest': return b.rating - a.rating || new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                case 'lowest': return a.rating - b.rating || new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                default: return new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
            }
        })

    const currentStackReview = filteredReviews[stackIndex]

    useEffect(() => {
        if (viewMode === 'stack' && currentStackReview && currentStackReview.reply_status === 'none' && !streamingId) {
            handleGenerate(currentStackReview.id)
        }
    }, [viewMode, currentStackReview?.id, streamingId])

    // ─── Streaming Generate ──────────────────────────────────────────────

    const handleGenerate = useCallback(async (reviewId: string, previousDraft?: string, mode: 'generate' | 'regenerate' = 'generate') => {
        if (streamingId) return
        setStreamingId(reviewId)
        setStreamingText(prev => ({ ...prev, [reviewId]: '' }))
        setEdits(prev => { const n = { ...prev }; delete n[reviewId]; return n })

        try {
            await streamDraft(reviewId, {
                previousDraft,
                mode,
                onDelta: (delta) => {
                    setStreamingText(prev => ({ ...prev, [reviewId]: (prev[reviewId] || '') + delta }))
                },
                onDone: (updatedReview) => {
                    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...updatedReview } : r))
                    setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n })
                    setStreamingId(null)
                },
                onError: (err) => {
                    setToast({ message: err, type: 'error' })
                    setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n })
                    setStreamingId(null)
                },
            })
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to generate draft', type: 'error' })
            setStreamingText(prev => { const n = { ...prev }; delete n[reviewId]; return n })
            setStreamingId(null)
        }
    }, [streamingId])

    // ─── Other Handlers ──────────────────────────────────────────────────

    const handleSync = async () => {
        try {
            setIsSyncing(true)
            const res = await apiPost<{ locationsSynced: number }>(`/api/teams/${teamId}/reviews/sync`, {})
            setToast({ message: `Synced reviews for ${res.locationsSynced} locations!`, type: 'success' })
            await loadReviews()
        } catch { setToast({ message: 'Sync failed', type: 'error' }) }
        finally { setIsSyncing(false) }
    }

    const handleBulkGenerate = async () => {
        try {
            setIsGenerating(true)
            const res = await apiPost<{ generated: number }>(`/api/teams/${teamId}/reviews/bulk-generate`, { limit: 50 })
            setToast({ message: `Generated ${res.generated} drafts!`, type: 'success' })
            await loadReviews()
        } catch { setToast({ message: 'Generation failed', type: 'error' }) }
        finally { setIsGenerating(false) }
    }

    const handleBulkPublish = async () => {
        if (!confirm('Publish all approved drafts for ALL locations?')) return
        const prev = [...reviews]
        try {
            setIsPublishing(true)
            setReviews(r => r.map(x => x.reply_status === 'draft' ? { ...x, reply_status: 'posted' as const, reply_text: x.draft_text } : x))
            const res = await apiPost<{ published: number }>(`/api/teams/${teamId}/reviews/bulk-publish`, {})
            setToast({ message: `Published ${res.published} replies!`, type: 'success' })
            await loadReviews()
        } catch { setReviews(prev); setToast({ message: 'Publishing failed', type: 'error' }) }
        finally { setIsPublishing(false) }
    }

    const handlePublish = async (reviewId: string, overrideText?: string) => {
        if (publishingId) return
        const prevReviews = [...reviews]
        const prevEdits = { ...edits }
        const review = reviews.find(r => r.id === reviewId)
        const text = overrideText || review?.draft_text || ''
        try {
            setPublishingId(reviewId)
            setFadingOut(reviewId)
            setReviews(r => r.map(x => x.id === reviewId ? { ...x, reply_status: 'posted' as const, reply_text: text } : x))
            setEdits(prev => { const n = { ...prev }; delete n[reviewId]; return n })
            const res = await apiPost<{ review: Review }>(`/api/reviews/${reviewId}/publish`, { reply_text: overrideText })
            if (res.review) {
                setToast({ message: 'Reply posted!', type: 'success' })
                setReviews(r => r.map(x => x.id === reviewId ? { ...x, ...res.review } : x))
            }
        } catch {
            setReviews(prevReviews); setEdits(prevEdits)
            setToast({ message: 'Failed to publish', type: 'error' })
        } finally {
            setPublishingId(null)
            setTimeout(() => setFadingOut(null), 400)
        }
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

    const handleSwipe = async (action: 'post' | 'skip' | 'dismiss') => {
        if (!currentStackReview) return
        if (action === 'post') {
            await handlePublish(currentStackReview.id, edits[currentStackReview.id])
            setStackIndex(prev => Math.min(prev, filteredReviews.length - 1))
        } else if (action === 'skip') {
            setStackIndex(prev => prev + 1)
        } else {
            await handleDismiss(currentStackReview.id)
            setStackIndex(prev => Math.min(prev, filteredReviews.length - 1))
        }
    }

    const getDisplayText = (review: Review): string => {
        if (streamingText[review.id] !== undefined) return streamingText[review.id]
        return edits[review.id] ?? review.draft_text ?? review.reply_text ?? ''
    }

    const isStreaming = (reviewId: string) => streamingId === reviewId

    const inboxCount = reviews.filter(r => r.reply_status === 'none' || r.reply_status === 'draft').length
    const historyCount = reviews.filter(r => r.reply_status === 'posted' || r.reply_status === 'dismissed').length

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="p-8 h-screen flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Team Reviews</h1>
                        <p className="text-gray-500 mt-0.5">Manage feedback across all your locations.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSync} disabled={isSyncing}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-40 transition-colors">
                            {isSyncing ? 'Syncing...' : 'Sync All'}
                        </button>
                        <button onClick={handleBulkGenerate} disabled={isGenerating}
                            className="px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-40 font-medium transition-colors">
                            {isGenerating ? 'Generating...' : 'Auto-Generate'}
                        </button>
                        <button onClick={handleBulkPublish} disabled={isPublishing}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 font-medium transition-colors">
                            {isPublishing ? 'Publishing...' : 'Post All Drafts'}
                        </button>
                    </div>
                </div>

                {/* Tabs & Controls */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-1">
                    <div className="flex gap-6">
                        <button onClick={() => { setTab('inbox'); setStackIndex(0) }}
                            className={`pb-3 px-1 font-medium border-b-2 transition-colors text-sm ${tab === 'inbox' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            Inbox ({inboxCount})
                        </button>
                        <button onClick={() => setTab('history')}
                            className={`pb-3 px-1 font-medium border-b-2 transition-colors text-sm ${tab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            History ({historyCount})
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="highest">Highest rating</option>
                            <option value="lowest">Lowest rating</option>
                        </select>
                        {tab === 'inbox' && (
                            <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                <button onClick={() => setViewMode('list')}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                                    List
                                </button>
                                <button onClick={() => setViewMode('stack')}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'stack' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                                    Focus
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <SkeletonCards />
                    ) : filteredReviews.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500">{tab === 'inbox' ? 'All caught up! No reviews need attention.' : 'No reply history yet.'}</p>
                        </div>
                    ) : (viewMode === 'list' || tab === 'history') ? (
                        <div className="space-y-3">
                            {filteredReviews.map(review => (
                                <div key={review.id}
                                    className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md ${fadingOut === review.id ? 'opacity-30 scale-[0.98]' : 'opacity-100'}`}>
                                    {/* Review Header */}
                                    <div className="px-5 pt-5 pb-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                                                    {review.reviewer_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</span>
                                                        <div className="flex text-yellow-400 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-xs text-gray-400">{new Date(review.review_date).toLocaleDateString()}</span>
                                                        <span className="text-xs text-gray-300">·</span>
                                                        <span className="text-xs text-indigo-500 font-medium cursor-pointer hover:underline"
                                                            onClick={() => router.push(`/locations/${review.location_id}/reviews`)}>
                                                            {review.location_name}
                                                        </span>
                                                        {!canPostFor(review) && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Read-only</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {tab === 'inbox' && review.reply_status !== 'dismissed' && (
                                                    <button onClick={() => handleDismiss(review.id)}
                                                        className="text-gray-300 hover:text-red-400 transition-colors" title="Dismiss review">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                                <StatusBadge status={review.reply_status} />
                                            </div>
                                        </div>
                                        <p className="text-gray-600 text-sm mt-3 leading-relaxed">{review.comment || '(No comment)'}</p>
                                    </div>

                                    {/* Draft / Reply Area */}
                                    {review.reply_status === 'none' && !isStreaming(review.id) ? (
                                        <div className="px-5 pb-5">
                                            <button onClick={() => handleGenerate(review.id)}
                                                disabled={!!streamingId}
                                                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all disabled:opacity-40">
                                                Generate AI Draft
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="border-t border-gray-100">
                                            <div className={`border-l-[3px] ${review.reply_status === 'posted' ? 'border-l-green-400' : 'border-l-indigo-400'}`}>
                                                <div className="px-5 py-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                            {isStreaming(review.id) ? 'Generating...' : review.reply_status === 'posted' ? 'Posted Reply' : review.reply_status === 'dismissed' ? 'Dismissed' : 'AI Draft'}
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        className={`w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-y min-h-[80px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isStreaming(review.id) ? 'animate-pulse' : ''}`}
                                                        value={getDisplayText(review)}
                                                        onChange={e => setEdits(prev => ({ ...prev, [review.id]: e.target.value }))}
                                                        readOnly={isStreaming(review.id)}
                                                        placeholder={isStreaming(review.id) ? '' : 'Draft text...'}
                                                    />
                                                    {!isStreaming(review.id) && (
                                                        <div className="flex justify-between items-center mt-2">
                                                            <button onClick={() => handleDismiss(review.id)}
                                                                className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors">
                                                                Dismiss
                                                            </button>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleGenerate(review.id, getDisplayText(review), 'regenerate')}
                                                                    disabled={!!streamingId}
                                                                    className="text-xs text-gray-500 hover:text-indigo-600 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-all disabled:opacity-40">
                                                                    Regenerate
                                                                </button>
                                                                {review.reply_status !== 'posted' ? (
                                                                    <button onClick={() => handlePublish(review.id, edits[review.id])}
                                                                        disabled={!!publishingId || !canPostFor(review)}
                                                                        className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 font-medium transition-colors">
                                                                        {publishingId === review.id ? 'Posting...' : 'Post Reply'}
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => handlePublish(review.id, edits[review.id])}
                                                                        disabled={!!publishingId || !canPostFor(review)}
                                                                        className="text-xs px-3 py-1 rounded-md bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-40 font-medium transition-colors">
                                                                        {publishingId === review.id ? 'Updating...' : 'Update Reply'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Stack / Focus View */
                        <div className="min-h-full flex flex-col items-center py-8">
                            {currentStackReview ? (
                                <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-200 transition-all duration-300">
                                    <div className="p-8">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-600">
                                                    {currentStackReview.reviewer_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900">{currentStackReview.reviewer_name}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="flex text-yellow-400 text-lg">{'★'.repeat(currentStackReview.rating)}{'☆'.repeat(5 - currentStackReview.rating)}</div>
                                                        <span className="text-xs text-gray-400">{new Date(currentStackReview.review_date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                                {currentStackReview.location_name}
                                            </span>
                                        </div>
                                        <p className="text-gray-700 text-lg leading-relaxed mb-8">
                                            {currentStackReview.comment || '(No comment)'}
                                        </p>

                                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6 min-h-[180px] flex flex-col">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                    {isStreaming(currentStackReview.id) ? 'Generating...' : 'Proposed Reply'}
                                                </span>
                                                {currentStackReview.reply_status === 'draft' && !isStreaming(currentStackReview.id) && (
                                                    <button onClick={() => handleGenerate(currentStackReview.id, getDisplayText(currentStackReview), 'regenerate')}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                                        Regenerate
                                                    </button>
                                                )}
                                            </div>
                                            {(currentStackReview.reply_status === 'draft' || isStreaming(currentStackReview.id)) ? (
                                                <textarea
                                                    className="flex-1 w-full bg-white p-4 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                                    rows={5}
                                                    value={getDisplayText(currentStackReview)}
                                                    onChange={e => setEdits(prev => ({ ...prev, [currentStackReview.id]: e.target.value }))}
                                                    readOnly={isStreaming(currentStackReview.id)}
                                                />
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center">
                                                    <div className="text-center py-4">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                                        <p className="text-sm text-gray-400">Generating draft...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button onClick={() => handleSwipe('dismiss')}
                                                className="flex-1 py-3.5 border border-gray-200 text-gray-500 rounded-xl font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
                                                Dismiss
                                            </button>
                                            <button onClick={() => handleSwipe('skip')}
                                                className="flex-1 py-3.5 border border-gray-200 rounded-xl text-gray-500 font-semibold hover:bg-gray-100 transition-all">
                                                Skip
                                            </button>
                                            <button onClick={() => handleSwipe('post')}
                                                disabled={currentStackReview.reply_status !== 'draft' || !!publishingId || !canPostFor(currentStackReview)}
                                                className="flex-1 py-3.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200">
                                                {publishingId === currentStackReview.id ? 'Posting...' : 'Post Reply'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-8 py-3 border-t border-gray-100 text-center text-xs text-gray-400 rounded-b-2xl">
                                        {stackIndex + 1} of {filteredReviews.length} reviews
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="text-5xl mb-4">🎉</div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">All caught up!</h2>
                                    <button onClick={() => setViewMode('list')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                                        Back to List
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Draft' },
        posted: { bg: 'bg-green-50', text: 'text-green-600', label: 'Replied' },
        dismissed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Dismissed' },
        none: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Needs Reply' },
    }
    const c = config[status] || config.none
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    )
}

function SkeletonCards() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 bg-gray-200 rounded-full" />
                        <div>
                            <div className="h-3.5 bg-gray-200 rounded w-28 mb-1.5" />
                            <div className="h-2.5 bg-gray-100 rounded w-20" />
                        </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
            ))}
        </div>
    )
}
