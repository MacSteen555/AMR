'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Toast } from '@/components/Toast'
import { CompetitorStatsModal } from '@/components/CompetitorStatsModal'
import { CompetitiveReportPanel } from '@/components/CompetitiveReportPanel'

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debouncedValue
}

interface Competitor {
    id: string
    name: string
    place_id: string
    address?: string
    website?: string
    rating?: number
    review_count?: number
    last_serp_sync_at?: string
    last_serp_sync_status?: string
}

interface CompetitiveRun {
    id: string
    name: string
    created_at: string
    period_start: string
    period_end: string
    owned_location_ids: string[]
    competitor_ids: string[]
    data: any
}

interface Location {
    id: string
    name: string
    average_rating?: number
    review_count?: number
}

export default function CompetitiveDashboard() {
    const { teamId } = useParams() as { teamId: string }

    const [competitors, setCompetitors] = useState<Competitor[]>([])
    const [runs, setRuns] = useState<CompetitiveRun[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    // Competitor form
    const [showAddForm, setShowAddForm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 400)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPlaceId, setNewPlaceId] = useState('')
    const [selectedPlaceData, setSelectedPlaceData] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Active competitor selection (single)
    const [activeCompetitorId, setActiveCompetitorId] = useState<string | null>(null)

    // Location selection for comparison
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [showLocationPicker, setShowLocationPicker] = useState(false)

    // Analysis state
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [reportPeriod, setReportPeriod] = useState<string>('30d')
    const [showHistory, setShowHistory] = useState(false)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

    // Stats modal
    const [selectedCompetitorStats, setSelectedCompetitorStats] = useState<Competitor | null>(null)

    const activeCompetitor = useMemo(() => competitors.find(c => c.id === activeCompetitorId) || null, [competitors, activeCompetitorId])

    // Runs filtered to active competitor
    const competitorRuns = useMemo(() => {
        if (!activeCompetitorId) return runs
        return runs.filter(r => r.competitor_ids.includes(activeCompetitorId))
    }, [runs, activeCompetitorId])

    const activeRun = useMemo(() => {
        if (selectedRunId) return competitorRuns.find(r => r.id === selectedRunId) || competitorRuns[0]
        return competitorRuns[0] || null
    }, [competitorRuns, selectedRunId])

    // Quick stats for active competitor
    const quickStats = useMemo(() => {
        if (!activeCompetitor) return { yourRating: null, yourReviews: null, competitorRating: null, competitorReviews: null, ratingGap: null }
        const latestData = activeRun?.data?.['30d'] || activeRun?.data?.['90d']
        const ownAvgRating = latestData?.ownedAverageRating ?? null
        const ownReviewCount = latestData?.ownedReviewCount ?? null
        return {
            yourRating: ownAvgRating,
            yourReviews: ownReviewCount,
            competitorRating: activeCompetitor.rating || null,
            competitorReviews: activeCompetitor.review_count || null,
            ratingGap: ownAvgRating && activeCompetitor.rating ? ownAvgRating - activeCompetitor.rating : null,
        }
    }, [activeCompetitor, activeRun])

    useEffect(() => { loadData() }, [teamId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [compRes, runRes, locRes] = await Promise.all([
                apiGet<{ competitors: Competitor[] }>(`/api/teams/${teamId}/competitors`),
                apiGet<{ runs: CompetitiveRun[] }>(`/api/teams/${teamId}/competitive-runs`),
                apiGet<{ locations: Location[] }>(`/api/teams/${teamId}/locations`)
            ])
            setCompetitors(compRes.competitors || [])
            setRuns(runRes.runs || [])
            setLocations(locRes.locations || [])

            // Auto-select first competitor if none selected
            if (!activeCompetitorId && (compRes.competitors || []).length > 0) {
                setActiveCompetitorId(compRes.competitors[0].id)
            }

            // Auto-select locations from latest run, or default to all (up to 3)
            const latestRun = (runRes.runs || [])[0]
            if (latestRun) {
                setSelectedLocations(latestRun.owned_location_ids || [])
            } else {
                setSelectedLocations((locRes.locations || []).slice(0, 3).map(l => l.id))
            }
        } catch (err: any) {
            setToast({ message: 'Failed to load data', type: 'error' })
        } finally { setLoading(false) }
    }

    // Place search
    useEffect(() => {
        async function performSearch() {
            if (!debouncedSearch || debouncedSearch.length < 3) { setSearchResults([]); return }
            setIsSearching(true)
            try {
                const res = await apiPost<{ places: any[] }>('/api/google/places/search', { query: debouncedSearch })
                setSearchResults(res.places || [])
            } catch (err) { console.error('Failed to search places', err) }
            finally { setIsSearching(false) }
        }
        performSearch()
    }, [debouncedSearch])

    const handleAddCompetitor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName || !newPlaceId) return
        setIsSubmitting(true)
        try {
            await apiPost(`/api/teams/${teamId}/competitors`, {
                name: newName, place_id: newPlaceId,
                address: selectedPlaceData?.formattedAddress,
                latitude: selectedPlaceData?.location?.latitude,
                longitude: selectedPlaceData?.location?.longitude,
                rating: selectedPlaceData?.rating,
                review_count: selectedPlaceData?.userRatingCount,
                phone: selectedPlaceData?.phoneNumber,
                website: selectedPlaceData?.websiteUri,
                opening_hours: selectedPlaceData?.openingHours
            })
            setToast({ message: 'Competitor added successfully', type: 'success' })
            setNewName(''); setNewPlaceId(''); setSelectedPlaceData(null); setSearchQuery(''); setSearchResults([]); setShowAddForm(false)
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to add competitor', type: 'error' })
        } finally { setIsSubmitting(false) }
    }

    const handleDeleteCompetitor = async (id: string) => {
        if (!confirm('Are you sure you want to delete this competitor?')) return
        try {
            await apiDelete(`/api/competitors/${id}`)
            setToast({ message: 'Competitor deleted', type: 'success' })
            if (activeCompetitorId === id) setActiveCompetitorId(null)
            loadData()
        } catch (err: any) { setToast({ message: err.message || 'Failed to delete competitor', type: 'error' }) }
    }

    const handleSyncReviews = async (id: string) => {
        try {
            setToast({ message: 'Syncing reviews...', type: 'success' })
            setCompetitors(prev => prev.map(c => c.id === id ? { ...c, last_serp_sync_status: 'syncing' } : c))
            const res = await apiPost<{ fetched: number }>(`/api/competitors/${id}/reviews/sync`, {})
            setToast({ message: `Synced ${res.fetched} reviews successfully!`, type: 'success' })
            loadData()
        } catch (err: any) { setToast({ message: err.message || 'Failed to sync reviews', type: 'error' }); loadData() }
    }

    const handleRefreshAnalysis = async () => {
        if (!activeCompetitorId) { setToast({ message: 'Please select a competitor first', type: 'error' }); return }
        if (selectedLocations.length === 0) { setToast({ message: 'Please select at least 1 location', type: 'error' }); return }

        setIsRefreshing(true)
        try {
            await apiPost(`/api/teams/${teamId}/competitive-runs`, {
                owned_location_ids: selectedLocations,
                competitor_ids: [activeCompetitorId],
            })
            setToast({ message: 'Competitive analysis refreshed!', type: 'success' })
            setSelectedRunId(null)
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to refresh analysis', type: 'error' })
        } finally { setIsRefreshing(false) }
    }

    const handleDeleteRun = async (id: string) => {
        if (!confirm('Are you sure you want to delete this analysis?')) return
        try {
            await apiDelete(`/api/teams/${teamId}/competitive-runs/${id}`)
            setToast({ message: 'Analysis deleted', type: 'success' })
            if (selectedRunId === id) setSelectedRunId(null)
            loadData()
        } catch (err: any) { setToast({ message: err.message || 'Failed to delete analysis', type: 'error' }) }
    }

    const switchCompetitor = (id: string) => {
        setActiveCompetitorId(id)
        setSelectedRunId(null)
        setReportPeriod('30d')
        setShowHistory(false)
    }

    if (loading) {
        return <div className="p-8"><div className="animate-pulse flex flex-col gap-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-100 rounded-xl w-full"></div></div></div>
    }

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="p-8 h-screen flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Competitive Intelligence</h1>
                        <p className="text-gray-500 mt-0.5">Monitor competitors and understand your market position.</p>
                    </div>
                    <button onClick={() => setShowAddForm(true)} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors">
                        Add Competitor
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pb-20">

                    {/* ── Add Competitor Form ── */}
                    {showAddForm && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Competitor</h3>
                            <form onSubmit={handleAddCompetitor} className="flex flex-col gap-4">
                                {!newPlaceId ? (
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className={`w-5 h-5 ${isSearching ? 'text-teal-500 animate-spin' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {isSearching ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                                            </svg>
                                        </div>
                                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 shadow-sm" placeholder="Search for a business name or address..." autoFocus />
                                        {searchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {searchResults.map((place) => (
                                                    <button key={place.id} type="button" className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex flex-col gap-1 transition-colors" onClick={() => { setNewName(place.displayName); setNewPlaceId(place.id); setSelectedPlaceData(place); setSearchResults([]) }}>
                                                        <span className="font-semibold text-gray-900">{place.displayName}</span>
                                                        <span className="text-xs text-gray-500 truncate">{place.formattedAddress}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1 block">Selected Competitor</label>
                                            <input type="text" className="w-full bg-transparent border-0 p-0 text-lg font-bold text-teal-900 focus:ring-0" value={newName} onChange={e => setNewName(e.target.value)} required />
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-2 border-t border-teal-100 md:border-0 md:pt-0">
                                            <button type="button" onClick={() => { setNewPlaceId(''); setNewName(''); setSearchQuery(''); setSelectedPlaceData(null) }} className="flex-1 md:flex-none px-4 py-2 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200 transition-colors">Clear</button>
                                            <button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap">Save Competitor</button>
                                        </div>
                                    </div>
                                )}
                                {!newPlaceId && (
                                    <div className="flex justify-end pt-2">
                                        <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                                    </div>
                                )}
                            </form>
                        </div>
                    )}

                    {/* ── Empty state ── */}
                    {competitors.length === 0 && !showAddForm && (
                        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500 mb-4">No competitors tracked yet. Add one to begin monitoring your market.</p>
                            <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200">Add First Competitor</button>
                        </div>
                    )}

                    {/* ── Competitor Selector Tabs ── */}
                    {competitors.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {competitors.map(comp => (
                                <button
                                    key={comp.id}
                                    onClick={() => switchCompetitor(comp.id)}
                                    className={`relative group/tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                        activeCompetitorId === comp.id
                                            ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                >
                                    {comp.name}
                                    {comp.rating && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeCompetitorId === comp.id ? 'bg-teal-500 text-teal-100' : 'bg-gray-100 text-gray-500'}`}>
                                            ★ {comp.rating.toFixed(1)}
                                        </span>
                                    )}
                                    {/* Delete on hover */}
                                    <span className={`items-center ml-1 ${activeCompetitorId === comp.id ? 'flex' : 'hidden group-hover/tab:flex'}`}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCompetitor(comp.id) }}
                                            className={`p-0.5 rounded ${activeCompetitorId === comp.id ? 'hover:bg-teal-500 text-teal-200' : 'hover:bg-gray-200 text-gray-400'}`}
                                            title="Delete competitor"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Active Competitor Dashboard ── */}
                    {activeCompetitor && (
                        <>
                            {/* Competitor detail card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{activeCompetitor.name}</h3>
                                        {activeCompetitor.address && <p className="text-sm text-gray-500">{activeCompetitor.address}</p>}
                                    </div>
                                    <div className="flex items-center gap-4 ml-4">
                                        {activeCompetitor.rating && (
                                            <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                                                <span className="text-amber-500">★</span> {activeCompetitor.rating.toFixed(1)}
                                                {activeCompetitor.review_count ? <span className="text-gray-400 font-normal text-xs">({activeCompetitor.review_count.toLocaleString()})</span> : null}
                                            </span>
                                        )}
                                        <span className={`text-xs font-medium ${activeCompetitor.last_serp_sync_status === 'syncing' ? 'text-blue-500 animate-pulse' : activeCompetitor.last_serp_sync_status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                                            {activeCompetitor.last_serp_sync_status === 'syncing' ? 'Syncing...' : activeCompetitor.last_serp_sync_at ? `Synced ${new Date(activeCompetitor.last_serp_sync_at).toLocaleDateString()}` : 'Never synced'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedCompetitorStats(activeCompetitor)} className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5" title="View Details">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        Details
                                    </button>
                                    <button onClick={() => handleSyncReviews(activeCompetitor.id)} disabled={activeCompetitor.last_serp_sync_status === 'syncing'} className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5" title="Fetch Reviews">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Sync Reviews
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Competitive Snapshot</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Your Avg Rating</p>
                                        <p className="text-2xl font-bold text-gray-900">{quickStats.yourRating ? quickStats.yourRating.toFixed(1) : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Competitor Rating</p>
                                        <p className="text-2xl font-bold text-gray-900">{quickStats.competitorRating ? quickStats.competitorRating.toFixed(1) : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Rating Gap</p>
                                        <p className={`text-2xl font-bold ${quickStats.ratingGap !== null ? (quickStats.ratingGap >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-900'}`}>
                                            {quickStats.ratingGap !== null ? `${quickStats.ratingGap >= 0 ? '+' : ''}${quickStats.ratingGap.toFixed(2)}` : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Your Reviews</p>
                                        <p className="text-2xl font-bold text-gray-900">{quickStats.yourReviews !== null ? quickStats.yourReviews.toLocaleString() : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Competitor Reviews</p>
                                        <p className="text-2xl font-bold text-gray-900">{quickStats.competitorReviews ? quickStats.competitorReviews.toLocaleString() : '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* AI Analysis Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-bold text-gray-900">AI Analysis</h2>
                                        {activeRun && (
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                                Last updated {new Date(activeRun.created_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {competitorRuns.length > 1 && (
                                            <div className="relative">
                                                <button onClick={() => setShowHistory(!showHistory)} className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    History
                                                </button>
                                                {showHistory && (
                                                    <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                                                        {competitorRuns.map((run, i) => (
                                                            <button key={run.id} onClick={() => { setSelectedRunId(run.id); setShowHistory(false) }}
                                                                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between transition-colors ${selectedRunId === run.id || (!selectedRunId && i === 0) ? 'bg-teal-50' : ''}`}
                                                            >
                                                                <div>
                                                                    <span className="text-sm font-medium text-gray-900">{i === 0 ? 'Latest analysis' : run.name || `Analysis ${competitorRuns.length - i}`}</span>
                                                                    <p className="text-xs text-gray-400">{new Date(run.created_at).toLocaleDateString()} at {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                                </div>
                                                                {(selectedRunId === run.id || (!selectedRunId && i === 0)) && (
                                                                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Location picker */}
                                        <div className="relative">
                                            <button onClick={() => setShowLocationPicker(!showLocationPicker)} className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {selectedLocations.length} Location{selectedLocations.length !== 1 ? 's' : ''}
                                            </button>
                                            {showLocationPicker && (
                                                <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-medium text-gray-900 text-sm">Compare against your locations</h4>
                                                        <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded border border-teal-100">{selectedLocations.length}/3</span>
                                                    </div>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                                        {locations.map(loc => (
                                                            <label key={loc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 cursor-pointer hover:border-teal-200 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                                                                    checked={selectedLocations.includes(loc.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked && selectedLocations.length < 3) setSelectedLocations([...selectedLocations, loc.id])
                                                                        else if (!e.target.checked) setSelectedLocations(selectedLocations.filter(id => id !== loc.id))
                                                                    }}
                                                                    disabled={!selectedLocations.includes(loc.id) && selectedLocations.length >= 3}
                                                                />
                                                                <span className="text-sm text-gray-800">{loc.name}</span>
                                                            </label>
                                                        ))}
                                                        {locations.length === 0 && <p className="text-sm text-gray-500 italic">No locations available.</p>}
                                                    </div>
                                                    <button onClick={() => setShowLocationPicker(false)} className="mt-3 w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Done</button>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleRefreshAnalysis}
                                            disabled={isRefreshing || selectedLocations.length === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
                                        >
                                            {isRefreshing ? (
                                                <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div> Analyzing...</>
                                            ) : (
                                                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Refresh Analysis (3 credits)</>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Analysis content */}
                                {activeRun && activeRun.data ? (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                                                {[
                                                    { id: '30d', label: '30 Days' },
                                                    { id: '90d', label: '90 Days' },
                                                    { id: '6m', label: '6 Months' },
                                                    { id: '1y', label: '1 Year' }
                                                ].map(period => (
                                                    <button key={period.id} type="button" onClick={() => setReportPeriod(period.id)}
                                                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${reportPeriod === period.id ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                                                    >
                                                        {period.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {competitorRuns.length > 1 && (
                                                <button onClick={() => handleDeleteRun(activeRun.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5" title="Delete this analysis">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                        {activeRun.data[reportPeriod] ? (
                                            <div className="p-6">
                                                <CompetitiveReportPanel data={activeRun.data[reportPeriod]} periodWindow={reportPeriod} />
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center">
                                                <h4 className="text-lg font-bold text-gray-900 mb-2">Not enough data</h4>
                                                <p className="text-gray-500 max-w-md mx-auto">Not enough reviews in the {reportPeriod} window. Try a longer timeframe.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                            <svg className="w-7 h-7 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">No analysis for {activeCompetitor.name}</h3>
                                        <p className="text-gray-500 mb-6 max-w-md mx-auto">Run an AI-powered competitive analysis to see how you stack up.</p>
                                        <button onClick={handleRefreshAnalysis} disabled={isRefreshing || selectedLocations.length === 0}
                                            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-md shadow-teal-100"
                                        >
                                            {isRefreshing ? 'Analyzing...' : 'Run First Analysis (3 credits)'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {selectedCompetitorStats && (
                    <CompetitorStatsModal competitor={selectedCompetitorStats} onClose={() => setSelectedCompetitorStats(null)} />
                )}
            </div>
        </>
    )
}
