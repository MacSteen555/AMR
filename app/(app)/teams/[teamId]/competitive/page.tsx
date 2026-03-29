'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Toast } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompetitorMetrics {
    competitivePositionScore?: number
    marketMomentum?: number
    ownedAverageRating?: number
    competitorAverageRating?: number
    ratingGap?: number
    threatCount?: number
    opportunityCount?: number
}

interface Competitor {
    id: string
    name: string
    place_id: string
    address?: string
    rating?: number
    review_count?: number
    location_ids: string[]
    location_names: string[]
    latest_report_date: string | null
    metrics: CompetitorMetrics | null
}

interface Location { id: string; name: string }

interface PlaceResult {
    id: string
    displayName: string
    formattedAddress: string
    location: { latitude: number | null; longitude: number | null }
    rating: number | null
    userRatingCount: number | null
    websiteUri: string | null
    phoneNumber: string | null
    openingHours: any
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debouncedValue
}

// ─── Aggregate Metrics Strip ────────────────────────────────────────────────

function MetricCard({ label, value, suffix, color, icon }: {
    label: string; value: string; suffix?: string; color: string; icon: React.ReactNode
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <div>
                <div className="text-xs text-gray-400 font-medium">{label}</div>
                <div className="text-lg font-bold text-gray-900 leading-tight">
                    {value}{suffix && <span className="text-sm font-medium text-gray-400 ml-0.5">{suffix}</span>}
                </div>
            </div>
        </div>
    )
}

