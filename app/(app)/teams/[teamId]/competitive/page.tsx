'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
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

// ─── Shared micro-components ───────────────────────────────────────────────

function RatingRing({ rating, size = 48 }: { rating: number | undefined; size?: number }) {
    const r = (size - 6) / 2
    const circumference = 2 * Math.PI * r
    const pct = rating ? (rating / 5) * circumference : 0
    const color = !rating ? '#d1d5db' : rating >= 4.5 ? '#059669' : rating >= 4.0 ? '#0d9488' : rating >= 3.5 ? '#d97706' : '#ef4444'

    return (
        <svg width={size} height={size} className="shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={3} />
            {rating && (
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={3} strokeLinecap="round"
                    strokeDasharray={`${pct} ${circumference - pct}`}
                    strokeDashoffset={circumference / 4}
                    className="transition-all duration-500"
                />
            )}
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                className="text-xs font-bold" fill={color}
            >
                {rating ? rating.toFixed(1) : '—'}
            </text>
        </svg>
    )
}

function RelativeTime({ date }: { date: string }) {
    const now = new Date()
    const d = new Date(date)
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    let label: string
    if (diffMins < 1) label = 'Just now'
    else if (diffMins < 60) label = `${diffMins}m ago`
    else if (diffHours < 24) label = `${diffHours}h ago`
    else if (diffDays < 7) label = `${diffDays}d ago`
    else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return <span title={d.toLocaleString()}>{label}</span>
}

// ─── Main component ────────────────────────────────────────────────────────

