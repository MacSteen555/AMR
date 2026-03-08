'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, apiGet, apiPatch } from '@/lib/api'

type GoogleLocation = {
  account_id: string
  location_id: string
  location_name: string
  address: any
  account_name?: string
}

type SampleReviews = {
  positive_review: {
    reviewer_name: string
    rating: number
    text: string
    replies: { professional: string; friendly: string; witty: string }
  }
  negative_review: {
    reviewer_name: string
    rating: number
    text: string
    replies: { professional: string; friendly: string; witty: string }
  }
}

type BrandVoiceOption = 'professional' | 'friendly' | 'witty'

const STEPS = [
  { id: 1, label: 'Name Your Team', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
  { id: 2, label: 'Add Locations', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></> },
  { id: 3, label: 'Set Brand Voice', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /> },
]

const VOICE_OPTIONS: { value: BrandVoiceOption; label: string; desc: string }[] = [
  { value: 'professional', label: 'Professional', desc: 'Formal, polished, and business-appropriate' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, conversational, and approachable' },
  { value: 'witty', label: 'Witty', desc: 'Clever, fun, and personality-forward' },
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

/* ─── Voice Selector Pill ─── */
function VoicePill({ voice, selected, onClick, color }: {
  voice: typeof VOICE_OPTIONS[number]; selected: boolean; onClick: () => void; color: 'green' | 'red'
}) {
  const activeClasses = color === 'green'
    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
    : 'bg-red-50 border-red-300 text-red-800 shadow-sm'
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer ${
        selected ? activeClasses : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {voice.label}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function NewTeamPage() {
  const router = useRouter()
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
  const [sampleReviews, setSampleReviews] = useState<SampleReviews | null>(null)
  const [loadingSamples, setLoadingSamples] = useState(false)

  const reviewCacheRef = useRef<Record<string, SampleReviews>>({})
  const activeFetchesRef = useRef<Record<string, Promise<SampleReviews>>>({})

  const [positiveVoice, setPositiveVoice] = useState<BrandVoiceOption>('friendly')
  const [negativeVoice, setNegativeVoice] = useState<BrandVoiceOption>('professional')
  const [positiveReplyText, setPositiveReplyText] = useState('')
  const [negativeReplyText, setNegativeReplyText] = useState('')
  const [positiveOriginal, setPositiveOriginal] = useState('')
  const [negativeOriginal, setNegativeOriginal] = useState('')

  const [brandVoice, setBrandVoice] = useState('Professional and friendly')
  const [negativeSentiment, setNegativeSentiment] = useState('Use a professional tone for negative reviews. Acknowledge concerns empathetically and offer to make things right.')
  const [userEditedPrompt, setUserEditedPrompt] = useState(false)
  const [isInferringPrompt, setIsInferringPrompt] = useState(false)
  const [savingBrandVoice, setSavingBrandVoice] = useState(false)

  /* ─── Step 1 ─── */
  const handleCreateTeam = async () => {
    if (!teamName.trim()) { setError('Team name is required'); return }
    try {
      setCreatingTeam(true); setError(null)
      const result = await apiPost<{ team: { id: string } }>('/api/teams', { name: teamName })
      setTeamId(result.team.id)
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
        loadSampleReviews(result.locations[0].name)
        apiPost(`/api/teams/${teamId}/reviews/sync`, {}).catch(err => console.error('Background sync failed:', err))
      }
    } catch (err: any) { setError(err.message || 'Failed to import locations') }
    finally { setImportingLocations(false) }
  }

  /* ─── Step 3 ─── */
  const loadSampleReviews = async (locationName: string, isBackground = false) => {
    if (reviewCacheRef.current[locationName]) {
      if (!isBackground) initializeBrandVoiceUI(reviewCacheRef.current[locationName])
      return
    }
    if (!isBackground) { setLoadingSamples(true); setSampleReviews(null) }
    try {
      let fetchPromise = activeFetchesRef.current[locationName]
      if (!fetchPromise) {
        fetchPromise = apiPost<SampleReviews>('/api/onboarding/generate-sample-reviews', { location_name: locationName })
        activeFetchesRef.current[locationName] = fetchPromise
      }
      const data = await fetchPromise
      reviewCacheRef.current[locationName] = data
      if (!isBackground) initializeBrandVoiceUI(data)
    } catch (err: any) { if (!isBackground) setError(err.message || 'Failed to generate sample reviews') }
    finally { delete activeFetchesRef.current[locationName]; if (!isBackground) setLoadingSamples(false) }
  }

  const initializeBrandVoiceUI = (data: SampleReviews) => {
    setSampleReviews(data)
    const initPos: BrandVoiceOption = 'friendly', initNeg: BrandVoiceOption = 'professional'
    setPositiveVoice(initPos); setNegativeVoice(initNeg)
    setPositiveReplyText(data.positive_review.replies[initPos])
    setNegativeReplyText(data.negative_review.replies[initNeg])
    setPositiveOriginal(data.positive_review.replies[initPos])
    setNegativeOriginal(data.negative_review.replies[initNeg])
    if (!userEditedPrompt) {
      setBrandVoice(`${initPos} and ${initNeg}`)
      setNegativeSentiment(`Use a ${initNeg} tone for negative reviews. Acknowledge concerns empathetically and offer to make things right.`)
    }
  }

  useEffect(() => {
    if (step === 3 && importedLocationIds.length > 0) {
      const nextLoc = importedLocationIds[currentLocationIdx + 1]
      if (nextLoc && !reviewCacheRef.current[nextLoc.name] && !activeFetchesRef.current[nextLoc.name]) {
        loadSampleReviews(nextLoc.name, true)
      }
    }
  }, [step, currentLocationIdx, importedLocationIds])

  const handleSelectPositiveVoice = (voice: BrandVoiceOption) => {
    setPositiveVoice(voice)
    if (sampleReviews) { setPositiveReplyText(sampleReviews.positive_review.replies[voice]); setPositiveOriginal(sampleReviews.positive_review.replies[voice]) }
    if (!userEditedPrompt) updateOpinionPrompt(voice, negativeVoice)
  }

  const handleSelectNegativeVoice = (voice: BrandVoiceOption) => {
    setNegativeVoice(voice)
    if (sampleReviews) { setNegativeReplyText(sampleReviews.negative_review.replies[voice]); setNegativeOriginal(sampleReviews.negative_review.replies[voice]) }
    if (!userEditedPrompt) updateOpinionPrompt(positiveVoice, voice)
  }

  const updateOpinionPrompt = (posVoice: string, negVoice: string) => {
    setBrandVoice(`${posVoice} and ${negVoice}`)
    setNegativeSentiment(`Use a ${negVoice} tone for negative reviews. Acknowledge concerns empathetically and offer to make things right.`)
  }

  const handleInferPromptFromReplies = async () => {
    try {
      setIsInferringPrompt(true); setError(null)
      const [posRes, negRes] = await Promise.all([
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>('/api/onboarding/extract-brand-voice', { original_reply: positiveOriginal, edited_reply: positiveReplyText, sentiment_type: 'positive', selected_voice: positiveVoice }),
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>('/api/onboarding/extract-brand-voice', { original_reply: negativeOriginal, edited_reply: negativeReplyText, sentiment_type: 'negative', selected_voice: negativeVoice }),
      ])
      setBrandVoice(posRes.brand_voice_prompt !== negRes.brand_voice_prompt ? `${posRes.brand_voice_prompt} ${negRes.brand_voice_prompt}` : posRes.brand_voice_prompt)
      setNegativeSentiment(negRes.sentiment_prompt)
      setUserEditedPrompt(true)
      setPositiveOriginal(positiveReplyText)
      setNegativeOriginal(negativeReplyText)
    } catch (err: any) { setError(err.message || 'Failed to infer brand voice') }
    finally { setIsInferringPrompt(false) }
  }

  const handleSaveBrandVoice = async () => {
    if (!teamId || importedLocationIds.length === 0) return
    const currentLocation = importedLocationIds[currentLocationIdx]
    if (!currentLocation) return
    try {
      setSavingBrandVoice(true); setError(null)
      await apiPatch(`/api/teams/${teamId}/locations/${currentLocation.id}`, {
        brand_voice: brandVoice, positive_sentiment: '', negative_sentiment: negativeSentiment, reply_language: 'en',
      })
      if (currentLocationIdx < importedLocationIds.length - 1) {
        const nextIdx = currentLocationIdx + 1
        setCurrentLocationIdx(nextIdx)
        loadSampleReviews(importedLocationIds[nextIdx].name)
      } else {
        router.push('/teams'); router.refresh()
      }
    } catch (err: any) { setError(err.message || 'Failed to save brand voice') }
    finally { setSavingBrandVoice(false) }
  }

  const currentLocation = importedLocationIds[currentLocationIdx]
  const posEdited = positiveReplyText !== positiveOriginal
  const negEdited = negativeReplyText !== negativeOriginal

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
                onClick={() => { setStep(3); if (importedLocationIds.length > 0) loadSampleReviews(importedLocationIds[0].name) }}
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
                Choose how your AI replies sound for positive and negative reviews. Edit the sample replies below to teach the AI your exact style.
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

            {loadingSamples ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative w-16 h-16 mb-6">
                  <div className="w-16 h-16 border-4 border-teal-100 rounded-full" />
                  <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                </div>
                <p className="text-gray-700 font-medium">Drafting sample reviews...</p>
                <p className="text-gray-400 text-sm mt-1">for {currentLocation?.name}</p>
              </div>
            ) : sampleReviews ? (
              <div className="space-y-8">
                {/* Review columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Positive */}
                  <ReviewColumn
                    type="positive"
                    review={sampleReviews.positive_review}
                    voice={positiveVoice}
                    replyText={positiveReplyText}
                    isEdited={posEdited}
                    onSelectVoice={handleSelectPositiveVoice}
                    onChangeReply={setPositiveReplyText}
                    onSave={handleInferPromptFromReplies}
                    isSaving={isInferringPrompt}
                  />
                  {/* Negative */}
                  <ReviewColumn
                    type="negative"
                    review={sampleReviews.negative_review}
                    voice={negativeVoice}
                    replyText={negativeReplyText}
                    isEdited={negEdited}
                    onSelectVoice={handleSelectNegativeVoice}
                    onChangeReply={setNegativeReplyText}
                    onSave={handleInferPromptFromReplies}
                    isSaving={isInferringPrompt}
                  />
                </div>

                {/* Brand Prompt */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Your Brand Prompt</h3>
                      <p className="text-xs text-gray-500">Auto-updated when you save edits above. You can also edit directly.</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overall Tone & Style</label>
                      <textarea
                        value={brandVoice}
                        onChange={e => { setBrandVoice(e.target.value); setUserEditedPrompt(true) }}
                        className="w-full p-3.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all min-h-[80px]"
                        placeholder="General instructions for your brand voice..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Negative Review Rules</label>
                      <textarea
                        value={negativeSentiment}
                        onChange={e => { setNegativeSentiment(e.target.value); setUserEditedPrompt(true) }}
                        className="w-full p-3.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all min-h-[100px]"
                        placeholder="Specific instructions for how to respond to negative reviews..."
                      />
                    </div>
                  </div>
                </div>

                {/* Final CTA */}
                <div className="flex justify-end items-center pt-2 pb-8">
                  <button
                    onClick={handleSaveBrandVoice}
                    disabled={savingBrandVoice || (!brandVoice.trim() && !negativeSentiment.trim())}
                    className="group px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  >
                    {savingBrandVoice ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                    ) : currentLocationIdx < importedLocationIds.length - 1 ? (
                      <>Save & Next Location<svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                    ) : (
                      <>Save & Finish Setup<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>
                    )}
                  </button>
                </div>
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
   REVIEW COLUMN (positive / negative)
   ═══════════════════════════════════════════════════════════════ */
function ReviewColumn({ type, review, voice, replyText, isEdited, onSelectVoice, onChangeReply, onSave, isSaving }: {
  type: 'positive' | 'negative'
  review: { reviewer_name: string; rating: number; text: string; replies: Record<string, string> }
  voice: BrandVoiceOption
  replyText: string
  isEdited: boolean
  onSelectVoice: (v: BrandVoiceOption) => void
  onChangeReply: (text: string) => void
  onSave: () => void
  isSaving: boolean
}) {
  const isPos = type === 'positive'
  const headerBg = isPos ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
  const headerText = isPos ? 'text-emerald-800' : 'text-red-800'
  const borderColor = isPos ? 'border-l-emerald-300' : 'border-l-red-300'
  const ringColor = isPos ? 'focus:ring-emerald-500' : 'focus:ring-red-500'
  const avatarBg = isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
  const editedBg = isPos ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
  const editedText = isPos ? 'text-emerald-700' : 'text-red-700'
  const saveBtnBg = isPos ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
  const dotColor = isPos ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-5 py-3 ${headerBg} border-b flex items-center gap-2`}>
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className={`text-sm font-semibold ${headerText}`}>{isPos ? 'Positive Review' : 'Negative Review'}</span>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {/* Review */}
        <div className="flex gap-3.5 mb-6">
          <div className={`w-10 h-10 ${avatarBg} rounded-full flex items-center justify-center font-bold text-sm shrink-0`}>
            {review.reviewer_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</span>
              <StarRating rating={review.rating} />
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">&ldquo;{review.text}&rdquo;</p>
          </div>
        </div>

        {/* Reply section */}
        <div className={`pl-4 border-l-[3px] ${borderColor} ml-4 flex-1 flex flex-col`}>
          {/* Tone selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Tone</span>
            {VOICE_OPTIONS.map(v => (
              <VoicePill key={v.value} voice={v} selected={voice === v.value} onClick={() => onSelectVoice(v.value)} color={isPos ? 'green' : 'red'} />
            ))}
          </div>

          {/* Editable reply */}
          <label className="sr-only">Your Reply</label>
          <textarea
            value={replyText}
            onChange={e => onChangeReply(e.target.value)}
            className={`w-full flex-1 p-3.5 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 ${ringColor} focus:border-transparent transition-all resize-none min-h-[140px]`}
            placeholder="Edit the reply to match your voice..."
          />

          {/* Edit hint bar */}
          <div className={`mt-3 flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 ${isEdited ? editedBg : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              {isEdited ? (
                <svg className={`w-4 h-4 ${editedText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className={`text-xs font-medium ${isEdited ? editedText : 'text-gray-500'}`}>
                {isEdited ? 'Save to update the AI\'s brand voice' : 'Edit the reply to teach the AI your style'}
              </span>
            </div>
            <button
              onClick={onSave}
              disabled={isSaving || !isEdited}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                isEdited
                  ? `${saveBtnBg} text-white shadow-sm disabled:opacity-60`
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSaving ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving</>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
