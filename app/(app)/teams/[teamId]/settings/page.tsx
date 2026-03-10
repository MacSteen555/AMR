'use client'

import { useAuth } from '@/hooks/useAuth'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPatch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Location {
  id: string
  name: string
  address: string
  brand_voice?: string
  positive_sentiment?: string
  negative_sentiment?: string
  reply_language?: string
  signature?: string | null
}

const SIGNATURE_PRESETS = ['store_name', 'team_name', 'user_name'] as const
type SignaturePreset = (typeof SIGNATURE_PRESETS)[number]
type SignatureType = SignaturePreset | 'custom'

interface LocationForm {
  brand_voice: string
  negative_sentiment: string
  reply_language: string
  signature_type: SignatureType
  signature_custom: string
}

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
] as const

const SIGNATURE_LABELS: Record<SignatureType, string> = {
  store_name: 'Store Name',
  team_name: 'Team Name',
  user_name: 'User Name',
  custom: 'Custom',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSignatureType(value: string | null | undefined): SignatureType {
  if (!value) return 'store_name'
  if ((SIGNATURE_PRESETS as readonly string[]).includes(value)) return value as SignaturePreset
  return 'custom'
}

function getSignatureCustom(value: string | null | undefined): string {
  const type = getSignatureType(value)
  return type === 'custom' ? (value ?? '') : ''
}

function buildLocationForm(loc: Location): LocationForm {
  return {
    brand_voice: loc.brand_voice ?? '',
    negative_sentiment: loc.negative_sentiment ?? '',
    reply_language: loc.reply_language ?? 'en-US',
    signature_type: getSignatureType(loc.signature),
    signature_custom: getSignatureCustom(loc.signature),
  }
}

function formToPayload(form: LocationForm) {
  return {
    brand_voice: form.brand_voice,
    negative_sentiment: form.negative_sentiment,
    reply_language: form.reply_language,
    signature:
      form.signature_type === 'custom' ? form.signature_custom : form.signature_type,
  }
}

function formsEqual(a: LocationForm, b: LocationForm): boolean {
  return (
    a.brand_voice === b.brand_voice &&
    a.negative_sentiment === b.negative_sentiment &&
    a.reply_language === b.reply_language &&
    a.signature_type === b.signature_type &&
    a.signature_custom === b.signature_custom
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const router = useRouter()
  const { user, teams, loading: authLoading } = useAuth()

  // Team name state
  const team = teams.find((t) => t.id === teamId)
  const [teamName, setTeamName] = useState('')
  const [originalTeamName, setOriginalTeamName] = useState('')
  const [savingTeamName, setSavingTeamName] = useState(false)
  const [teamNameStatus, setTeamNameStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Locations state
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [forms, setForms] = useState<Record<string, LocationForm>>({})
  const [originalForms, setOriginalForms] = useState<Record<string, LocationForm>>({})
  const [savingLocation, setSavingLocation] = useState<Record<string, boolean>>({})
  const [locationStatus, setLocationStatus] = useState<
    Record<string, 'idle' | 'saved' | 'error'>
  >({})

  // Sync team name when teams load
  useEffect(() => {
    if (team) {
      setTeamName(team.name)
      setOriginalTeamName(team.name)
    }
  }, [team])

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    if (!teamId) return
    setLoadingLocations(true)
    try {
      const data = await apiGet<{ locations: Location[] }>(
        `/api/teams/${teamId}/locations`,
      )
      const locs = data.locations ?? []
      setLocations(locs)

      const formsMap: Record<string, LocationForm> = {}
      locs.forEach((loc) => {
        formsMap[loc.id] = buildLocationForm(loc)
      })
      setForms(formsMap)
      setOriginalForms(JSON.parse(JSON.stringify(formsMap)))
    } catch {
      // fail silently — empty state will show
    } finally {
      setLoadingLocations(false)
    }
  }, [teamId])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  // ---- Handlers ----

  const handleSaveTeamName = async () => {
    if (!teamId || teamName === originalTeamName) return
    setSavingTeamName(true)
    setTeamNameStatus('idle')
    try {
      await apiPatch(`/api/teams/${teamId}`, { name: teamName })
      setOriginalTeamName(teamName)
      setTeamNameStatus('saved')
      setTimeout(() => setTeamNameStatus('idle'), 2500)
    } catch {
      setTeamNameStatus('error')
      setTimeout(() => setTeamNameStatus('idle'), 3000)
    } finally {
      setSavingTeamName(false)
    }
  }

  const updateLocationForm = (locId: string, patch: Partial<LocationForm>) => {
    setForms((prev) => ({
      ...prev,
      [locId]: { ...prev[locId], ...patch },
    }))
    // Clear status when user edits
    setLocationStatus((prev) => ({ ...prev, [locId]: 'idle' }))
  }

  const isLocationDirty = (locId: string) => {
    if (!forms[locId] || !originalForms[locId]) return false
    return !formsEqual(forms[locId], originalForms[locId])
  }

  const handleSaveLocation = async (locId: string) => {
    if (!teamId || !forms[locId]) return
    setSavingLocation((prev) => ({ ...prev, [locId]: true }))
    setLocationStatus((prev) => ({ ...prev, [locId]: 'idle' }))
    try {
      await apiPatch(
        `/api/teams/${teamId}/locations/${locId}`,
        formToPayload(forms[locId]),
      )
      setOriginalForms((prev) => ({
        ...prev,
        [locId]: { ...forms[locId] },
      }))
      setLocationStatus((prev) => ({ ...prev, [locId]: 'saved' }))
      setTimeout(
        () => setLocationStatus((prev) => ({ ...prev, [locId]: 'idle' })),
        2500,
      )
    } catch {
      setLocationStatus((prev) => ({ ...prev, [locId]: 'error' }))
      setTimeout(
        () => setLocationStatus((prev) => ({ ...prev, [locId]: 'idle' })),
        3000,
      )
    } finally {
      setSavingLocation((prev) => ({ ...prev, [locId]: false }))
    }
  }

  // ---- Loading / empty states ----

  if (authLoading || loadingLocations) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
          >
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!team) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Team not found.</p>
      </div>
    )
  }

  // ---- Render ----

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Settings</h1>
        <p className="text-sm text-gray-500 mt-1">{team.name}</p>
      </div>

      {/* Team Name Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Team Name</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value)
              setTeamNameStatus('idle')
            }}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
          />
          <button
            onClick={handleSaveTeamName}
            disabled={teamName === originalTeamName || savingTeamName}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {savingTeamName ? 'Saving...' : 'Save'}
          </button>
        </div>
        {teamNameStatus === 'saved' && (
          <p className="text-sm text-teal-600 font-medium">Saved</p>
        )}
        {teamNameStatus === 'error' && (
          <p className="text-sm text-red-600 font-medium">
            Failed to save team name. Please try again.
          </p>
        )}
      </div>

      {/* Billing & Subscription */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Billing & Subscription</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Current plan:{' '}
              <span className="font-semibold text-gray-900">
                {team.subscription?.tier
                  ? team.subscription.tier.charAt(0).toUpperCase() +
                    team.subscription.tier.slice(1).toLowerCase()
                  : 'Free'}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your subscription, view invoices, and upgrade your plan.
            </p>
          </div>
          <button
            onClick={() => router.push(`/teams/${teamId}/billing`)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition shrink-0"
          >
            Manage Plan
          </button>
        </div>
      </div>

      {/* Location Reply Settings */}
      {locations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-gray-500 text-sm">
            No locations found for this team. Add a location first.
          </p>
        </div>
      ) : (
        locations.map((loc) => {
          const form = forms[loc.id]
          if (!form) return null
          const dirty = isLocationDirty(loc.id)
          const saving = savingLocation[loc.id] ?? false
          const status = locationStatus[loc.id] ?? 'idle'

          return (
            <div
              key={loc.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
            >
              {/* Card header */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{loc.name}</h2>
                {loc.address && (
                  <p className="text-sm text-gray-500 mt-0.5">{loc.address}</p>
                )}
              </div>

              {/* Overall Tone & Style */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Overall Tone &amp; Style
                </label>
                <textarea
                  rows={3}
                  value={form.brand_voice}
                  onChange={(e) =>
                    updateLocationForm(loc.id, { brand_voice: e.target.value })
                  }
                  placeholder="e.g., friendly and professional"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y"
                />
              </div>

              {/* Negative Sentiment Rules */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Negative Sentiment Rules
                </label>
                <textarea
                  rows={3}
                  value={form.negative_sentiment}
                  onChange={(e) =>
                    updateLocationForm(loc.id, {
                      negative_sentiment: e.target.value,
                    })
                  }
                  placeholder="e.g., Acknowledge concerns empathetically..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y"
                />
              </div>

              {/* Reply Language */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Reply Language
                </label>
                <select
                  value={form.reply_language}
                  onChange={(e) =>
                    updateLocationForm(loc.id, { reply_language: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reply Signature */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reply Signature
                </label>
                <div className="flex flex-wrap gap-4">
                  {(
                    ['store_name', 'team_name', 'user_name', 'custom'] as SignatureType[]
                  ).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`sig-${loc.id}`}
                        checked={form.signature_type === type}
                        onChange={() =>
                          updateLocationForm(loc.id, { signature_type: type })
                        }
                        className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">
                        {SIGNATURE_LABELS[type]}
                      </span>
                    </label>
                  ))}
                </div>
                {form.signature_type === 'custom' && (
                  <input
                    type="text"
                    value={form.signature_custom}
                    onChange={(e) =>
                      updateLocationForm(loc.id, {
                        signature_custom: e.target.value,
                      })
                    }
                    placeholder="Enter custom signature"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition mt-1"
                  />
                )}
              </div>

              {/* Save button + status */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSaveLocation(loc.id)}
                  disabled={!dirty || saving}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {status === 'saved' && (
                  <span className="text-sm text-teal-600 font-medium">Saved</span>
                )}
                {status === 'error' && (
                  <span className="text-sm text-red-600 font-medium">
                    Failed to save. Please try again.
                  </span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
