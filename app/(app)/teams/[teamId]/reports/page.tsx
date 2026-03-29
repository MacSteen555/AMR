'use client'

import { useParams, useSearchParams } from 'next/navigation'
import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Toast } from '@/components/Toast'
import { ReportsView } from '@/components/insights/ReportsView'

// ─── Page Component ──────────────────────────────────────────────────────────

function ReportsPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const teamId = params.teamId as string
  const locationId = searchParams.get('location')
  const { teams } = useAuth()

  const currentTeam = teams.find(t => t.id === teamId)
  const tier = currentTeam?.subscription?.tier || 'FREE'

  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!teamId) return
    apiGet<any>(`/api/teams/${teamId}/locations`).then((data) => {
      setLocations(data.locations || data || [])
    }).catch(() => {})
  }, [teamId])

  const effectiveLocationId = useMemo(() => {
    if (locationId) return locationId
    if (locations.length === 1) return locations[0].id
    return null
  }, [locationId, locations])

  const isTeamView = !effectiveLocationId

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const handleToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{isTeamView ? 'Team Reports' : 'Location Reports'}</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">In-depth analysis of your reviews</p>
        </div>
        <a
          href="/insights"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How it works
        </a>
      </div>

      <ReportsView
        teamId={teamId}
        locationId={effectiveLocationId}
        tier={tier}
        onToast={handleToast}
      />
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageContent />
    </Suspense>
  )
}
