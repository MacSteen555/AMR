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

// ── Brand voice option card ──

function VoiceOptionCard({
  voice,
  label,
  description,
  reply,
  isSelected,
  onSelect,
}: {
  voice: BrandVoiceOption
  label: string
  description: string
  reply: string
  isSelected: boolean
  onSelect: () => void
}) {
  const icons: Record<BrandVoiceOption, JSX.Element> = {
    professional: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    friendly: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    witty: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col p-4 rounded-xl border-2 transition-all duration-200 text-left w-full ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
      }`}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className={isSelected ? 'text-indigo-600' : 'text-gray-500'}>{icons[voice]}</span>
        <span className={`font-semibold text-sm ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
          {label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <div className={`text-sm rounded-lg p-3 ${isSelected ? 'bg-white border border-indigo-200' : 'bg-gray-50 border border-gray-100'}`}>
        <p className="text-gray-700 italic leading-relaxed">&ldquo;{reply}&rdquo;</p>
      </div>
    </button>
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

  const [isEditingPositive, setIsEditingPositive] = useState(false)
  const [isEditingNegative, setIsEditingNegative] = useState(false)

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
      // Default to friendly for positive, professional for negative
      setPositiveVoice('friendly')
      setNegativeVoice('professional')
      setPositiveReplyText(data.positive_review.replies.friendly)
      setNegativeReplyText(data.negative_review.replies.professional)
      setPositiveOriginal(data.positive_review.replies.friendly)
      setNegativeOriginal(data.negative_review.replies.professional)
      setIsEditingPositive(false)
      setIsEditingNegative(false)
    } catch (err: any) {
      setError(err.message || 'Failed to generate sample reviews')
    } finally {
      setLoadingSamples(false)
    }
  }

  // When voice selection changes, update the reply text
  const handleSelectPositiveVoice = (voice: BrandVoiceOption) => {
    setPositiveVoice(voice)
    if (sampleReviews) {
      const reply = sampleReviews.positive_review.replies[voice]
      setPositiveReplyText(reply)
      setPositiveOriginal(reply)
      setIsEditingPositive(false)
    }
  }

  const handleSelectNegativeVoice = (voice: BrandVoiceOption) => {
    setNegativeVoice(voice)
    if (sampleReviews) {
      const reply = sampleReviews.negative_review.replies[voice]
      setNegativeReplyText(reply)
      setNegativeOriginal(reply)
      setIsEditingNegative(false)
    }
  }

  const handleSaveBrandVoice = async () => {
    if (!teamId || importedLocationIds.length === 0) return
    const currentLocation = importedLocationIds[currentLocationIdx]
    if (!currentLocation) return

    try {
      setSavingBrandVoice(true)
      setError(null)

      // Extract brand voice for both positive and negative sentiments
      const [positiveResult, negativeResult] = await Promise.all([
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>(
          '/api/onboarding/extract-brand-voice',
          {
            original_reply: positiveOriginal,
            edited_reply: positiveReplyText,
            sentiment_type: 'positive',
            selected_voice: positiveVoice,
          }
        ),
        apiPost<{ brand_voice_prompt: string; sentiment_prompt: string }>(
          '/api/onboarding/extract-brand-voice',
          {
            original_reply: negativeOriginal,
            edited_reply: negativeReplyText,
            sentiment_type: 'negative',
            selected_voice: negativeVoice,
          }
        ),
      ])

      // Combine brand voice prompts
      const brandVoice = positiveResult.brand_voice_prompt !== negativeResult.brand_voice_prompt
        ? `${positiveResult.brand_voice_prompt} ${negativeResult.brand_voice_prompt}`
        : positiveResult.brand_voice_prompt

      // Save to location
      await apiPatch(`/api/teams/${teamId}/locations/${currentLocation.id}`, {
        brand_voice: brandVoice,
        positive_sentiment: positiveResult.sentiment_prompt,
        negative_sentiment: negativeResult.sentiment_prompt,
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

  const voiceDescriptions: Record<BrandVoiceOption, { label: string; description: string }> = {
    professional: {
      label: 'Professional',
      description: 'Formal, polished, and corporate. Best for law firms, medical offices, and B2B.',
    },
    friendly: {
      label: 'Friendly',
      description: 'Warm, casual, and personable. Ideal for restaurants, retail, and service businesses.',
    },
    witty: {
      label: 'Witty',
      description: 'Clever and lighthearted while staying appropriate. Great for creative brands.',
    },
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-6 py-10">
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
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
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
            <div className="animate-fadeIn">
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

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-lg mx-auto">
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
            <div className="animate-fadeIn">
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

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-2xl mx-auto">
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
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Your Brand Voice</h1>
                <p className="text-gray-500 max-w-lg mx-auto">
                  Choose how you want to sound when replying to reviews. We&apos;ll show you a sample positive and negative review. Pick a voice style and fine-tune the reply if you like.
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
                  <p className="text-gray-500 mt-6 text-sm">Generating sample reviews for {currentLocation?.name}...</p>
                  <p className="text-gray-400 text-xs mt-1">This takes a few seconds</p>
                </div>
              ) : sampleReviews ? (
                <div className="space-y-10">
                  {/* ── POSITIVE REVIEW SECTION ── */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-green-900">Positive Review</h3>
                          <p className="text-xs text-green-600">How should you respond to happy customers?</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Sample review card */}
                      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                            {sampleReviews.positive_review.reviewer_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{sampleReviews.positive_review.reviewer_name}</p>
                            <StarRating rating={sampleReviews.positive_review.rating} />
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed mt-2">
                          &ldquo;{sampleReviews.positive_review.text}&rdquo;
                        </p>
                      </div>

                      {/* Voice options */}
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Choose your reply style:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        {(['professional', 'friendly', 'witty'] as BrandVoiceOption[]).map((voice) => (
                          <VoiceOptionCard
                            key={voice}
                            voice={voice}
                            label={voiceDescriptions[voice].label}
                            description={voiceDescriptions[voice].description}
                            reply={sampleReviews.positive_review.replies[voice]}
                            isSelected={positiveVoice === voice}
                            onSelect={() => handleSelectPositiveVoice(voice)}
                          />
                        ))}
                      </div>

                      {/* Edit reply */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Your Reply</span>
                          {!isEditingPositive ? (
                            <button
                              onClick={() => setIsEditingPositive(true)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Reply
                            </button>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Editing - we&apos;ll learn from your changes
                            </span>
                          )}
                        </div>
                        {isEditingPositive ? (
                          <textarea
                            value={positiveReplyText}
                            onChange={(e) => setPositiveReplyText(e.target.value)}
                            className="w-full px-4 py-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none min-h-[100px]"
                            rows={4}
                          />
                        ) : (
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-700 leading-relaxed">{positiveReplyText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── NEGATIVE REVIEW SECTION ── */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-red-900">Negative Review</h3>
                          <p className="text-xs text-red-600">How should you handle unhappy customers?</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Sample review card */}
                      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm">
                            {sampleReviews.negative_review.reviewer_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{sampleReviews.negative_review.reviewer_name}</p>
                            <StarRating rating={sampleReviews.negative_review.rating} />
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed mt-2">
                          &ldquo;{sampleReviews.negative_review.text}&rdquo;
                        </p>
                      </div>

                      {/* Voice options */}
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Choose your reply style:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        {(['professional', 'friendly', 'witty'] as BrandVoiceOption[]).map((voice) => (
                          <VoiceOptionCard
                            key={voice}
                            voice={voice}
                            label={voiceDescriptions[voice].label}
                            description={voiceDescriptions[voice].description}
                            reply={sampleReviews.negative_review.replies[voice]}
                            isSelected={negativeVoice === voice}
                            onSelect={() => handleSelectNegativeVoice(voice)}
                          />
                        ))}
                      </div>

                      {/* Edit reply */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Your Reply</span>
                          {!isEditingNegative ? (
                            <button
                              onClick={() => setIsEditingNegative(true)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Reply
                            </button>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Editing - we&apos;ll learn from your changes
                            </span>
                          )}
                        </div>
                        {isEditingNegative ? (
                          <textarea
                            value={negativeReplyText}
                            onChange={(e) => setNegativeReplyText(e.target.value)}
                            className="w-full px-4 py-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none min-h-[100px]"
                            rows={4}
                          />
                        ) : (
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-700 leading-relaxed">{negativeReplyText}</p>
                          </div>
                        )}
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
                      disabled={savingBrandVoice}
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
