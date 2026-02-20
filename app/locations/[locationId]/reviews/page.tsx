'use client'

import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/AppShell'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { Toast } from '@/components/Toast'

interface Review {
    id: string
    google_review_id: string
    reviewer_name: string
    rating: number
    comment: string
    review_date: string
    reply_status: 'none' | 'draft' | 'replied_external' | 'dismissed'
    draft_text?: string
    reply_text?: string
    location_name?: string
    location_id?: string
}

export default function LocationReviewsPage() {
    const { locationId } = useParams() as { locationId: string }
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'list' | 'stack'>('list')
    const [tab, setTab] = useState<'inbox' | 'history'>('inbox')

    // Local State for Edits (Map<ReviewId, EditedText>)
    const [edits, setEdits] = useState<Record<string, string>>({})

    // Actions
    const [isSyncing, setIsSyncing] = useState(false)
    const [isBatchGenerating, setIsBatchGenerating] = useState(false)
    const [isBatchPublishing, setIsBatchPublishing] = useState(false)
    const [generatingId, setGeneratingId] = useState<string | null>(null)
    const [publishingId, setPublishingId] = useState<string | null>(null)

    // Feedback
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

    // Stack Mode
    const [stackIndex, setStackIndex] = useState(0)

    useEffect(() => {
        loadReviews()
    }, [locationId])

    const loadReviews = async () => {
        setLoading(true)
        try {
            const { reviews: data } = await apiGet<{ reviews: Review[] }>(`/api/locations/${locationId}/reviews?limit=100`)
            setReviews(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        try {
            setIsSyncing(true)
            await apiPost(`/api/locations/${locationId}/reviews/sync`, { page_size: 50 })
            setToast({ message: 'Sync complete!', type: 'success' })
            await loadReviews()
        } catch (err) {
            setToast({ message: 'Sync failed', type: 'error' })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleBulkGenerate = async () => {
        try {
            setIsBatchGenerating(true)
            const res = await apiPost<{ generated: number }>(`/api/locations/${locationId}/reviews/bulk-generate`, { limit: 20 })
            setToast({ message: `Generated ${res.generated} drafts!`, type: 'success' })
            await loadReviews()
        } catch (err) {
            setToast({ message: 'Generation failed', type: 'error' })
        } finally {
            setIsBatchGenerating(false)
        }
    }

    const handleBulkPublish = async () => {
        if (!confirm('Publish all approved drafts?')) return

        const previousReviews = [...reviews]

        try {
            setIsBatchPublishing(true)

            // Optimistic Update
            setReviews(prev => prev.map(r =>
                r.reply_status === 'draft'
                    ? { ...r, reply_status: 'replied_external', reply_text: r.draft_text }
                    : r
            ))
            setToast({ message: 'Publishing drafts...', type: 'success' })

            const res = await apiPost<{ published: number }>(`/api/locations/${locationId}/reviews/bulk-publish`, {})
            setToast({ message: `Published ${res.published} replies!`, type: 'success' })
            await loadReviews()
        } catch (err) {
            setReviews(previousReviews)
            setToast({ message: 'Publishing failed', type: 'error' })
        } finally {
            setIsBatchPublishing(false)
        }
    }

    const handleGenerateSingle = async (reviewId: string, previousDraft?: string) => {
        if (generatingId) return
        try {
            setGeneratingId(reviewId)

            // Clear existing for this ID
            setEdits(prev => ({ ...prev, [reviewId]: '' }))

            const res = await apiPost<{ review: Review }>(`/api/reviews/${reviewId}/generate`, {
                previous_draft: previousDraft
            })

            if (res.review) {
                // Merge to preserve location_name and other client-side props
                setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...res.review } : r))

                // Clear edits so the displayed value falls back to the new draft_text
                setEdits(prev => {
                    const next = { ...prev }
                    delete next[reviewId]
                    return next
                })
            }

        } catch (err) {
            console.error('Failed to generate draft', err)
            setToast({ message: 'Failed to generate draft', type: 'error' })
        } finally {
            setGeneratingId(null)
        }
    }

    const handlePublishSingle = async (reviewId: string) => {
        if (publishingId) return

        // 1. Optimistic Updates
        const previousReviews = [...reviews]
        const previousEdits = { ...edits }

        const review = reviews.find(r => r.id === reviewId)
        const textToPublish = edits[reviewId] ?? review?.draft_text

        try {
            setPublishingId(reviewId)

            // Optimistically update
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply_status: 'replied_external', reply_text: textToPublish } : r))

            // Clear edits locally
            setEdits(prev => {
                const next = { ...prev }
                delete next[reviewId]
                return next
            })

            // Feedback
            setToast({ message: 'Posting reply...', type: 'success' })

            // If in stack mode, move next immediately
            if (viewMode === 'stack') {
                setStackIndex(prev => prev)
            }

            const res = await apiPost<{ review: Review }>(`/api/reviews/${reviewId}/publish`, {
                reply_text: textToPublish
            })

            if (res.review) {
                setToast({ message: 'Reply posted successfully!', type: 'success' })
                setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...res.review } : r))
            }
        } catch (err) {
            console.error(err)
            // Revert on failure
            setReviews(previousReviews)
            setEdits(previousEdits)
            setToast({ message: 'Failed to publish', type: 'error' })
        } finally {
            setPublishingId(null)
        }
    }

    const handleIgnoreSingle = async (reviewId: string) => {
        // Optimistic
        const previousReviews = [...reviews]

        try {
            // Optimistically update
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply_status: 'dismissed' } : r))
            setToast({ message: 'Ignoring review...', type: 'success' })

            if (viewMode === 'stack') {
                setStackIndex(prev => prev) // Move to next item
            }

            const res = await apiPatch<{ review: Review }>(`/api/reviews/${reviewId}`, {
                reply_status: 'dismissed'
            })
            if (res.review) {
                setToast({ message: 'Review ignored', type: 'success' })
                setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...res.review } : r))
            }
        } catch (err) {
            console.error(err)
            // Revert
            setReviews(previousReviews)
            setToast({ message: 'Failed to ignore review', type: 'error' })
        }
    }

    const filteredReviews = reviews.filter(r => {
        if (tab === 'inbox') return r.reply_status === 'none' || r.reply_status === 'draft'
        if (tab === 'history') return r.reply_status === 'replied_external' || r.reply_status === 'dismissed'
        return false
    })

    // Stack Mode Logic
    const currentStackReview = filteredReviews[stackIndex]

    return (
        <AppShell>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="p-8 h-screen flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
                        <p className="text-gray-600">Manage customer feedback for this location.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Reviews'}
                        </button>
                        <button
                            onClick={handleBulkGenerate}
                            disabled={isBatchGenerating}
                            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50"
                        >
                            {isBatchGenerating ? 'Generating...' : 'Auto-Generate Drafts'}
                        </button>
                        <button
                            onClick={handleBulkPublish}
                            disabled={isBatchPublishing}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isBatchPublishing ? 'Publishing...' : 'Post All Drafts'}
                        </button>
                    </div>
                </div>

                {/* Tabs & View Toggle */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-1">
                    <div className="flex gap-6">
                        <button
                            onClick={() => { setTab('inbox'); setStackIndex(0); }}
                            className={`pb-3 px-2 font-medium border-b-2 transition-colors ${tab === 'inbox' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Needs Attention ({reviews.filter(r => r.reply_status === 'none' || r.reply_status === 'draft').length})
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            className={`pb-3 px-2 font-medium border-b-2 transition-colors ${tab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            History ({reviews.filter(r => r.reply_status === 'replied_external' || r.reply_status === 'dismissed').length})
                        </button>
                    </div>
                    {tab === 'inbox' && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                            >
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('stack')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'stack' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                            >
                                Focus
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredReviews.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <p className="text-gray-500">No reviews found in this view.</p>
                        </div>
                    ) : (viewMode === 'list' || tab === 'history') ? (
                        <div className="space-y-4">
                            {filteredReviews.map(review => (
                                <div key={review.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="font-semibold text-gray-900">{review.reviewer_name}</div>
                                                <div className="flex text-yellow-400 text-sm">
                                                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(review.review_date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Generate Button in List View */}
                                            {review.reply_status === 'none' && !review.draft_text && (
                                                <>
                                                    <button
                                                        onClick={() => handleIgnoreSingle(review.id)}
                                                        className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                    >
                                                        Ignore
                                                    </button>
                                                    <button
                                                        onClick={() => handleGenerateSingle(review.id)}
                                                        disabled={generatingId === review.id}
                                                        className="px-3 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
                                                    >
                                                        {generatingId === review.id ? 'Drafting...' : 'Generate Draft'}
                                                    </button>
                                                </>
                                            )}

                                            <span className={`px-2 py-1 text-xs font-semibold rounded ${review.reply_status === 'draft' ? 'bg-purple-100 text-purple-700' :
                                                review.reply_status === 'replied_external' ? 'bg-green-100 text-green-700' :
                                                    review.reply_status === 'dismissed' ? 'bg-gray-100 text-gray-500' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {review.reply_status === 'replied_external' ? 'Replied' :
                                                    review.reply_status === 'draft' ? 'Draft Ready' :
                                                        review.reply_status === 'dismissed' ? 'Ignored' : 'Unreplied'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-gray-600 mb-4">{review.comment || '(No comment text)'}</p>

                                    {/* History View Content */}
                                    {tab === 'history' && (
                                        <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-xs font-semibold text-gray-700">
                                                    {review.reply_status === 'dismissed' ? 'Action Ignored' : 'Posted Reply'}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleGenerateSingle(review.id, edits[review.id] || review.reply_text || review.draft_text)}
                                                        disabled={generatingId === review.id}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                                                    >
                                                        {generatingId === review.id ? 'Regenerating...' : 'Regenerate'}
                                                    </button>
                                                    <button
                                                        onClick={() => handlePublishSingle(review.id)}
                                                        disabled={publishingId === review.id}
                                                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                                                    >
                                                        {publishingId === review.id ? 'Updating...' : 'Update'}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                className="w-full text-sm text-gray-800 bg-white border border-gray-200 focus:ring-1 focus:ring-indigo-300 rounded p-2 resize-y min-h-[80px]"
                                                value={edits[review.id] ?? (review.reply_text || review.draft_text || '')}
                                                onChange={(e) => setEdits(prev => ({ ...prev, [review.id]: e.target.value }))}
                                                placeholder="Reply text..."
                                            />
                                        </div>
                                    )}

                                    {/* Edit / Draft Area */}
                                    {tab === 'inbox' && (review.reply_status === 'none' || review.reply_status === 'draft') && (
                                        <div className="bg-purple-50 p-4 rounded-md border border-purple-100 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-xs font-semibold text-purple-700">AI Draft</div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleIgnoreSingle(review.id)}
                                                        className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1"
                                                    >
                                                        Ignore
                                                    </button>
                                                    <button
                                                        onClick={() => handleGenerateSingle(review.id, edits[review.id] || review.draft_text)}
                                                        disabled={generatingId === review.id}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                                                    >
                                                        {generatingId === review.id ? 'Regenerating...' : (review.draft_text ? 'Regenerate' : 'Generate Draft')}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                className="w-full text-sm text-gray-800 bg-transparent border-none focus:ring-1 focus:ring-purple-300 rounded p-1 resize-y min-h-[80px]"
                                                value={edits[review.id] ?? (review.draft_text || '')}
                                                onChange={(e) => setEdits(prev => ({ ...prev, [review.id]: e.target.value }))}
                                                placeholder="Draft text will appear here..."
                                            />
                                            <div className="mt-2 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handlePublishSingle(review.id)}
                                                    disabled={publishingId === review.id || (!review.draft_text && !edits[review.id])}
                                                    className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {publishingId === review.id ? 'Posting...' : 'Post Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Stack View
                        <div className="min-h-full flex flex-col items-center py-10">
                            {currentStackReview ? (
                                <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-gray-200">
                                    <div className="p-8">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl font-bold text-gray-600">
                                                    {currentStackReview.reviewer_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900">{currentStackReview.reviewer_name}</h3>
                                                    <div className="flex text-yellow-400 text-lg">
                                                        {'★'.repeat(currentStackReview.rating)}{'☆'.repeat(5 - currentStackReview.rating)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                                {currentStackReview.location_name}
                                            </div>
                                        </div>
                                        <p className="text-gray-700 text-lg mb-8 leading-relaxed">
                                            {currentStackReview.comment || "(No comment)"}
                                        </p>

                                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8 min-h-[200px] flex flex-col justify-center mb-6">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Proposed Reply</h4>
                                                {(currentStackReview.reply_status === 'draft' || currentStackReview.reply_status === 'none') && (
                                                    <button
                                                        onClick={() => handleGenerateSingle(currentStackReview.id, edits[currentStackReview.id] || currentStackReview.draft_text)}
                                                        disabled={generatingId === currentStackReview.id}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                    >
                                                        {generatingId === currentStackReview.id ? 'Regenerating...' : (currentStackReview.draft_text ? 'Regenerate' : 'Generate')}
                                                    </button>
                                                )}
                                            </div>
                                            {currentStackReview.reply_status === 'draft' ? (
                                                <textarea
                                                    className="w-full bg-white p-4 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    rows={6}
                                                    value={edits[currentStackReview.id] ?? (currentStackReview.draft_text || '')}
                                                    onChange={(e) => setEdits(prev => ({ ...prev, [currentStackReview.id]: e.target.value }))}
                                                />
                                            ) : generatingId === currentStackReview.id ? (
                                                <div className="text-center py-6">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                                    <p className="text-sm text-gray-500">Generating draft...</p>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-gray-500 italic">
                                                    Waiting to generate...
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => handleIgnoreSingle(currentStackReview.id)}
                                                className="flex-1 py-4 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                            >
                                                Ignore
                                            </button>
                                            <button
                                                onClick={() => setStackIndex(prev => prev + 1)}
                                                className="flex-1 py-4 border-2 border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                                            >
                                                Skip
                                            </button>
                                            {(!currentStackReview.draft_text && !edits[currentStackReview.id]) ? (
                                                <button
                                                    onClick={() => handleGenerateSingle(currentStackReview.id)}
                                                    disabled={generatingId === currentStackReview.id}
                                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-colors"
                                                >
                                                    Generate Draft
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handlePublishSingle(currentStackReview.id)}
                                                    disabled={publishingId === currentStackReview.id}
                                                    className="flex-1 py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {publishingId === currentStackReview.id ? 'Posting...' : 'Post Reply'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center text-sm text-gray-500">
                                        {stackIndex + 1} of {filteredReviews.length} reviews in queue
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🎉</div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all caught up!</h2>
                                    <p className="text-gray-500 mb-6">No more reviews needing attention in this list.</p>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        Back to List
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    )
}