function AggregateMetrics({ competitors }: { competitors: Competitor[] }) {
    const withMetrics = competitors.filter(c => c.metrics)
    if (withMetrics.length === 0) return null

    const avgScore = Math.round(
        withMetrics.reduce((sum, c) => sum + (c.metrics!.competitivePositionScore || 50), 0) / withMetrics.length
    )
    const avgMomentum = (
        withMetrics.reduce((sum, c) => sum + (c.metrics!.marketMomentum || 0), 0) / withMetrics.length
    ).toFixed(1)
    const totalThreats = withMetrics.reduce((sum, c) => sum + (c.metrics!.threatCount || 0), 0)
    const totalOpportunities = withMetrics.reduce((sum, c) => sum + (c.metrics!.opportunityCount || 0), 0)
    const avgRatingGap = (
        withMetrics.reduce((sum, c) => sum + (c.metrics!.ratingGap || 0), 0) / withMetrics.length
    ).toFixed(2)

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            <MetricCard
                label="Avg Position Score"
                value={String(avgScore)}
                suffix="/100"
                color={avgScore >= 60 ? 'bg-emerald-50 text-emerald-600' : avgScore >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <MetricCard
                label="Market Momentum"
                value={Number(avgMomentum) > 0 ? `+${avgMomentum}` : avgMomentum}
                color={Number(avgMomentum) > 0 ? 'bg-emerald-50 text-emerald-600' : Number(avgMomentum) < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
            <MetricCard
                label="Rating Gap"
                value={Number(avgRatingGap) > 0 ? `+${avgRatingGap}` : avgRatingGap}
                color={Number(avgRatingGap) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
            />
            <MetricCard
                label="Active Threats"
                value={String(totalThreats)}
                color={totalThreats > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            />
            <MetricCard
                label="Opportunities"
                value={String(totalOpportunities)}
                color={totalOpportunities > 0 ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
        </div>
    )
}

// ─── Competitor Card ────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number | undefined }) {
    if (score == null) return null
    const color = score >= 60 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : score >= 40 ? 'bg-amber-50 text-amber-700 ring-amber-200'
            : 'bg-red-50 text-red-700 ring-red-200'
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${color}`}>
            {score}
        </span>
    )
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <svg key={star} className={star <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}
                    style={{ width: size, height: size }} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

function CompetitorCard({ competitor, onClick, onDelete }: {
    competitor: Competitor
    onClick: () => void
    onDelete: (e: React.MouseEvent) => void
}) {
    const reportDate = competitor.latest_report_date
        ? new Date(competitor.latest_report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null
    const m = competitor.metrics

    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100
                        transition-all duration-200 ease-out
                        hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/80
                        focus-within:ring-2 focus-within:ring-teal-500/30 overflow-hidden">
            {/* Clickable card body */}
            <div onClick={onClick} className="p-5 cursor-pointer">
                {/* Delete */}
                <div
                    role="button" tabIndex={0} onClick={onDelete}
                    onKeyDown={(e) => { if (e.key === 'Enter') onDelete(e as any) }}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-300 opacity-0 group-hover:opacity-100
                               hover:text-red-500 hover:bg-red-50 transition-all duration-150 cursor-pointer z-10"
                    title="Remove competitor"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>

                {/* Top: name + rating + score */}
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-gray-900 font-semibold text-[15px] truncate pr-6 group-hover:text-teal-700 transition-colors">
                            {competitor.name}
                        </h3>
                        {competitor.address && (
                            <p className="text-gray-400 text-xs mt-0.5 truncate">{competitor.address}</p>
                        )}
                    </div>
                    <ScorePill score={m?.competitivePositionScore} />
                </div>

                {/* Rating row — always visible from competitor.rating */}
                <div className="flex items-center gap-3 mb-3">
                    {competitor.rating != null && (
                        <div className="flex items-center gap-1.5">
                            <StarRow rating={competitor.rating} size={13} />
                            <span className="text-sm font-semibold text-gray-700">{Number(competitor.rating).toFixed(1)}</span>
                            {competitor.review_count != null && (
                                <span className="text-xs text-gray-400">({competitor.review_count})</span>
                            )}
                        </div>
                    )}
                    {m?.ratingGap != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.ratingGap >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                            {m.ratingGap > 0 ? '+' : ''}{m.ratingGap.toFixed(2)} gap
                        </span>
                    )}
                </div>

                {/* Metrics row from report */}
                {m && (m.ownedAverageRating != null || m.competitorAverageRating != null) && (
                    <div className="flex items-center gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-400">You</span>
                            <span className="font-semibold text-gray-700">{m.ownedAverageRating?.toFixed(1) || '--'}</span>
                        </div>
                        <span className="text-gray-300 font-medium">vs</span>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-400">Them</span>
                            <span className="font-semibold text-gray-700">{m.competitorAverageRating?.toFixed(1) || '--'}</span>
                        </div>
                    </div>
                )}

                {/* Competing locations tags */}
                {competitor.location_names.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {competitor.location_names.map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 text-[11px] font-medium
                                                         bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                {name}
                            </span>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-50 text-xs">
                    {m?.threatCount != null && m.threatCount > 0 && (
                        <span className="text-red-400 font-medium">{m.threatCount} threat{m.threatCount !== 1 ? 's' : ''}</span>
                    )}
                    {m?.opportunityCount != null && m.opportunityCount > 0 && (
                        <span className="text-blue-500 font-medium">{m.opportunityCount} opportunit{m.opportunityCount !== 1 ? 'ies' : 'y'}</span>
                    )}
                    <span className="ml-auto">
                        {reportDate ? (
                            <span className="text-gray-400">Report: {reportDate}</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-teal-600">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                                </span>
                                Setting up...
                            </span>
                        )}
                    </span>
                </div>
            </div>

        </div>
    )
}

// ─── Inline Add Competitor ──────────────────────────────────────────────────

function InlineAddCompetitor({ teamId, locations, onSuccess, atLimit }: {
    teamId: string
    locations: Location[]
    onSuccess: () => void
    atLimit: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 400)
    const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function performSearch() {
            if (!debouncedSearch || debouncedSearch.length < 3) { setSearchResults([]); return }
            setIsSearching(true)
            try {
                const res = await apiPost<{ places: PlaceResult[] }>('/api/google/places/search', { query: debouncedSearch })
                setSearchResults(res.places || [])
            } catch { setSearchResults([]) }
            finally { setIsSearching(false) }
        }
        performSearch()
    }, [debouncedSearch])

    const handleSelectPlace = (place: PlaceResult) => {
        setSelectedPlace(place)
        setError(null)
    }

    const toggleLocation = (id: string) => {
        setSelectedLocationIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
        )
    }

    const handleSubmit = async () => {
        if (!selectedPlace || selectedLocationIds.length === 0) { setError('Select at least one location.'); return }
        setIsSubmitting(true); setError(null)
        try {
            await apiPost(`/api/teams/${teamId}/competitors`, {
                name: selectedPlace.displayName,
                place_id: selectedPlace.id,
                address: selectedPlace.formattedAddress,
                latitude: selectedPlace.location?.latitude,
                longitude: selectedPlace.location?.longitude,
                rating: selectedPlace.rating,
                review_count: selectedPlace.userRatingCount,
                phone: selectedPlace.phoneNumber,
                website: selectedPlace.websiteUri,
                opening_hours: selectedPlace.openingHours,
                location_ids: selectedLocationIds,
            })
            setExpanded(false); setSearchQuery(''); setSelectedPlace(null); setSelectedLocationIds([]); setSearchResults([])
            onSuccess()
        } catch (err: any) { setError(err.message || 'Failed to add competitor') }
        finally { setIsSubmitting(false) }
    }

    const reset = () => {
        setSelectedPlace(null); setSelectedLocationIds([]); setError(null); setSearchQuery(''); setSearchResults([])
    }

    if (atLimit) {
        return (
            <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">You&apos;ve reached your competitor limit. Upgrade your plan to track more.</p>
            </div>
        )
    }

    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="w-full bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6
                           text-center transition-all duration-200 cursor-pointer
                           hover:border-teal-300 hover:bg-teal-50/30 group"
            >
                <div className="flex items-center justify-center gap-2 text-gray-400 group-hover:text-teal-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium">Add a Competitor</span>
                </div>
            </button>
        )
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                    {selectedPlace ? 'Select Competing Locations' : 'Search for a Business'}
                </h3>
                <button onClick={() => { setExpanded(false); reset() }}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-6">
                {!selectedPlace ? (
                    <>
                        <div className="relative">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by business name or address..."
                                autoFocus
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                                           text-gray-900 placeholder-gray-400 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                            />
                        </div>
                        <div className="mt-2 max-h-72 overflow-y-auto">
                            {isSearching && (
                                <div className="flex items-center gap-2 py-4 px-2 text-gray-400 text-sm">
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                                    </svg>
                                    Searching...
                                </div>
                            )}
                            {!isSearching && searchResults.length === 0 && debouncedSearch.length >= 3 && (
                                <p className="py-4 px-2 text-gray-400 text-sm">No results found.</p>
                            )}
                            {searchResults.map((place) => (
                                <button
                                    key={place.id} onClick={() => handleSelectPlace(place)}
                                    className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-gray-900 text-sm font-medium group-hover:text-teal-700 transition-colors">
                                                {place.displayName}
                                            </div>
                                            <div className="text-gray-400 text-xs mt-0.5 truncate">{place.formattedAddress}</div>
                                        </div>
                                        {place.rating && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-xs text-gray-500 font-medium">{place.rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Selected place pill */}
                        <div className="flex items-center gap-3 bg-teal-50/60 border border-teal-100 rounded-xl px-4 py-3 mb-5">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-teal-900">{selectedPlace.displayName}</div>
                                <div className="text-xs text-teal-600/70 truncate">{selectedPlace.formattedAddress}</div>
                            </div>
                            <button onClick={reset} className="text-teal-500 hover:text-teal-700 text-xs font-medium cursor-pointer shrink-0">
                                Change
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 font-medium mb-3">Which of your locations compete? <span className="text-gray-400 font-normal">(max 3)</span></p>

                        {locations.length === 0 ? (
                            <p className="text-gray-400 text-sm py-2">No locations found. Add locations to your team first.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                {locations.map(loc => {
                                    const selected = selectedLocationIds.includes(loc.id)
                                    const disabled = !selected && selectedLocationIds.length >= 3
                                    return (
                                        <label key={loc.id}
                                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all duration-150
                                                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                                                ${selected ? 'bg-teal-50/50 border-teal-200 ring-1 ring-teal-100' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <input type="checkbox" checked={selected} onChange={() => toggleLocation(loc.id)} disabled={disabled}
                                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500/30" />
                                            <span className={`text-sm ${selected ? 'text-teal-800 font-medium' : 'text-gray-600'}`}>{loc.name}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        )}

                        {error && <p className="text-red-500 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                            <button onClick={() => { setExpanded(false); reset() }}
                                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Cancel</button>
                            <button onClick={handleSubmit}
                                disabled={isSubmitting || selectedLocationIds.length === 0}
                                className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl
                                           hover:bg-teal-500 active:scale-[0.98] transition-all duration-150
                                           shadow-sm shadow-teal-600/20 cursor-pointer
                                           disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                                        </svg>
                                        Adding...
                                    </span>
                                ) : 'Add Competitor'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ teamId, locations, onSuccess }: { teamId: string; locations: Location[]; onSuccess: () => void }) {
    return (
        <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50
                            ring-1 ring-teal-100 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
            </div>
            <h3 className="text-gray-900 text-lg font-semibold">Start monitoring your competition</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto leading-relaxed mb-8">
                Search for a competitor below. We&apos;ll sync their reviews and generate competitive intelligence reports automatically every two weeks.
            </p>
            <div className="max-w-2xl mx-auto">
                <InlineAddCompetitor teamId={teamId} locations={locations} onSuccess={onSuccess} atLimit={false} />
            </div>
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CompetitorMonitoringPage() {
    const { teamId } = useParams() as { teamId: string }
    const router = useRouter()

    const [competitors, setCompetitors] = useState<Competitor[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [tier, setTier] = useState<string>('FREE')
    const [maxCompetitors, setMaxCompetitors] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [compRes, locRes] = await Promise.all([
                apiGet<{ competitors: Competitor[]; tier: string; maxCompetitors: number }>(`/api/teams/${teamId}/competitors`),
                apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`),
            ])
            setCompetitors(compRes.competitors || [])
            setTier(compRes.tier || 'FREE')
            setMaxCompetitors(compRes.maxCompetitors || 0)
            setLocations(locRes.locations || [])
        } catch {
            setToast({ message: 'Failed to load competitors', type: 'error' })
        } finally {
            setLoading(false)
        }
    }, [teamId])

    useEffect(() => { loadData() }, [loadData])

    const handleDeleteCompetitor = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to remove this competitor?')) return
        try {
            await apiDelete(`/api/competitors/${id}`)
            setToast({ message: 'Competitor removed', type: 'success' })
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to remove', type: 'error' })
        }
    }

    const handleAddSuccess = () => {
        setToast({ message: 'Competitor added! Setting up monitoring...', type: 'success' })
        loadData()
    }

    const atLimit = maxCompetitors > 0 && competitors.length >= maxCompetitors

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Competitor Monitoring</h1>
                        {maxCompetitors > 0 && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                                {competitors.length}/{maxCompetitors}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Reviews synced and competitive reports generated every two weeks, automatically.
                    </p>
                </div>
                <a
                    href="/compete"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-all duration-150 shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    How it works
                </a>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-[72px] animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100" />
                                    <div className="space-y-1.5">
                                        <div className="h-3 w-16 rounded bg-gray-100" />
                                        <div className="h-5 w-10 rounded bg-gray-50" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-48 animate-pulse">
                                <div className="h-4 w-40 rounded bg-gray-100 mb-2" />
                                <div className="h-3 w-56 rounded bg-gray-50 mb-4" />
                                <div className="h-3 w-32 rounded bg-gray-50" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && competitors.length === 0 && (
                <EmptyState teamId={teamId} locations={locations} onSuccess={handleAddSuccess} />
            )}

            {/* Has competitors */}
            {!loading && competitors.length > 0 && (
                <>
                    {/* Aggregate metrics */}
                    <AggregateMetrics competitors={competitors} />

                    {/* Competitor grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                        {competitors.map(competitor => (
                            <CompetitorCard
                                key={competitor.id}
                                competitor={competitor}
                                onClick={() => router.push(`/teams/${teamId}/competitive/${competitor.id}`)}
                                onDelete={(e) => handleDeleteCompetitor(e, competitor.id)}
                            />
                        ))}
                    </div>

                    {/* Inline add */}
                    <InlineAddCompetitor
                        teamId={teamId}
                        locations={locations}
                        onSuccess={handleAddSuccess}
                        atLimit={atLimit}
                    />
                </>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}
