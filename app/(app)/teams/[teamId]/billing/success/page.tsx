'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function BillingSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = params.teamId as string
  const isReactivated = searchParams.get('reactivated') === 'true'
  const isCancelled = searchParams.get('cancelled') === 'true'

  useEffect(() => {
    // Redirect to billing page after 3 seconds
    const timer = setTimeout(() => {
      router.push(`/teams/${teamId}/billing`)
    }, 3000)
    return () => clearTimeout(timer)
  }, [teamId, router])

  return (
    <>
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isCancelled ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
            {isCancelled ? (
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          {isReactivated ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription Restored!</h1>
              <p className="text-gray-600 mb-6">
                Great news! Your subscription has been reactivated. You'll continue to have access to all your plan's features.
              </p>
            </>
          ) : isCancelled ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription Cancelled</h1>
              <p className="text-gray-600 mb-6">
                Your cancellation has been processed. You'll continue to have access to your plan's features until the end of your billing period.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
              <p className="text-gray-600 mb-6">
                Your subscription has been updated. Credits will be added to your account shortly.
              </p>
            </>
          )}
          <p className="text-sm text-gray-500">
            Redirecting you back to billing...
          </p>
          <button
            onClick={() => router.push(`/teams/${teamId}/billing`)}
            className="mt-4 text-teal-600 hover:text-teal-700 font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            Go to Billing Now →
          </button>
        </div>
      </div>
    </>
  )
}
