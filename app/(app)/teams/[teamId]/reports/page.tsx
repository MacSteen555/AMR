'use client'

import { useParams, useSearchParams } from 'next/navigation'
import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Toast } from '@/components/Toast'
import { ReportsView } from '@/components/insights/ReportsView'

// ─── Page Component ──────────────────────────────────────────────────────────

type PeriodKey = '30d' | '90d' | '6m' | '1y'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '6m',  label: '6 months' },
  { key: '1y',  label: '1 year' },
]

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

  const [period, setPeriod] = useState<PeriodKey>('30d')
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
          <p className="text-sm text-[#9CA3AF] mt-1">AI-generated analysis of your reviews</p>
        </div>

        <div className="flex bg-[#F3F4F6] rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === opt.key
                  ? 'bg-white text-[#111827] shadow-sm'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ReportsView
        teamId={teamId}
        locationId={effectiveLocationId}
        tier={tier}
        period={period}
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
