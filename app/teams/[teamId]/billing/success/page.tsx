'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'

export default function BillingSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.teamId as string

  useEffect(() => {
    // Redirect to billing page after 3 seconds
    const timer = setTimeout(() => {
      router.push(`/teams/${teamId}/billing`)
    }, 3000)
    return () => clearTimeout(timer)
  }, [teamId, router])

  return (
    <AppShell>
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your subscription has been updated. Credits will be added to your account shortly.
          </p>
          <p className="text-sm text-gray-500">
            Redirecting you back to billing...
          </p>
          <button
            onClick={() => router.push(`/teams/${teamId}/billing`)}
            className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Go to Billing Now →
          </button>
        </div>
      </div>
    </AppShell>
  )
}
