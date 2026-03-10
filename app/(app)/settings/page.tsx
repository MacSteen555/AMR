'use client'

import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const { user, logout } = useAuth()

  if (!user) {
    return (
      <div className="p-8">
        <div>
          <div className="animate-pulse mb-8">
            <div className="h-8 w-40 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 w-72 bg-gray-200 rounded"></div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 p-6">
            <div className="animate-pulse flex items-center gap-4">
              <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
              <div>
                <div className="h-5 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-48 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="animate-pulse">
              <div className="h-5 w-24 bg-gray-200 rounded mb-4"></div>
              <div className="h-10 w-28 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-8">
        <div>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
          </div>

          {/* Profile Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full" />
                ) : (
                  <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                    {(user.display_name || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-lg font-semibold text-gray-900">{user.display_name || 'User'}</div>
                  <div className="text-gray-600">{user.email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div className="p-6">
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

