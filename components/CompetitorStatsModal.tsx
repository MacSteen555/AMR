'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts'

interface Review {
    id: string
    reviewer_name: string
    reviewer_profile_url?: string
    rating: number
    comment: string
    review_date: string
    source: string
}

interface HistoricalStat {
    rawMonth: string
    month: string
    avgRating: number
    reviewCount: number
}

interface CategoryStat {
    subject: string
    A: number
    fullMark: number
}

interface CompetitorStatsModalProps {
    competitor: {
        id: string
        name: string
        rating?: number
        review_count?: number
        address?: string
    }
    onClose: () => void
}

export function CompetitorStatsModal({ competitor, onClose }: CompetitorStatsModalProps) {
    const [loading, setLoading] = useState(true)
    const [recentReviews, setRecentReviews] = useState<Review[]>([])
    const [historicalStats, setHistoricalStats] = useState<HistoricalStat[]>([])
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
    const [error, setError] = useState('')

    useEffect(() => {
        async function fetchStats() {
            setLoading(true)
            try {
                const res = await apiGet<{ recent_reviews: Review[], historical_stats: HistoricalStat[], category_stats: CategoryStat[] }>(`/api/competitors/${competitor.id}/stats`)
                setRecentReviews(res.recent_reviews || [])
                setHistoricalStats(res.historical_stats || [])
                setCategoryStats(res.category_stats || [])
            } catch (err: any) {
                setError(err.message || 'Failed to load competitor stats')
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [competitor.id])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{competitor.name}</h2>
                        {competitor.address && <p className="text-sm text-gray-500 mt-0.5 max-w-xl truncate">{competitor.address}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col gap-6 animate-pulse">
                            <div className="h-64 bg-gray-100 rounded-xl w-full"></div>
                            <div className="h-64 bg-gray-100 rounded-xl w-full"></div>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                            {error}
                        </div>
                    ) : (
                        <div className="space-y-8">

                            {/* Charts Row */}
                            {historicalStats.length > 0 ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Rating Chart */}
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-4">Average Rating by Month</h4>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={historicalStats}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                                    <YAxis domain={['dataMin - 0.5', 5]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                        // @ts-ignore
                                                        formatter={(value: number) => [value.toFixed(1) + ' ★', 'Avg Rating']}
                                                    />
                                                    <Line type="monotone" dataKey="avgRating" stroke="#0D9488" strokeWidth={3} dot={{ r: 4, fill: '#0D9488' }} activeDot={{ r: 6 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Review Volume Chart */}
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4">Review Volume Over Time</h4>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={historicalStats}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                        // @ts-ignore
                                                        formatter={(value: number) => [value, 'Reviews']}
                                                        cursor={{ fill: '#F3F4F6' }}
                                                    />
                                                    <Bar dataKey="reviewCount" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    {/* Subrating Breakdown Chart */}
                                    {categoryStats && categoryStats.length > 0 && (
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm lg:col-span-2">
                                            <h4 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4">Attribute Breakdown</h4>
                                            <div className="h-64 flex justify-center">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryStats}>
                                                        <PolarGrid stroke="#E5E7EB" />
                                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#4B5563', fontSize: 12, fontWeight: 500 }} />
                                                        <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                                        <Radar name="Score" dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} />
                                                        <RechartsTooltip
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                            // @ts-ignore
                                                            formatter={(value: number) => [value.toFixed(1) + ' ★', 'Score']}
                                                        />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                                    No historical rating data available yet. Fetch reviews to populate these charts.
                                </div>
                            )}

                            {/* Recent Reviews */}
                            <div>
                                <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    Recent Reviews
                                </h4>
                                {recentReviews.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {recentReviews.map((review) => (
                                            <div key={review.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col hover:border-teal-100 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                                                            {review.reviewer_name?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</div>
                                                            <div className="text-xs text-gray-400">{review.review_date ? new Date(review.review_date).toLocaleDateString() : 'Unknown Date'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 text-amber-500 text-sm">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-gray-700 text-sm line-clamp-4 leading-relaxed mt-2 flex-1 relative z-10">{review.comment || <span className="text-gray-400 italic">No text provided with this rating.</span>}</p>
                                                {review.comment && review.comment.length > 150 && (
                                                    <div className="mt-2 text-xs font-medium text-teal-600 block pt-2 border-t border-gray-50 cursor-default">
                                                        Scroll to read more...
                                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none -z-10" />
                                                    </div>
                                                )}
                                                <style jsx>{`
                                                    p.line-clamp-4 { overflow-y: auto; max-height: 80px; }
                                                    p.line-clamp-4::-webkit-scrollbar { width: 4px; }
                                                    p.line-clamp-4::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
                                                `}</style>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                                        No reviews found in the database.
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
