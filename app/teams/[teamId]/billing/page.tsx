'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
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
    credits: 4,
    features: ['4 credits/month', 'Basic reply generation'],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: '$10',
    credits: 25,
    features: ['25 credits/month', 'AI Insights', 'Priority support'],
    popular: true,
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    price: '$25',
    credits: 50,
    features: ['50 credits/month', 'AI Insights', 'Competitive Intel', 'Team collaboration'],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$99',
    credits: 1000,
    features: ['1,000 credits/month', 'All features', 'Custom integrations', 'Dedicated support'],
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

  const handleUpgrade = async (tier: 'PRO' | 'BUSINESS' | 'ENTERPRISE') => {
    setActionLoading(tier)
    try {
      const response: { url?: string } = await apiPost(`/api/teams/${teamId}/billing/checkout`, { tier })
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
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

  const handleCancelPlan = async () => {
    const periodEnd = billing?.subscription?.current_period_end
      ? new Date(billing.subscription.current_period_end).toLocaleDateString()
      : 'the end of your billing period'

    const confirmed = confirm(
      `Your ${currentTier} plan will remain active until ${periodEnd}. ` +
      `You'll keep all features and credits until then. ` +
      `After that, you'll be on the FREE plan with 5 credits.\n\n` +
      `Do you want to cancel your subscription?`
    )

    if (!confirmed) return

    setActionLoading('cancel')
    try {
      await apiPost(`/api/teams/${teamId}/billing/cancel`, {})
      await loadBilling() // Refresh to show canceling banner
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReactivate = async () => {
    setActionLoading('reactivate')
    try {
      await apiPost(`/api/teams/${teamId}/billing/reactivate`, {})
      await loadBilling() // Refresh to remove banner
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppShell>
    )
  }

  const currentTier = billing?.subscription?.tier || 'FREE'
  const tierIndex = PLANS.findIndex(p => p.tier === currentTier)

  return (
    <AppShell>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-1">
              Manage your subscription and credits for {currentTeam?.name || 'your team'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Cancellation Banner */}
          {billing?.subscription?.status === 'canceling' && billing?.subscription?.current_period_end && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-yellow-800 font-medium">
                    Your {currentTier} plan will end on{' '}
                    {new Date(billing.subscription.current_period_end).toLocaleDateString()}.
                  </p>
                  <p className="text-yellow-700 text-sm mt-1">
                    You'll have full access to all features until then.
                  </p>
                </div>
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading === 'reactivate'}
                  className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {actionLoading === 'reactivate' ? 'Loading...' : 'Reactivate Plan'}
                </button>
              </div>
            </div>
          )}

          {/* Current Plan & Credits Overview */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Current Plan */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  billing?.subscription?.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : billing?.subscription?.status === 'canceling'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                }`}>
                  {billing?.subscription?.status === 'canceling'
                    ? 'Canceling'
                    : billing?.subscription?.status || 'Free'}
                </span>
              </div>
              
              <div className="mb-4">
                <div className="text-3xl font-bold text-indigo-600">{currentTier}</div>
                <div className="text-gray-600">
                  {billing?.subscription?.monthly_credits || 4} credits/month
                </div>
              </div>

              {billing?.subscription?.current_period_end && (
                <div className="text-sm text-gray-500 mb-4">
                  Renews on {new Date(billing.subscription.current_period_end).toLocaleDateString()}
                </div>
              )}

              {billing?.subscription?.stripe_subscription_id && (
                <div className="space-y-2">
                  <button
                    onClick={handleManageBilling}
                    disabled={actionLoading === 'portal'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'portal' ? 'Loading...' : 'Manage Billing'}
                  </button>

                  {billing.subscription.status === 'active' && currentTier !== 'FREE' && (
                    <button
                      onClick={handleCancelPlan}
                      disabled={actionLoading === 'cancel'}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'cancel' ? 'Loading...' : 'Cancel Plan'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Credit Balance */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
              <h2 className="text-lg font-semibold mb-4 opacity-90">Credit Balance</h2>
              <div className="text-5xl font-bold mb-2">{billing?.creditBalance || 0}</div>
              <div className="opacity-80">credits available</div>
              
              {billing?.topupProducts && billing.topupProducts.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm opacity-80 mb-2">Need more credits?</div>
                  <div className="flex gap-2">
                    {billing.topupProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleTopup(product.stripe_price_id)}
                        disabled={actionLoading === product.stripe_price_id}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors disabled:opacity-50"
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
                    className={`relative bg-white rounded-xl border-2 p-6 transition-all ${
                      isCurrent 
                        ? 'border-indigo-500 shadow-lg' 
                        : plan.popular 
                          ? 'border-indigo-200 shadow-md' 
                          : 'border-gray-200'
                    }`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-medium rounded-full">
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
                        onClick={() => isUpgrade ? handleUpgrade(plan.tier as any) : handleManageBilling()}
                        disabled={isCurrent || actionLoading === plan.tier}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          isCurrent
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isUpgrade
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                    <td className="py-3 px-4 text-gray-900">Monthly Credits</td>
                    <td className="text-center py-3 px-4">4</td>
                    <td className="text-center py-3 px-4">25</td>
                    <td className="text-center py-3 px-4">50</td>
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
    </AppShell>
  )
}
