'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Toast } from '@/components/Toast'
import { CompetitorStatsModal } from '@/components/CompetitorStatsModal'
import { CompetitiveReportPanel } from '@/components/CompetitiveReportPanel'

// Utility hook for debouncing search
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
    data: any
}

interface Location {
    id: string
    name: string
}

export default function CompetitiveDashboard() {
    const { teamId } = useParams() as { teamId: string }
    const [activeTab, setActiveTab] = useState<'competitors' | 'reports'>('competitors')

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

    // Insights form
    const [showRunForm, setShowRunForm] = useState(false)
    const [runName, setRunName] = useState('')
    const [periodWindow, setPeriodWindow] = useState('6m')
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [expandedRun, setExpandedRun] = useState<string | null>(null)
    const [reportPeriod, setReportPeriod] = useState<string>('30d')

    // Stats modal
    const [selectedCompetitorStats, setSelectedCompetitorStats] = useState<Competitor | null>(null)

    useEffect(() => {
        loadData()
    }, [teamId])

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
        } catch (err: any) {
            setToast({ message: 'Failed to load data', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // Handle place search
    useEffect(() => {
        async function performSearch() {
            if (!debouncedSearch || debouncedSearch.length < 3) {
                setSearchResults([])
                return
            }
            setIsSearching(true)
            try {
                const res = await apiPost<{ places: any[] }>('/api/google/places/search', { query: debouncedSearch })
                setSearchResults(res.places || [])
            } catch (err) {
                console.error('Failed to search places', err)
            } finally {
                setIsSearching(false)
            }
        }
        performSearch()
    }, [debouncedSearch])

    const handleAddCompetitor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName || !newPlaceId) return
        setIsSubmitting(true)
        try {
            await apiPost(`/api/teams/${teamId}/competitors`, {
                name: newName,
                place_id: newPlaceId,
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
            setNewName('')
            setNewPlaceId('')
            setSelectedPlaceData(null)
            setSearchQuery('')
            setSearchResults([])
            setShowAddForm(false)
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to add competitor', type: 'error' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCompetitor = async (id: string) => {
        if (!confirm('Are you sure you want to delete this competitor?')) return
        try {
            await apiDelete(`/api/competitors/${id}`)
            setToast({ message: 'Competitor deleted', type: 'success' })
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to delete competitor', type: 'error' })
        }
    }

    const handleDeleteRun = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return
        try {
            await apiDelete(`/api/teams/${teamId}/competitive-runs/${id}`)
            setToast({ message: 'Report deleted', type: 'success' })
            if (expandedRun === id) setExpandedRun(null)
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to delete report', type: 'error' })
        }
    }

    const handleSyncReviews = async (id: string) => {
        try {
            setToast({ message: 'Syncing reviews...', type: 'success' })
            // Optimistically update status
            setCompetitors(prev => prev.map(c => c.id === id ? { ...c, last_serp_sync_status: 'syncing' } : c))
            const res = await apiPost<{ fetched: number }>(`/api/competitors/${id}/reviews/sync`, {})
            setToast({ message: `Synced ${res.fetched} reviews successfully!`, type: 'success' })
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to sync reviews', type: 'error' })
            loadData()
        }
    }

    const handleRunInsights = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedLocations.length === 0 || selectedCompetitors.length === 0) {
            setToast({ message: 'Please select at least 1 location and 1 competitor', type: 'error' })
            return
        }
        if (selectedLocations.length > 3 || selectedCompetitors.length > 3) {
            setToast({ message: 'Select maximum 3 locations and 3 competitors', type: 'error' })
            return
        }

        setIsRunning(true)
        try {
            await apiPost(`/api/teams/${teamId}/competitive-runs`, {
                name: runName,
                owned_location_ids: selectedLocations,
                competitor_ids: selectedCompetitors
            })
            setToast({ message: 'Competitive Report generated!', type: 'success' })
            setShowRunForm(false)
            setActiveTab('reports')
            loadData()
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to run analysis', type: 'error' })
        } finally {
            setIsRunning(false)
        }
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
                        <h1 className="text-3xl font-bold text-gray-900">Competitive Insights</h1>
                        <p className="text-gray-500 mt-0.5">Track competitors and generate SWOT analysis reports.</p>
                    </div>
                    {activeTab === 'competitors' && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
                        >
                            Add Competitor
                        </button>
                    )}
                    {activeTab === 'reports' && (
                        <button
                            onClick={() => setShowRunForm(true)}
                            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
                        >
                            New Report
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-gray-200 mb-6 pb-0.5">
                    <button
                        onClick={() => setActiveTab('competitors')}
                        className={`pb-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'competitors' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                    >
                        Managed Competitors
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`pb-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reports' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                    >
                        Insights & Reports
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'competitors' && (
                        <div className="space-y-6">
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
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 shadow-sm"
                                                    placeholder="Search for a business name or address..."
                                                    autoFocus
                                                />

                                                {searchResults.length > 0 && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                        {searchResults.map((place) => (
                                                            <button
                                                                key={place.id}
                                                                type="button"
                                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex flex-col gap-1 transition-colors"
                                                                onClick={() => {
                                                                    setNewName(place.displayName)
                                                                    setNewPlaceId(place.id)
                                                                    setSelectedPlaceData(place)
                                                                    setSearchResults([])
                                                                }}
                                                            >
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
                                                    <input
                                                        type="text"
                                                        className="w-full bg-transparent border-0 p-0 text-lg font-bold text-teal-900 focus:ring-0"
                                                        value={newName}
                                                        onChange={e => setNewName(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-2 border-t border-teal-100 md:border-0 md:pt-0">
                                                    <button type="button" onClick={() => { setNewPlaceId(''); setNewName(''); setSearchQuery(''); setSelectedPlaceData(null); }} className="flex-1 md:flex-none px-4 py-2 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200 transition-colors">Clear</button>
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

                            {competitors.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-500 mb-4">No competitors tracked yet. Add one to begin syncing reviews.</p>
                                    <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200">Add First Competitor</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {competitors.map(comp => (
                                        <div key={comp.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-xl font-bold text-gray-900">{comp.name}</h3>
                                                <button onClick={() => handleDeleteCompetitor(comp.id)} className="text-gray-400 hover:text-red-500" title="Delete Competitor">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2.5 rounded border border-gray-100 truncate" title={comp.address || 'Address hidden'}>
                                                {comp.address ? (
                                                    <span className="flex items-center gap-1.5 text-gray-700">
                                                        <svg className="w-3.5 h-3.5 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        {comp.address}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">Address missing for {comp.name}</span>
                                                )}
                                            </div>

                                            <div className="flex gap-4 mb-6 text-sm items-center">
                                                {comp.rating && (
                                                    <div className="flex items-center gap-1.5 font-medium text-amber-600">
                                                        <span className="text-amber-500 text-lg leading-none mt-[-2px]">★</span> {comp.rating.toFixed(1)}
                                                        {comp.review_count ? <span className="text-gray-400 font-normal ml-0.5">({comp.review_count.toLocaleString()})</span> : null}
                                                    </div>
                                                )}
                                                {comp.website && (
                                                    <a href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-teal-600 hover:text-teal-800 font-medium ml-auto">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        Website
                                                    </a>
                                                )}
                                            </div>

                                            <div className="mt-auto border-t border-gray-100 pt-4 flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Sync Status</span>
                                                    <span className={`text-sm font-medium ${comp.last_serp_sync_status === 'syncing' ? 'text-blue-500 animate-pulse' : comp.last_serp_sync_status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                                        {comp.last_serp_sync_status === 'syncing' ? 'Syncing...' : comp.last_serp_sync_status === 'error' ? 'Failed' : comp.last_serp_sync_at ? new Date(comp.last_serp_sync_at).toLocaleDateString() : 'Never synced'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedCompetitorStats(comp)}
                                                        className="px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleSyncReviews(comp.id)}
                                                        disabled={comp.last_serp_sync_status === 'syncing'}
                                                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Fetch Reviews
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-6 pb-20">
                            {showRunForm && (
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-900">Run New Competitive Report</h3>
                                        <button onClick={() => setShowRunForm(false)} className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>

                                    <form onSubmit={handleRunInsights} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Report Name</label>
                                                <input type="text" value={runName} onChange={e => setRunName(e.target.value)} placeholder="Q1 Analysis vs Competitors" className="w-full px-4 py-2 border border-gray-200 rounded-lg" required />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {/* Owned Locations */}
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h4 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                                                    <span>Select Your Locations (Max 3)</span>
                                                    <span className="text-xs bg-white text-teal-600 px-2 py-1 rounded border border-teal-100">{selectedLocations.length}/3</span>
                                                </h4>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {locations.map(loc => (
                                                        <label key={loc.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 cursor-pointer hover:border-teal-200 transition-colors">
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
                                                            <span className="text-sm font-medium text-gray-800">{loc.name}</span>
                                                        </label>
                                                    ))}
                                                    {locations.length === 0 && <p className="text-sm text-gray-500 italic">No locations available.</p>}
                                                </div>
                                            </div>

                                            {/* Competitors */}
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h4 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                                                    <span>Select Competitors (Max 3)</span>
                                                    <span className="text-xs bg-white text-rose-600 px-2 py-1 rounded border border-rose-100">{selectedCompetitors.length}/3</span>
                                                </h4>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {competitors.map(comp => (
                                                        <label key={comp.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 cursor-pointer hover:border-rose-200 transition-colors">
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
                                                            <span className="text-sm font-medium text-gray-800">{comp.name}</span>
                                                        </label>
                                                    ))}
                                                    {competitors.length === 0 && <p className="text-sm text-gray-500 italic">No competitors tracked yet. Add one in the other tab.</p>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4 border-t border-gray-100">
                                            <button
                                                type="submit"
                                                disabled={isRunning || selectedLocations.length === 0 || selectedCompetitors.length === 0}
                                                className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-200"
                                            >
                                                {isRunning ? (
                                                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div> Generating Report...</>
                                                ) : 'Run Analysis (5 Credits)'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {runs.length === 0 ? (
                                !showRunForm && (
                                    <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                            <span className="text-2xl">📊</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">No reports yet</h3>
                                        <p className="text-gray-500 mb-6 max-w-md mx-auto">Generate AI-powered SWOT analyses comparing your locations against competitors based on verified reviews.</p>
                                        <button onClick={() => setShowRunForm(true)} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-md shadow-teal-100">
                                            Create First Report
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-6">
                                    {runs.map(run => (
                                        <div key={run.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                                            <div
                                                className="px-6 py-5 cursor-pointer flex items-center justify-between"
                                                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${expandedRun === run.id ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-600'}`}>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900">{run.name}</h3>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">Generated {new Date(run.created_at).toLocaleDateString()}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                        title="Delete Report"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedRun === run.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>

                                            {expandedRun === run.id && run.data && run.data[reportPeriod] && (
                                                <div className="px-8 pb-8 pt-4 border-t border-gray-100 bg-gray-50/30">

                                                    {/* Timeframe Toggle */}
                                                    <div className="flex gap-2 mb-8 bg-white p-1 rounded-xl border border-gray-200 w-fit">
                                                        {[
                                                            { id: '30d', label: '30 Days' },
                                                            { id: '90d', label: '90 Days' },
                                                            { id: '6m', label: '6 Months' },
                                                            { id: '1y', label: '1 Year' }
                                                        ].map(period => (
                                                            <button
                                                                key={period.id}
                                                                type="button"
                                                                onClick={() => setReportPeriod(period.id)}
                                                                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${reportPeriod === period.id ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {period.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Rich Competitive Report */}
                                                    <CompetitiveReportPanel data={run.data[reportPeriod]} periodWindow={reportPeriod} />
                                                </div>
                                            )}

                                            {/* Show empty state if the chosen period wasn't successfully generated */}
                                            {expandedRun === run.id && run.data && !run.data[reportPeriod] && (
                                                <div className="px-8 pb-8 pt-4 border-t border-gray-100 bg-gray-50/30 flex flex-col items-center justify-center text-center">
                                                    {/* Timeframe Toggle */}
                                                    <div className="flex gap-2 mb-8 bg-white p-1 rounded-xl border border-gray-200 w-fit self-start">
                                                        {[
                                                            { id: '30d', label: '30 Days' },
                                                            { id: '90d', label: '90 Days' },
                                                            { id: '6m', label: '6 Months' },
                                                            { id: '1y', label: '1 Year' }
                                                        ].map(period => (
                                                            <button
                                                                key={period.id}
                                                                type="button"
                                                                onClick={() => setReportPeriod(period.id)}
                                                                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${reportPeriod === period.id ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {period.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="bg-white p-8 rounded-xl border border-gray-200 max-w-lg w-full">
                                                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <h4 className="text-lg font-bold text-gray-900 mb-2">Not enough data available</h4>
                                                        <p className="text-gray-500">We couldn't generate a report for this specific time frame ({reportPeriod}) because there weren't enough reviews collected for either your locations or the selected competitors during this period.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Render Stats Modal */}
                {selectedCompetitorStats && (
                    <CompetitorStatsModal
                        competitor={selectedCompetitorStats}
                        onClose={() => setSelectedCompetitorStats(null)}
                    />
                )}
            </div>
        </>
    )
}
