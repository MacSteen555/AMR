'use client'

import { AppShell } from '@/components/AppShell'
import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const { user, logout } = useAuth()

  if (!user) {
    return null
  }

  return (
    <AppShell>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
          </div>

          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full" />
                ) : (
                  <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
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
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div className="p-6">
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

