'use client'

import { useRouter } from 'next/navigation'

interface UpgradeLimitModalProps {
  teamId: string
  reviewsManaged: number
  onClose: () => void
}

export function UpgradeLimitModal({ teamId, reviewsManaged, onClose }: UpgradeLimitModalProps) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          You&apos;ve reached your monthly reply limit
        </h2>
        <p className="text-gray-500 mb-6">
          You&apos;ve managed <span className="font-semibold text-teal-600">{reviewsManaged}</span> reviews so far!
          Upgrade your plan to reply to more reviews each month.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose()
              router.push(`/teams/${teamId}/billing`)
            }}
            className="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            Upgrade Plan
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
