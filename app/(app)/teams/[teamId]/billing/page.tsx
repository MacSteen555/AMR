'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiGet, apiPost } from '@/lib/api'

interface BillingData {
  subscription: {
    tier: string
    status: string
    monthly_credits: number
    insights_enabled: boolean
    competitive_enabled: boolean
    current_period_start: string | null
    current_period_end: string | null
    stripe_subscription_id: string | null
  } | null
  creditBalance: number
  topupProducts: Array<{
    id: string
    stripe_price_id: string
    credits: number
  }>
}

const PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    price: '$0',
    credits: 5,
    features: ['5 reviews/month', 'Basic reply generation'],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: '$15',
    credits: 50,
    features: ['50 reviews/month', 'AI Insights', 'Priority support'],
    popular: true,
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    price: '$35',
    credits: 200,
    features: ['200 reviews/month', 'AI Insights', 'Competitive Intel', 'Team collaboration'],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$80',
    credits: 1000,
    features: ['1,000 reviews/month', 'All features', 'Custom integrations', 'Dedicated support'],
  },
]

export default function BillingPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.teamId as string
  const { user, teams, loading: authLoading } = useAuth()

  const [billing, setBilling] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Modal State
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [targetTier, setTargetTier] = useState<string | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  const currentTeam = teams.find(t => t.id === teamId)

  useEffect(() => {
    if (teamId) {
      loadBilling()
    }
  }, [teamId])

  const loadBilling = async () => {
    try {
      const data: BillingData = await apiGet(`/api/teams/${teamId}/billing`)
      setBilling(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePlan = async (tier: string) => {
    setTargetTier(tier)
    setActionLoading(tier)
    setError(null)
    try {
      const data = await apiPost(`/api/teams/${teamId}/billing/preview`, { tier })
      setPreviewData(data)
      setShowPreview(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const confirmChangePlan = async () => {
    if (!targetTier) return
    setActionLoading('confirm')
    try {
      const response: { url?: string } = await apiPost(`/api/teams/${teamId}/billing/checkout`, { tier: targetTier })
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setError(err.message)
      setShowPreview(false)
    } finally {
      setActionLoading(null)
    }
  }

  const closePreview = () => {
    setShowPreview(false)
    setPreviewData(null)
    setTargetTier(null)
  }

  const handleManageBilling = async () => {
    setActionLoading('portal')
    try {
      const response: { url?: string } = await apiPost(`/api/teams/${teamId}/billing/portal`, {})
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleTopup = async (priceId: string) => {
    setActionLoading(priceId)
    try {
      const response: { url?: string } = await apiPost(`/api/teams/${teamId}/billing/topup`, { stripe_price_id: priceId })
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelPlan = () => {
    setIsCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    setActionLoading('cancel')
    try {
      await apiPost(`/api/teams/${teamId}/billing/cancel`, {})
      setIsCancelModalOpen(false)
      // Redirect to success page, which will redirect back to billing
      router.push(`/teams/${teamId}/billing/success?cancelled=true`)
    } catch (err: any) {
      setError(err.message)
      setActionLoading(null)
    }
  }

  const handleReactivate = async () => {
    setActionLoading('reactivate')
    try {
      await apiPost(`/api/teams/${teamId}/billing/reactivate`, {})
      // Redirect to success page, which will redirect back to billing
      router.push(`/teams/${teamId}/billing/success?reactivated=true`)
    } catch (err: any) {
      setError(err.message)
      setActionLoading(null)
    }
  }

  if (authLoading || loading) {
    return (
      <>
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </>
    )
  }

  const currentTier = billing?.subscription?.tier || 'FREE'
  const tierIndex = PLANS.findIndex(p => p.tier === currentTier)
  const isCanceling = billing?.subscription?.status === 'canceling'

  return (
    <>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-1">
              Manage your subscription and credits for {currentTeam?.name || 'your team'}
            </p>
          </div>

          {/* Cancellation Banner */}
          {billing?.subscription?.status === 'canceling' && (
            <div className="mb-6 p-5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-3 items-start">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 text-lg">Your subscription is scheduled to cancel</h3>
                  <p className="text-yellow-700 mt-1">
                    Your <span className="font-semibold">{currentTier}</span> plan will end on <span className="font-semibold">{billing?.subscription?.current_period_end ? new Date(billing.subscription.current_period_end).toLocaleDateString() : 'period end'}</span>.
                    You'll continue to have full access to all features until then. After that, you'll be moved to the Free plan.
                  </p>
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading === 'reactivate'}
                    className="mt-4 px-5 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'reactivate' ? 'Restoring...' : 'Reverse Cancellation — I want to keep my account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer transition-all duration-200">
                Dismiss
              </button>
            </div>
          )}

          {/* Current Plan & Credits Overview */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Current Plan */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${billing?.subscription?.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  {billing?.subscription?.status || 'Free'}
                </span>
              </div>

              <div className="mb-4">
                <div className="text-3xl font-bold text-teal-600">{currentTier}</div>
                <div className="text-gray-600">
                  {billing?.subscription?.monthly_credits || 4} replies/month
                </div>
              </div>

              {billing?.subscription?.current_period_end && (
                <div className="text-sm text-gray-500 mb-4">
                  {billing.subscription.status === 'canceling' ? 'Ends on' : 'Renews on'} {new Date(billing.subscription.current_period_end).toLocaleDateString()}
                </div>
              )}

              {billing?.subscription?.stripe_subscription_id && (
                <div className="space-y-3">
                  <button
                    onClick={handleManageBilling}
                    disabled={actionLoading === 'portal'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'portal' ? 'Loading...' : 'Manage Billing'}
                  </button>

                  {billing.subscription.status === 'active' && currentTier !== 'FREE' && (
                    <button
                      onClick={handleCancelPlan}
                      className="w-full px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer font-medium"
                    >
                      Cancel Plan
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Monthly Usage */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-sm p-6 text-white">
              <h2 className="text-lg font-semibold mb-4 opacity-90">Monthly Usage</h2>
              <div className="text-5xl font-bold mb-2">{billing?.creditBalance || 0}</div>
              <div className="opacity-80">of {billing?.subscription?.monthly_credits || 5} replies remaining this month</div>

              {billing?.topupProducts && billing.topupProducts.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm opacity-80 mb-2">Need more replies?</div>
                  <div className="flex gap-2">
                    {billing.topupProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleTopup(product.stripe_price_id)}
                        disabled={actionLoading === product.stripe_price_id}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading === product.stripe_price_id ? '...' : `+${product.credits}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Plans */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Plans</h2>
            <div className="grid md:grid-cols-4 gap-4">
              {PLANS.map((plan, index) => {
                const isCurrent = plan.tier === currentTier
                const isUpgrade = index > tierIndex
                const isDowngrade = index < tierIndex

                return (
                  <div
                    key={plan.tier}
                    className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-200 ${isCurrent
                        ? 'border-teal-500 shadow-lg'
                        : plan.popular
                          ? 'border-teal-200 shadow-md'
                          : 'border-gray-100'
                      }`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-teal-500 text-white text-xs font-medium rounded-full">
                          Popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                          Current
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <div className="text-2xl font-bold text-gray-900">
                        {plan.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6 text-sm text-gray-600">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {plan.tier !== 'FREE' && (
                      <button
                        onClick={() => handleChangePlan(plan.tier)}
                        disabled={isCurrent || actionLoading === plan.tier || (isDowngrade && isCanceling)}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${isCurrent
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isUpgrade
                              ? 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98] cursor-pointer'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-[0.98] cursor-pointer'
                          }`}
                      >
                        {actionLoading === plan.tier
                          ? 'Loading...'
                          : isCurrent
                            ? 'Current Plan'
                            : isUpgrade
                              ? 'Upgrade'
                              : 'Downgrade'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Feature Comparison */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Features by Plan</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Feature</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Free</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Pro</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Business</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4 text-gray-900">Monthly Replies</td>
                    <td className="text-center py-3 px-4">5</td>
                    <td className="text-center py-3 px-4">50</td>
                    <td className="text-center py-3 px-4">200</td>
                    <td className="text-center py-3 px-4">1,000</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 text-gray-900">AI Reply Generation</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 text-gray-900">AI Insights</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 text-gray-900">Competitive Intel</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 text-gray-900">Team Collaboration</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-gray-900">Priority Support</td>
                    <td className="text-center py-3 px-4 text-gray-300">—</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                    <td className="text-center py-3 px-4 text-green-500">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Change Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirm {previewData.type === 'upgrade' ? 'Upgrade' : 'Plan Change'}
            </h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-2">{previewData.message}</p>
                {previewData.type === 'downgrade' && (
                  <p className="text-sm text-gray-600">
                    Your current plan benefits will remain active until the end of your billing period ({new Date(previewData.effective_date).toLocaleDateString()}).
                  </p>
                )}
                {previewData.type === 'upgrade' && (
                  <p className="text-sm text-gray-600">
                    You will be charged the prorated difference immediately.
                  </p>
                )}
              </div>

              {previewData.amount_due_today > 0 && (
                <div className="flex justify-between items-center py-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total Due Today</span>
                  <span className="text-xl font-bold text-teal-600">
                    ${previewData.amount_due_today.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closePreview}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200 cursor-pointer"
                disabled={actionLoading === 'confirm'}
              >
                Cancel
              </button>
              <button
                onClick={confirmChangePlan}
                disabled={actionLoading === 'confirm'}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'confirm' ? 'Processing...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Cancel Subscription?</h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-900 font-medium mb-3">
                  Your <span className="font-bold">{currentTier}</span> plan will remain active until <span className="font-bold">{billing?.subscription?.current_period_end ? new Date(billing.subscription.current_period_end).toLocaleDateString() : 'period end'}</span>.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    You'll keep all features and credits until then
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    After that, you'll be on the FREE plan with 5 credits
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer"
                disabled={actionLoading === 'cancel'}
              >
                Keep Plan
              </button>
              <button
                onClick={confirmCancel}
                disabled={actionLoading === 'cancel'}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 cursor-pointer font-medium disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
