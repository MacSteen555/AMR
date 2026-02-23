'use client'

import { AppShell } from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, apiGet, apiPatch } from '@/lib/api'

// ── Types ──

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

// ── Step indicator ──

const STEPS = [
  { id: 1, label: 'Name Your Team' },
  { id: 2, label: 'Add Locations' },
  { id: 3, label: 'Set Brand Voice' },
]

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                currentStep > step.id
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : currentStep === step.id
                  ? 'bg-white border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-200'
                  : 'bg-gray-100 border-gray-300 text-gray-400'
              }`}
            >
              {currentStep > step.id ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.id
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium whitespace-nowrap ${
                currentStep >= step.id ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-20 h-0.5 mx-3 mt-[-18px] transition-colors duration-300 ${
                currentStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Star rating component ──

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ── Main Page ──

export default function NewTeamPage() {
  const router = useRouter()

  // Wizard step
  const [step, setStep] = useState(1)

  // Step 1: Team Name
  const [teamName, setTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 2: Locations
  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([])
  const [importingLocations, setImportingLocations] = useState(false)
  const [importedLocationIds, setImportedLocationIds] = useState<{ id: string; name: string }[]>([])

  // Step 3: Brand Voice
  const [currentLocationIdx, setCurrentLocationIdx] = useState(0)
  const [sampleReviews, setSampleReviews] = useState<SampleReviews | null>(null)
  const [loadingSamples, setLoadingSamples] = useState(false)

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

  // ── Step 1: Create Team ──

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError('Team name is required')
      return
    }
    try {
      setCreatingTeam(true)
      setError(null)
      const result = await apiPost<{ team: { id: string } }>('/api/teams', { name: teamName })
      setTeamId(result.team.id)
      setStep(2)
      loadGoogleLocations()
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

  // ── Step 2: Load & import locations ──

  const loadGoogleLocations = async () => {
    setLoadingLocations(true)
    try {
      const data = await apiGet<{ locations: GoogleLocation[] }>('/api/google/entitlements/locations')
      setGoogleLocations(data.locations)
    } catch (err: any) {
      setError(err.message || 'Failed to load Google locations')
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleToggleLocation = (id: string) => {
    setSelectedGoogleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleImportLocations = async () => {
    if (selectedGoogleIds.length === 0 || !teamId) return
    try {
      setImportingLocations(true)
      setError(null)
      const selectedLocs = googleLocations.filter((l) => selectedGoogleIds.includes(l.location_id))
      const accountId = selectedLocs[0]?.account_id

      const result = await apiPost<{ locations: { id: string; name: string }[] }>(
        `/api/teams/${teamId}/locations/import`,
        {
          account_id: accountId,
          google_location_ids: selectedGoogleIds,
        }
      )

      setImportedLocationIds(result.locations)
      setStep(3)
      // Load sample reviews for first location
      if (result.locations.length > 0) {
        loadSampleReviews(result.locations[0].name)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import locations')
    } finally {
      setImportingLocations(false)
    }
  }

  // ── Step 3: Brand Voice ──

  const loadSampleReviews = async (locationName: string) => {
    setLoadingSamples(true)
    setSampleReviews(null)
    try {
      const data = await apiPost<SampleReviews>('/api/onboarding/generate-sample-reviews', {
        location_name: locationName,
      })
      setSampleReviews(data)
      
      const initPosVoice = 'friendly'
      const initNegVoice = 'professional'

      setPositiveVoice(initPosVoice)
      setNegativeVoice(initNegVoice)
      
      setPositiveReplyText(data.positive_review.replies[initPosVoice])
      setNegativeReplyText(data.negative_review.replies[initNegVoice])
      setPositiveOriginal(data.positive_review.replies[initPosVoice])
      setNegativeOriginal(data.negative_review.replies[initNegVoice])
      
      if (!userEditedPrompt) {
        setBrandVoice(`${initPosVoice} and ${initNegVoice}`)
        setNegativeSentiment(`Use a ${initNegVoice} tone for negative reviews. Acknowledge concerns empathetically and offer to make things right.`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate sample reviews')
    } finally {
      setLoadingSamples(false)
    }
  }

  // When voice selection changes, update the reply text (and optionally prompt if they haven't edited it)
  const handleSelectPositiveVoice = (voice: BrandVoiceOption) => {
    setPositiveVoice(voice)
    if (sampleReviews) {
      const reply = sampleReviews.positive_review.replies[voice]
      setPositiveReplyText(reply)
      setPositiveOriginal(reply)
    }
    
    if (!userEditedPrompt) {
      updateOpinionPrompt(voice, negativeVoice)
    }
  }

  const handleSelectNegativeVoice = (voice: BrandVoiceOption) => {
    setNegativeVoice(voice)
    if (sampleReviews) {
      const reply = sampleReviews.negative_review.replies[voice]
      setNegativeReplyText(reply)
      setNegativeOriginal(reply)
    }
    
    if (!userEditedPrompt) {
      updateOpinionPrompt(positiveVoice, voice)
    }
  }

  const updateOpinionPrompt = (posVoice: string, negVoice: string) => {
    setBrandVoice(`${posVoice} and ${negVoice}`)
    setNegativeSentiment(`Use a ${negVoice} tone for negative reviews. Acknowledge concerns empathetically and offer to make things right.`)
  }

  // Infer Prompt from their manual edits to the textareas
  const handleInferPromptFromReplies = async () => {
    try {
      setIsInferringPrompt(true)
      setError(null)
      
      const [posRes, negRes] = await Promise.all([
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>('/api/onboarding/extract-brand-voice', {
          original_reply: positiveOriginal,
          edited_reply: positiveReplyText,
          sentiment_type: 'positive',
          selected_voice: positiveVoice,
        }),
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>('/api/onboarding/extract-brand-voice', {
          original_reply: negativeOriginal,
          edited_reply: negativeReplyText,
          sentiment_type: 'negative',
          selected_voice: negativeVoice,
        })
      ])
      
      setBrandVoice(posRes.brand_voice_prompt !== negRes.brand_voice_prompt ? `${posRes.brand_voice_prompt} ${negRes.brand_voice_prompt}` : posRes.brand_voice_prompt)
      setNegativeSentiment(negRes.sentiment_prompt)
      setUserEditedPrompt(true)
    } catch (err: any) {
      setError(err.message || 'Failed to infer brand voice')
    } finally {
      setIsInferringPrompt(false)
    }
  }

  const handleSaveBrandVoice = async () => {
    if (!teamId || importedLocationIds.length === 0) return
    const currentLocation = importedLocationIds[currentLocationIdx]
    if (!currentLocation) return

    try {
      setSavingBrandVoice(true)
      setError(null)

      // Save directly from the separated text areas
      await apiPatch(`/api/teams/${teamId}/locations/${currentLocation.id}`, {
        brand_voice: brandVoice,
        positive_sentiment: '',
        negative_sentiment: negativeSentiment,
        reply_language: 'en',
      })

      // Move to next location or finish
      if (currentLocationIdx < importedLocationIds.length - 1) {
        const nextIdx = currentLocationIdx + 1
        setCurrentLocationIdx(nextIdx)
        loadSampleReviews(importedLocationIds[nextIdx].name)
      } else {
        // All done! Redirect to teams page
        router.push('/teams')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save brand voice')
    } finally {
      setSavingBrandVoice(false)
    }
  }

  const currentLocation = importedLocationIds[currentLocationIdx]

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {/* Back button */}
          <button
            onClick={() => {
              if (step === 1) {
                router.back()
              } else {
                setStep(step - 1)
              }
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{step === 1 ? 'Back to Teams' : 'Previous Step'}</span>
          </button>

          {/* Step indicator */}
          <StepIndicator currentStep={step} />

          {/* Error display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 max-w-4xl mx-auto">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ─── STEP 1: Team Name ─── */}
          {step === 1 && (
            <div className="animate-fadeIn max-w-lg mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Team</h1>
                <p className="text-gray-500 max-w-md mx-auto">
                  A team groups your business locations together so you can manage reviews, set brand voice, and collaborate with your team members.
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 text-lg transition-shadow"
                  disabled={creatingTeam}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                />
                <p className="mt-2 text-xs text-gray-400">
                  Usually the name of your business or business group.
                </p>

                <button
                  onClick={handleCreateTeam}
                  disabled={creatingTeam || !teamName.trim()}
                  className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  {creatingTeam ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating Team...
                    </>
                  ) : (
                    <>
                      Continue
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Select Locations ─── */}
          {step === 2 && (
            <div className="animate-fadeIn max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Your Locations</h1>
                <p className="text-gray-500 max-w-md mx-auto">
                  Select the Google Business locations you want to manage reviews for. You can always add more later.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loadingLocations ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-500 text-sm">Loading your Google locations...</p>
                  </div>
                ) : googleLocations.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl mb-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-gray-700 font-semibold mb-1">No Google locations found</h3>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto">
                      Make sure you&apos;ve connected a Google account with Business Profile access.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">{selectedGoogleIds.length}</span>{' '}
                          of {googleLocations.length} locations selected
                        </p>
                        <button
                          onClick={() =>
                            setSelectedGoogleIds(
                              selectedGoogleIds.length === googleLocations.length
                                ? []
                                : googleLocations.map((l) => l.location_id)
                            )
                          }
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {selectedGoogleIds.length === googleLocations.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                      {googleLocations.map((loc) => {
                        const isSelected = selectedGoogleIds.includes(loc.location_id)
                        return (
                          <div
                            key={loc.location_id}
                            className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleToggleLocation(loc.location_id)}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {loc.location_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {loc.address?.addressLines?.join(', ') || 'No address'}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{loc.account_name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                  <button
                    onClick={handleImportLocations}
                    disabled={importingLocations || selectedGoogleIds.length === 0}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-sm"
                  >
                    {importingLocations ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import & Continue
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Brand Voice Setup ─── */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Configure Brand Voice</h1>
                <p className="text-gray-500 max-w-2xl mx-auto">
                  Select a voice for positive and negative reviews. Edit the replies to match your style exactly.
                  When you're happy, we'll finalize your overall brand instructions.
                </p>
                {importedLocationIds.length > 1 && (
                  <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-sm text-indigo-700 font-medium">
                      Location {currentLocationIdx + 1} of {importedLocationIds.length}: {currentLocation?.name}
                    </span>
                  </div>
                )}
              </div>

              {loadingSamples ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-200 rounded-full" />
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                  </div>
                  <p className="text-gray-500 mt-6 text-sm">Drafting sample reviews for {currentLocation?.name}...</p>
                </div>
              ) : sampleReviews ? (
                <div className="space-y-8">
                  
                  {/* TWO COLUMNS: POSITIVE AND NEGATIVE REVIEWS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LEFT COLUMN: POSITIVE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                      <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                         <span className="text-sm font-semibold text-green-800">Positive Example</span>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        
                        {/* Review Content */}
                        <div className="flex gap-4 mb-6">
                           <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold shrink-0">
                             {sampleReviews.positive_review.reviewer_name.charAt(0)}
                           </div>
                           <div>
                             <p className="font-semibold text-gray-900 text-sm">{sampleReviews.positive_review.reviewer_name}</p>
                             <div className="mt-0.5 mb-1"><StarRating rating={sampleReviews.positive_review.rating} /></div>
                             <p className="text-gray-700 text-sm leading-relaxed">&ldquo;{sampleReviews.positive_review.text}&rdquo;</p>
                           </div>
                        </div>

                        {/* Reply Content */}
                        <div className="pl-4 border-l-2 border-green-200 ml-4 flex-1 flex flex-col">
                           <div className="flex items-center gap-2 mb-3">
                             <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tone</span>
                             <div className="flex bg-gray-100 p-0.5 rounded-lg">
                               {(['professional', 'friendly', 'witty'] as BrandVoiceOption[]).map((voice) => (
                                  <button 
                                    key={voice}
                                    onClick={() => handleSelectPositiveVoice(voice)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${positiveVoice === voice ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                                  </button>
                               ))}
                             </div>
                           </div>
                           
                           <label className="sr-only">Your Reply</label>
                           <textarea
                             value={positiveReplyText}
                             onChange={(e) => setPositiveReplyText(e.target.value)}
                             className="w-full flex-1 p-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors resize-none min-h-[140px]"
                             placeholder="Edit your reply here..."
                           />
                           <p className="text-[11px] text-gray-400 mt-2 text-right">Feel free to edit this reply directly to teach the AI your exact style.</p>
                        </div>

                      </div>
                    </div>

                    {/* RIGHT COLUMN: NEGATIVE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                      <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                         <span className="text-sm font-semibold text-red-800">Negative Example</span>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        
                        {/* Review Content */}
                        <div className="flex gap-4 mb-6">
                           <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold shrink-0">
                             {sampleReviews.negative_review.reviewer_name.charAt(0)}
                           </div>
                           <div>
                             <p className="font-semibold text-gray-900 text-sm">{sampleReviews.negative_review.reviewer_name}</p>
                             <div className="mt-0.5 mb-1"><StarRating rating={sampleReviews.negative_review.rating} /></div>
                             <p className="text-gray-700 text-sm leading-relaxed">&ldquo;{sampleReviews.negative_review.text}&rdquo;</p>
                           </div>
                        </div>

                        {/* Reply Content */}
                        <div className="pl-4 border-l-2 border-red-200 ml-4 flex-1 flex flex-col">
                           <div className="flex items-center gap-2 mb-3">
                             <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tone</span>
                             <div className="flex bg-gray-100 p-0.5 rounded-lg">
                               {(['professional', 'friendly', 'witty'] as BrandVoiceOption[]).map((voice) => (
                                  <button 
                                    key={voice}
                                    onClick={() => handleSelectNegativeVoice(voice)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${negativeVoice === voice ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                                  </button>
                               ))}
                             </div>
                           </div>
                           
                           <label className="sr-only">Your Reply</label>
                           <textarea
                             value={negativeReplyText}
                             onChange={(e) => setNegativeReplyText(e.target.value)}
                             className="w-full flex-1 p-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-none min-h-[140px]"
                             placeholder="Edit your reply here..."
                           />
                           <p className="text-[11px] text-gray-400 mt-2 text-right">Feel free to edit this reply directly to teach the AI your exact style.</p>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* OVERALL BRAND PROMPT SECTION */}
                  <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Your Overall Brand Prompt
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">This is the prompt we will use to generate all your AI review replies. You can edit it now, or let us infer it from any manual edits you made to the replies above.</p>
                      </div>
                      
                      <button
                        onClick={handleInferPromptFromReplies}
                        disabled={isInferringPrompt}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 border border-indigo-100"
                      >
                         {isInferringPrompt ? (
                           <>
                             <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                             Inferring...
                           </>
                         ) : (
                           <>
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                             </svg>
                             Infer from My Edits
                           </>
                         )}
                      </button>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Overall Tone / Style</label>
                        <textarea
                          value={brandVoice}
                          onChange={(e) => { setBrandVoice(e.target.value); setUserEditedPrompt(true) }}
                          className="w-full p-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[80px]"
                          placeholder="General instructions for your brand voice..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Negative Sentiment Rules</label>
                        <textarea
                          value={negativeSentiment}
                          onChange={(e) => { setNegativeSentiment(e.target.value); setUserEditedPrompt(true) }}
                          className="w-full p-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[100px]"
                          placeholder="Specific instructions for how to respond to negative reviews..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save / Continue */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={() => {
                        // Skip brand voice setup
                        if (currentLocationIdx < importedLocationIds.length - 1) {
                          const nextIdx = currentLocationIdx + 1
                          setCurrentLocationIdx(nextIdx)
                          loadSampleReviews(importedLocationIds[nextIdx].name)
                        } else {
                          router.push('/teams')
                          router.refresh()
                        }
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                    >
                      Skip this location
                    </button>
                    <button
                      onClick={handleSaveBrandVoice}
                      disabled={savingBrandVoice || (!brandVoice.trim() && !negativeSentiment.trim())}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                      {savingBrandVoice ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : currentLocationIdx < importedLocationIds.length - 1 ? (
                        <>
                          Save & Next Location
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          Save & Finish Setup
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Custom animation */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </AppShell>
  )
}