export default function CompetitiveDashboard() {
    const { teamId } = useParams() as { teamId: string }

    const [competitors, setCompetitors] = useState<Competitor[]>([])
    const [runs, setRuns] = useState<CompetitiveRun[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    // Competitor add form
    const [showAddForm, setShowAddForm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 400)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPlaceId, setNewPlaceId] = useState('')
    const [selectedPlaceData, setSelectedPlaceData] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Report config
    const [showCustomConfig, setShowCustomConfig] = useState(false)
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([])

    // Competitor focus — clicking a card filters reports to ones involving that competitor
    const [focusedCompetitorId, setFocusedCompetitorId] = useState<string | null>(null)

    // Analysis state
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [reportPeriod, setReportPeriod] = useState<string>('30d')
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

    // Stats modal
    const [selectedCompetitorStats, setSelectedCompetitorStats] = useState<Competitor | null>(null)

    // ─── Derived state ───

    // How many reports include each competitor
    const reportCountByCompetitor = useMemo(() => {
        const map: Record<string, number> = {}
        for (const r of runs) {
            for (const cid of r.competitor_ids) {
                map[cid] = (map[cid] || 0) + 1
            }
        }
        return map
    }, [runs])

    // Last report date per competitor
    const lastReportByCompetitor = useMemo(() => {
        const map: Record<string, string> = {}
        for (const r of runs) {
            for (const cid of r.competitor_ids) {
                if (!map[cid] || r.created_at > map[cid]) {
                    map[cid] = r.created_at
                }
            }
        }
        return map
    }, [runs])

    // Filtered runs based on focused competitor
    const filteredRuns = useMemo(() => {
        if (!focusedCompetitorId) return runs
        return runs.filter(r => r.competitor_ids.includes(focusedCompetitorId))
    }, [runs, focusedCompetitorId])

    const activeRun = useMemo(() => {
        if (selectedRunId) return filteredRuns.find(r => r.id === selectedRunId) || filteredRuns[0]
        return filteredRuns[0] || null
    }, [filteredRuns, selectedRunId])

    // ─── Data loading ───

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

            // Default selections for new report
            const latestRun = (runRes.runs || [])[0]
            if (latestRun) {
                setSelectedLocations(latestRun.owned_location_ids || [])
                setSelectedCompetitors(latestRun.competitor_ids || [])
            } else {
                setSelectedLocations((locRes.locations || []).slice(0, 3).map(l => l.id))
                setSelectedCompetitors((compRes.competitors || []).slice(0, 3).map(c => c.id))
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

    // ─── Handlers ───

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
            if (focusedCompetitorId === id) setFocusedCompetitorId(null)
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

    const handleRunAnalysis = async (locIds?: string[], compIds?: string[]) => {
        const locs = locIds || selectedLocations
        const comps = compIds || selectedCompetitors
        if (locs.length === 0 || comps.length === 0) {
            setToast({ message: 'Select at least 1 location and 1 competitor', type: 'error' })
            return
        }
        setIsRefreshing(true)
        try {
            await apiPost(`/api/teams/${teamId}/competitive-runs`, {
                owned_location_ids: locs,
                competitor_ids: comps,
            })
            setToast({ message: 'Competitive analysis complete!', type: 'success' })
            setShowCustomConfig(false)
            setSelectedRunId(null)
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to run analysis', type: 'error' })
        } finally { setIsRefreshing(false) }
    }

    const handleNewReport = useCallback(() => {
        setShowCustomConfig(true)
    }, [])

    const handleReRunReport = useCallback(() => {
        if (!activeRun) return
        handleRunAnalysis(activeRun.owned_location_ids, activeRun.competitor_ids)
    }, [activeRun])

    const handleDeleteRun = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return
        try {
            await apiDelete(`/api/teams/${teamId}/competitive-runs/${id}`)
            setToast({ message: 'Report deleted', type: 'success' })
            if (selectedRunId === id) setSelectedRunId(null)
            loadData()
        } catch (err: any) { setToast({ message: err.message || 'Failed to delete report', type: 'error' }) }
    }

    const handleFocusCompetitor = useCallback((compId: string) => {
        const isFocused = focusedCompetitorId === compId
        setFocusedCompetitorId(isFocused ? null : compId)
        setSelectedRunId(null)
        setReportPeriod('30d')
    }, [focusedCompetitorId])

    // ─── Loading skeleton ───

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse flex flex-col gap-6">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="flex gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-44 bg-gray-100 rounded-xl w-44 shrink-0"></div>)}
                    </div>
                    <div className="h-64 bg-gray-100 rounded-xl w-full"></div>
                </div>
            </div>
        )
    }

    // ─── Helpers for rendering ───

    const getRunScore = (run: CompetitiveRun): number | undefined => {
        return run.data?.['30d']?.competitivePositionScore ?? run.data?.['90d']?.competitivePositionScore
    }

    const getRunCompetitorNames = (run: CompetitiveRun): string[] => {
        return run.competitor_ids
            .map(id => competitors.find(c => c.id === id)?.name)
            .filter(Boolean) as string[]
    }

    // ─── Render ───

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="p-8 max-w-[1400px] mx-auto w-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Competitive Intelligence</h1>
                        <p className="text-gray-500 mt-0.5">Monitor competitors and understand your market position.</p>
                    </div>
                    {/* Primary action */}
                    <button
                        onClick={handleNewReport}
                        disabled={isRefreshing || competitors.length === 0 || locations.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isRefreshing ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Running...</>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                New Report
                            </>
                        )}
                    </button>
                </div>

                <div className="space-y-6">

                    {/* ═══════════════════════════════════════════════════════
                        SECTION 1: COMPETITOR RAIL
                    ═══════════════════════════════════════════════════════ */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Competitors</h2>
                            {focusedCompetitorId && (
                                <button
                                    onClick={() => { setFocusedCompetitorId(null); setSelectedRunId(null) }}
                                    className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Clear filter
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-3 pt-3 -mt-3 px-1 -mx-1">
                            {competitors.map(comp => {
                                const isFocused = focusedCompetitorId === comp.id
                                const reportCount = reportCountByCompetitor[comp.id] || 0
                                const lastReport = lastReportByCompetitor[comp.id]

                                return (
                                    <div
                                        key={comp.id}
                                        onClick={() => handleFocusCompetitor(comp.id)}
                                        className={`bg-white rounded-xl p-4 shadow-sm flex flex-col items-center min-w-[170px] max-w-[190px] group/card relative cursor-pointer transition-all duration-200 ${
                                            isFocused
                                                ? 'border-2 border-teal-500 ring-2 ring-teal-100 shadow-md scale-[1.02]'
                                                : 'border border-gray-200 hover:border-teal-300 hover:shadow-md'
                                        }`}
                                    >
                                        {/* Report count badge */}
                                        {reportCount > 0 && (
                                            <div className="absolute -top-2 -right-2 bg-teal-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                                                {reportCount}
                                            </div>
                                        )}

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCompetitor(comp.id) }}
                                            className="absolute top-2 right-2 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/card:opacity-100 transition-all"
                                            title="Delete"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>

                                        {/* Rating ring */}
                                        <RatingRing rating={comp.rating} size={52} />

                                        {/* Name & address */}
                                        <h3 className="text-sm font-bold text-gray-900 mt-2 text-center truncate w-full">{comp.name}</h3>
                                        <p className="text-xs text-gray-400 truncate w-full text-center mt-0.5">
                                            {comp.address || comp.place_id}
                                        </p>

                                        {/* Sync status + last report */}
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <span className={`w-2 h-2 rounded-full ${
                                                comp.last_serp_sync_status === 'syncing' ? 'bg-blue-400 animate-pulse' :
                                                comp.last_serp_sync_status === 'error' ? 'bg-red-400' :
                                                comp.last_serp_sync_at ? 'bg-green-400' : 'bg-gray-300'
                                            }`} />
                                            <span className="text-xs text-gray-400">
                                                {comp.last_serp_sync_status === 'syncing' ? 'Syncing' :
                                                 comp.last_serp_sync_at ? 'Synced' : 'Never synced'}
                                            </span>
                                        </div>

                                        {/* Last compared */}
                                        {lastReport && (
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                Last compared <RelativeTime date={lastReport} />
                                            </p>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex gap-1.5 mt-3 w-full">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSyncReviews(comp.id) }}
                                                disabled={comp.last_serp_sync_status === 'syncing'}
                                                className="flex-1 px-2 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors text-center"
                                            >
                                                Sync
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedCompetitorStats(comp) }}
                                                className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
                                            >
                                                Stats
                                            </button>
                                        </div>

                                        {/* Focus hint */}
                                        <p className={`text-[10px] mt-2 transition-all duration-200 ${
                                            isFocused ? 'text-teal-600 font-medium' : 'text-gray-300 opacity-0 group-hover/card:opacity-100'
                                        }`}>
                                            {isFocused ? 'Filtering reports' : 'Click to filter reports'}
                                        </p>
                                    </div>
                                )
                            })}

                            {/* Add competitor card */}
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center min-w-[170px] max-w-[190px] hover:border-teal-300 hover:bg-teal-50/30 transition-colors group/add"
                            >
                                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 group-hover/add:border-teal-300 flex items-center justify-center transition-colors">
                                    <svg className="w-6 h-6 text-gray-400 group-hover/add:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <span className="text-xs font-medium text-gray-500 group-hover/add:text-teal-600 mt-2 transition-colors">Add Competitor</span>
                            </button>
                        </div>
                    </div>

                    {/* ── Add Competitor Form ── */}
                    {showAddForm && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm -mt-2">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Add New Competitor</h3>
                                <button onClick={() => { setShowAddForm(false); setNewPlaceId(''); setNewName(''); setSearchQuery(''); setSelectedPlaceData(null) }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
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
                            </form>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                        SECTION 2: REPORT HISTORY TIMELINE
                    ═══════════════════════════════════════════════════════ */}
                    {filteredRuns.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Report History</h2>
                                    {focusedCompetitorId && (
                                        <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                                            {competitors.find(c => c.id === focusedCompetitorId)?.name}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400">{filteredRuns.length} report{filteredRuns.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex gap-2.5 overflow-x-auto pb-2 px-1 -mx-1">
                                {filteredRuns.map((run, i) => {
                                    const isActive = activeRun?.id === run.id
                                    const score = getRunScore(run)
                                    const compNames = getRunCompetitorNames(run)

                                    return (
                                        <button
                                            key={run.id}
                                            onClick={() => setSelectedRunId(run.id)}
                                            className={`text-left rounded-xl p-3.5 min-w-[200px] max-w-[220px] shrink-0 transition-all duration-200 ${
                                                isActive
                                                    ? 'bg-teal-600 text-white shadow-md scale-[1.02]'
                                                    : 'bg-white border border-gray-200 hover:border-teal-300 hover:shadow-sm'
                                            }`}
                                        >
                                            {/* Date + score */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-xs font-medium ${isActive ? 'text-teal-100' : 'text-gray-400'}`}>
                                                    {i === 0 && !focusedCompetitorId ? 'Latest' : <RelativeTime date={run.created_at} />}
                                                </span>
                                                {score != null && (
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                        isActive
                                                            ? 'bg-white/20 text-white'
                                                            : score >= 70 ? 'text-emerald-600 bg-emerald-50' : score >= 40 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                                                    }`}>
                                                        {score}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Date full */}
                                            <p className={`text-sm font-semibold mb-1.5 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                                {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>

                                            {/* Competitor names */}
                                            <div className="flex flex-wrap gap-1">
                                                {compNames.slice(0, 3).map((name, j) => (
                                                    <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[90px] ${
                                                        isActive ? 'bg-white/15 text-teal-100' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Location count */}
                                            <p className={`text-[10px] mt-1.5 ${isActive ? 'text-teal-200' : 'text-gray-400'}`}>
                                                {run.owned_location_ids.length} location{run.owned_location_ids.length !== 1 ? 's' : ''} vs {run.competitor_ids.length} competitor{run.competitor_ids.length !== 1 ? 's' : ''}
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                        SECTION 3: CUSTOM CONFIG PANEL (only when needed)
                    ═══════════════════════════════════════════════════════ */}
                    {showCustomConfig && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Configure Report</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Select which locations and competitors to include.</p>
                                </div>
                                <button onClick={() => setShowCustomConfig(false)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center justify-between text-sm">
                                        <span>Your Locations (Max 3)</span>
                                        <span className="text-xs bg-white text-teal-600 px-2 py-0.5 rounded border border-teal-100">{selectedLocations.length}/3</span>
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {locations.map(loc => (
                                            <label key={loc.id} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-100 cursor-pointer hover:border-teal-200 transition-colors">
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
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center justify-between text-sm">
                                        <span>Competitors (Max 3)</span>
                                        <span className="text-xs bg-white text-rose-600 px-2 py-0.5 rounded border border-rose-100">{selectedCompetitors.length}/3</span>
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {competitors.map(comp => (
                                            <label key={comp.id} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-100 cursor-pointer hover:border-rose-200 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                                                    checked={selectedCompetitors.includes(comp.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked && selectedCompetitors.length < 3) setSelectedCompetitors([...selectedCompetitors, comp.id])
                                                        else if (!e.target.checked) setSelectedCompetitors(selectedCompetitors.filter(id => id !== comp.id))
                                                    }}
                                                    disabled={!selectedCompetitors.includes(comp.id) && selectedCompetitors.length >= 3}
                                                />
                                                <span className="text-sm text-gray-800">{comp.name}</span>
                                            </label>
                                        ))}
                                        {competitors.length === 0 && <p className="text-sm text-gray-500 italic">Add competitors above first.</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end mt-5">
                                <button
                                    onClick={() => handleRunAnalysis()}
                                    disabled={isRefreshing || selectedLocations.length === 0 || selectedCompetitors.length === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {isRefreshing ? (
                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Running Analysis...</>
                                    ) : (
                                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Run Analysis (3 credits)</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                        SECTION 4: ACTIVE REPORT
                    ═══════════════════════════════════════════════════════ */}
                    {activeRun && activeRun.data ? (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            {/* Report header: participants + timeframe + actions */}
                            <div className="px-6 py-4 border-b border-gray-100">
                                {/* Top row: participants info + actions */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Locations */}
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {activeRun.owned_location_ids.map(id => {
                                                    const loc = locations.find(l => l.id === id)
                                                    return loc ? (
                                                        <span key={id} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">{loc.name}</span>
                                                    ) : null
                                                })}
                                            </div>

                                            <span className="text-gray-300 text-xs font-bold">vs</span>

                                            {/* Competitors */}
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                {activeRun.competitor_ids.map(id => {
                                                    const comp = competitors.find(c => c.id === id)
                                                    return comp ? (
                                                        <span key={id} className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">{comp.name}</span>
                                                    ) : null
                                                })}
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-gray-400">
                                            Generated {new Date(activeRun.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(activeRun.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                                        <button
                                            onClick={handleReRunReport}
                                            disabled={isRefreshing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors border border-teal-200"
                                            title="Re-run with same configuration"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Re-run
                                        </button>
                                        <button
                                            onClick={() => setShowCustomConfig(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                                            title="Customize and run new report"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                            Customize
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRun(activeRun.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete this report"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom row: timeframe toggle */}
                                <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl w-fit">
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
                            </div>

                            {activeRun.data[reportPeriod] ? (
                                <div className="p-6">
                                    <CompetitiveReportPanel data={activeRun.data[reportPeriod]} periodWindow={reportPeriod} />
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <h4 className="text-lg font-bold text-gray-900 mb-2">Not enough data</h4>
                                    <p className="text-gray-500 max-w-md mx-auto">Not enough reviews in the {reportPeriod} window to generate analysis. Try a longer timeframe.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        !showCustomConfig && (
                            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                    <svg className="w-7 h-7 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    {competitors.length === 0 ? 'Add competitors to get started' : 'No reports yet'}
                                </h3>
                                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                    {competitors.length === 0
                                        ? 'Add at least one competitor above, then run your first AI-powered competitive analysis.'
                                        : 'Run your first AI-powered competitive analysis to see how you stack up against competitors.'}
                                </p>
                                {competitors.length > 0 && locations.length > 0 && (
                                    <button
                                        onClick={handleNewReport}
                                        className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-md shadow-teal-100"
                                    >
                                        Create First Report
                                    </button>
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* Stats Modal */}
                {selectedCompetitorStats && (
                    <CompetitorStatsModal competitor={selectedCompetitorStats} onClose={() => setSelectedCompetitorStats(null)} />
                )}
            </div>
        </>
    )
}
