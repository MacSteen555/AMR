'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type GoogleLocation = {
  account_id: string
  location_id: string
  location_name: string
  address: any
  account_name?: string
  primary_category?: string | null
}

type CalibrationReview = {
  index: number
  stars: number
  dimension: string
  reviewer_name: string
  comment: string | null
  reply_a: string
  reply_b: string
}

type CalibrationData = {
  reviews: CalibrationReview[]
  business_type: string
}

const STEPS = [
  { id: 1, label: 'Name Your Team', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
  { id: 2, label: 'Add Locations', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></> },
  { id: 3, label: 'Set Brand Voice', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /> },
]

/* ─── Step Indicator ─── */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-12">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center relative">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                currentStep > step.id
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-200/50'
                  : currentStep === step.id
                    ? 'bg-white border-2 border-teal-600 text-teal-600 shadow-lg shadow-teal-200/50'
                    : 'bg-gray-100 border-2 border-gray-200 text-gray-400'
              }`}
            >
              {currentStep > step.id ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{step.icon}</svg>
              )}
            </div>
            <span className={`mt-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-300 ${
              currentStep >= step.id ? 'text-teal-600' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className="w-24 h-0.5 mx-4 mt-[-20px] rounded-full overflow-hidden bg-gray-200">
              <div className={`h-full bg-teal-600 transition-all duration-500 ${
                currentStep > step.id ? 'w-full' : 'w-0'
              }`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Star Rating ─── */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-4 h-4 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function NewTeamPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [step, setStep] = useState(1)

  const [teamName, setTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([])
  const [importingLocations, setImportingLocations] = useState(false)
  const [importedLocationIds, setImportedLocationIds] = useState<{ id: string; name: string }[]>([])

  const [currentLocationIdx, setCurrentLocationIdx] = useState(0)

  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [loadingCalibration, setLoadingCalibration] = useState(false)
  const [picks, setPicks] = useState<Record<number, 'a' | 'b'>>({})
  const [currentReviewIdx, setCurrentReviewIdx] = useState(0)
  const [negativeContactEmail, setNegativeContactEmail] = useState('')
  const [calibrationStep, setCalibrationStep] = useState<'picking' | 'email' | 'review'>('picking')
  const [generatedVoice, setGeneratedVoice] = useState('')
  const [savingCalibration, setSavingCalibration] = useState(false)

  /* ─── Step 1 ─── */
  const handleCreateTeam = async () => {
    if (!teamName.trim()) { setError('Team name is required'); return }
    try {
      setCreatingTeam(true); setError(null)
      const result = await apiPost<{ team: { id: string } }>('/api/teams', { name: teamName })
      setTeamId(result.team.id)
      refresh().catch(() => { /* AppShell will update on next navigation */ })
      setStep(2)
      loadGoogleLocations()
    } catch (err: any) { setError(err.message || 'Failed to create team') }
    finally { setCreatingTeam(false) }
  }

  /* ─── Step 2 ─── */
  const loadGoogleLocations = async () => {
    setLoadingLocations(true)
    try {
      const data = await apiGet<{ locations: GoogleLocation[] }>('/api/google/entitlements/locations')
      setGoogleLocations(data.locations)
    } catch (err: any) { setError(err.message || 'Failed to load Google locations') }
    finally { setLoadingLocations(false) }
  }

  const handleToggleLocation = (id: string) => {
    setSelectedGoogleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleImportLocations = async () => {
    if (selectedGoogleIds.length === 0 || !teamId) return
    try {
      setImportingLocations(true); setError(null)
      const selectedLocs = googleLocations.filter(l => selectedGoogleIds.includes(l.location_id))
      const accountId = selectedLocs[0]?.account_id
      const result = await apiPost<{ locations: { id: string; name: string }[] }>(
        `/api/teams/${teamId}/locations/import`,
        { account_id: accountId, google_location_ids: selectedGoogleIds }
      )
      setImportedLocationIds(result.locations)
      setStep(3)
      if (result.locations.length > 0) {
        loadCalibration(result.locations[0].id)
        apiPost(`/api/teams/${teamId}/reviews/sync`, {}).catch(err => console.error('Background sync failed:', err))
      }
    } catch (err: any) { setError(err.message || 'Failed to import locations') }
    finally { setImportingLocations(false) }
  }

  /* ─── Step 3 ─── */
  const loadCalibration = async (locationId: string) => {
    setLoadingCalibration(true)
    setCalibrationData(null)
    setPicks({})
    setCurrentReviewIdx(0)
    setCalibrationStep('picking')
    try {
      const data = await apiPost<CalibrationData>('/api/onboarding/generate-calibration', { location_id: locationId })
      setCalibrationData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate calibration reviews')
    } finally {
      setLoadingCalibration(false)
    }
  }

  const handleSaveCalibration = async () => {
    if (!teamId || importedLocationIds.length === 0) return
    const currentLoc = importedLocationIds[currentLocationIdx]
    if (!currentLoc) return

    if (calibrationStep === 'picking') {
      setCalibrationStep('email')
      return
    }

    if (calibrationStep === 'email') {
      try {
        setSavingCalibration(true); setError(null)
        const picksArray = calibrationData!.reviews.map((review) => ({
          review_index: review.index,
          dimension: review.dimension,
          choice: picks[review.index],
        }))
        const result = await apiPost<{ brand_voice: string }>('/api/onboarding/save-calibration', {
          location_id: currentLoc.id,
          picks: picksArray,
          negative_contact_email: negativeContactEmail.trim() || null,
          business_type: calibrationData!.business_type,
        })
        setGeneratedVoice(result.brand_voice)
        setCalibrationStep('review')
      } catch (err: any) { setError(err.message || 'Failed to generate brand voice') }
      finally { setSavingCalibration(false) }
      return
    }

    if (calibrationStep === 'review') {
      try {
        setSavingCalibration(true); setError(null)
        await apiPatch(`/api/teams/${teamId}/locations/${currentLoc.id}`, {
          brand_voice: generatedVoice,
        })
        if (currentLocationIdx < importedLocationIds.length - 1) {
          const nextIdx = currentLocationIdx + 1
          setCurrentLocationIdx(nextIdx)
          loadCalibration(importedLocationIds[nextIdx].id)
        } else {
          router.push('/teams'); router.refresh()
        }
      } catch (err: any) { setError(err.message || 'Failed to save brand voice') }
      finally { setSavingCalibration(false) }
    }
  }

  const currentLocation = importedLocationIds[currentLocationIdx]
  const allPicked = calibrationData ? calibrationData.reviews.every(r => picks[r.index] !== undefined) : false

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Back button */}
        <button
          onClick={() => step === 1 ? router.back() : setStep(step - 1)}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-700 mb-8 transition-colors group cursor-pointer"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{step === 1 ? 'Back to Teams' : 'Previous Step'}</span>
        </button>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 max-w-2xl mx-auto" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ═══════ STEP 1: Team Name ═══════ */}
        {step === 1 && (
          <div className="max-w-lg mx-auto" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-2xl mb-5 shadow-sm">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Create Your Team</h1>
              <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                A team groups your business locations together so you can manage reviews, configure brand voice, and collaborate with members.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <label htmlFor="teamName" className="block text-sm font-semibold text-gray-700 mb-2">
                Team Name
              </label>
              <input
                type="text"
                id="teamName"
                value={teamName}
                onChange={(e) => { setTeamName(e.target.value); setError(null) }}
                placeholder="e.g., Downtown Restaurants, My Dental Group"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 text-lg transition-all bg-gray-50 focus:bg-white"
                disabled={creatingTeam}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              />
              <p className="mt-2 text-xs text-gray-400">Usually the name of your business or business group.</p>

              <button
                onClick={handleCreateTeam}
                disabled={creatingTeam || !teamName.trim()}
                className="mt-6 w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {creatingTeam ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Team...
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Helpful context below the card */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Multi-location', desc: 'Group all your spots' },
                { label: 'Team access', desc: 'Invite your staff' },
                { label: 'Separate billing', desc: 'Per-team plans' },
              ].map((item, i) => (
                <div key={i} className="text-center py-3">
                  <div className="text-xs font-semibold text-gray-700">{item.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ STEP 2: Select Locations ═══════ */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-2xl mb-5 shadow-sm">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Add Your Locations</h1>
              <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                Select the Google Business locations you want to manage reviews for. You can always add more later.
              </p>
              <button
                onClick={() => { setStep(3); if (importedLocationIds.length > 0) loadCalibration(importedLocationIds[0].id) }}
                className="mt-3 text-sm text-gray-400 hover:text-teal-600 font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                Skip for now
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingLocations ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="w-12 h-12 border-4 border-teal-100 rounded-full" />
                    <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Loading your Google locations...</p>
                  <p className="text-gray-400 text-xs mt-1">This may take a moment</p>
                </div>
              ) : googleLocations.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-gray-800 font-semibold mb-1">No Google locations found</h3>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto">
                    Make sure you&apos;ve connected a Google account with Business Profile access.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <span className="font-bold text-teal-600">{selectedGoogleIds.length}</span>
                      <span className="text-gray-400"> / {googleLocations.length} selected</span>
                    </p>
                    <button
                      onClick={() => setSelectedGoogleIds(selectedGoogleIds.length === googleLocations.length ? [] : googleLocations.map(l => l.location_id))}
                      className="text-sm text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
                    >
                      {selectedGoogleIds.length === googleLocations.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {googleLocations.map((loc) => {
                      const isSelected = selectedGoogleIds.includes(loc.location_id)
                      return (
                        <div
                          key={loc.location_id}
                          className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-teal-50/60' : 'hover:bg-gray-50'}`}
                          onClick={() => handleToggleLocation(loc.location_id)}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-300'}`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-900' : 'text-gray-900'}`}>{loc.location_name}</p>
                            <p className="text-xs text-gray-500 truncate">{loc.address?.addressLines?.join(', ') || 'No address'}</p>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{loc.account_name}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {googleLocations.length > 0 && (
                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80 flex justify-end gap-3">
                  <button
                    onClick={handleImportLocations}
                    disabled={importingLocations || selectedGoogleIds.length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm cursor-pointer"
                  >
                    {importingLocations ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing...</>
                    ) : (
                      <>Import & Continue<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* GBP Permissions Help */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4.5 h-4.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 mb-1">Not seeing your business?</h4>
                  <p className="text-sm text-amber-800 leading-relaxed mb-2">
                    When signing in to AutoMyReply, you must click <strong>Allow</strong> on the Google consent screen to grant access to your Business Profile. If you skipped this step, sign out and sign back in.
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed mb-2">
                    You also need <strong>Owner</strong> or <strong>Manager</strong> access on the Google Business Profile. If you don&apos;t have it, ask the profile owner to add you:
                  </p>
                </div>
              </div>
              <ol className="ml-11 space-y-1.5 text-sm text-amber-800">
                <li>1. Sign in at <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 underline hover:text-teal-900 font-medium">business.google.com</a> with the Google account that owns the profile.</li>
                <li>2. Search for the business name in the Google search bar.</li>
                <li>3. Click the 3 vertical dots next to the business name and go to <strong>Business Profile Settings</strong>.</li>
                <li>4. Click <strong>People and access</strong>, then hit the blue <strong>Add</strong> button.</li>
                <li>5. Enter the email and choose <strong>Owner</strong> or <strong>Manager</strong>, then click <strong>Invite</strong>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ═══════ STEP 3: Brand Voice ═══════ */}
        {step === 3 && (
          <div style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-2xl mb-5 shadow-sm">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Configure Brand Voice</h1>
              <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Pick the reply you prefer for each review. We&apos;ll use your choices to calibrate the AI&apos;s tone.
              </p>
              <button
                onClick={() => { router.push('/teams'); router.refresh() }}
                className="mt-3 text-sm text-gray-400 hover:text-teal-600 font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                Skip — use defaults
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {importedLocationIds.length > 1 && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-full border border-teal-100">
                  <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="text-sm text-teal-700 font-semibold">
                    Location {currentLocationIdx + 1} of {importedLocationIds.length}:
                  </span>
                  <span className="text-sm text-teal-600">{currentLocation?.name}</span>
                </div>
              )}
            </div>

            {loadingCalibration ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative w-16 h-16 mb-6">
                  <div className="w-16 h-16 border-4 border-teal-100 rounded-full" />
                  <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                </div>
                <p className="text-gray-700 font-medium">Generating calibration reviews...</p>
                <p className="text-gray-400 text-sm mt-1">for {currentLocation?.name}</p>
              </div>
            ) : calibrationData ? (
              <div className="space-y-8">

                {/* ── Sub-view: picking (one at a time) ── */}
                {calibrationStep === 'picking' && calibrationData.reviews[currentReviewIdx] && (
                  <div key={currentReviewIdx} style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                      {calibrationData.reviews.map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            i === currentReviewIdx
                              ? 'w-8 bg-teal-500'
                              : picks[i] !== undefined
                                ? 'w-2 bg-teal-300'
                                : 'w-2 bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="max-w-2xl mx-auto">
                      <CalibrationCard
                        review={calibrationData.reviews[currentReviewIdx]}
                        pick={picks[currentReviewIdx] ?? null}
                        onPick={(choice) => {
                          setPicks(prev => ({ ...prev, [currentReviewIdx]: choice }))
                          // Auto-advance after a short delay
                          setTimeout(() => {
                            if (currentReviewIdx < calibrationData!.reviews.length - 1) {
                              setCurrentReviewIdx(prev => prev + 1)
                            }
                          }, 400)
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-6 pb-8 max-w-2xl mx-auto">
                      <button
                        onClick={() => setCurrentReviewIdx(prev => prev - 1)}
                        disabled={currentReviewIdx === 0}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors cursor-pointer disabled:opacity-0 disabled:cursor-default"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </button>

                      <span className="text-xs text-gray-400 font-medium">
                        {currentReviewIdx + 1} of {calibrationData.reviews.length}
                      </span>

                      {currentReviewIdx < calibrationData.reviews.length - 1 ? (
                        <button
                          onClick={() => setCurrentReviewIdx(prev => prev + 1)}
                          disabled={picks[currentReviewIdx] === undefined}
                          className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={handleSaveCalibration}
                          disabled={!allPicked}
                          className="group px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer text-sm"
                        >
                          Continue
                          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Sub-view: email ── */}
                {calibrationStep === 'email' && (
                  <div className="max-w-lg mx-auto">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Contact Email for Negative Reviews</h3>
                          <p className="text-sm text-gray-500">Optional — include an email in replies to unhappy customers so they can reach you directly.</p>
                        </div>
                      </div>
                      <input
                        type="email"
                        value={negativeContactEmail}
                        onChange={(e) => setNegativeContactEmail(e.target.value)}
                        placeholder="support@yourbusiness.com"
                        className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 text-sm transition-all bg-gray-50 focus:bg-white"
                      />
                      <p className="mt-2 text-xs text-gray-400">Leave blank to skip — you can always add one later in location settings.</p>
                    </div>

                    <div className="flex justify-between items-center pt-6 pb-8">
                      <button
                        onClick={() => setCalibrationStep('picking')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>
                      <button
                        onClick={handleSaveCalibration}
                        disabled={savingCalibration}
                        className="group px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {savingCalibration ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                        ) : (
                          <>
                            Generate Brand Voice
                            <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Sub-view: review ── */}
                {calibrationStep === 'review' && (
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                          <svg className="w-4.5 h-4.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">Your Brand Voice Prompt</h3>
                          <p className="text-xs text-gray-500">Generated from your picks. Feel free to edit before saving.</p>
                        </div>
                      </div>
                      <div className="p-6">
                        <textarea
                          value={generatedVoice}
                          onChange={e => setGeneratedVoice(e.target.value)}
                          className="w-full p-3.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all min-h-[160px]"
                          placeholder="Your brand voice prompt..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 pb-8">
                      <button
                        onClick={() => setCalibrationStep('email')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>
                      <button
                        onClick={handleSaveCalibration}
                        disabled={savingCalibration || !generatedVoice.trim()}
                        className="group px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {savingCalibration ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                        ) : currentLocationIdx < importedLocationIds.length - 1 ? (
                          <>Save & Next Location<svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                        ) : (
                          <>Save & Finish Setup<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ) : importedLocationIds.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <h3 className="text-gray-800 font-semibold mb-2">No locations imported yet</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">You can configure brand voice after importing locations from the Teams page.</p>
                <button
                  onClick={() => { router.push('/teams'); router.refresh() }}
                  className="px-6 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  Go to Teams
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CALIBRATION CARD (A/B pick per review)
   ═══════════════════════════════════════════════════════════════ */
function CalibrationCard({ review, pick, onPick }: {
  review: CalibrationReview
  pick: 'a' | 'b' | null
  onPick: (choice: 'a' | 'b') => void
}) {
  const starBg = review.stars >= 4 ? 'bg-emerald-50 border-emerald-100' : review.stars === 3 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Review header with avatar, name, stars, comment */}
      <div className={`px-6 py-4 ${starBg} border-b`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/80 rounded-full flex items-center justify-center font-bold text-sm text-gray-700 shadow-sm">
            {review.reviewer_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</span>
              <StarRating rating={review.stars} />
            </div>
            {review.comment ? (
              <p className="text-gray-600 text-sm mt-1">&ldquo;{review.comment}&rdquo;</p>
            ) : (
              <p className="text-gray-400 text-sm mt-1 italic">Rating only, no written review</p>
            )}
          </div>
        </div>
      </div>

      {/* Two reply options side by side */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['a', 'b'] as const).map((choice) => {
          const isSelected = pick === choice
          const replyText = choice === 'a' ? review.reply_a : review.reply_b
          return (
            <button
              key={choice}
              onClick={() => onPick(choice)}
              className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500/20'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-teal-600' : 'text-gray-400'}`}>
                  Option {choice.toUpperCase()}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{replyText}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
