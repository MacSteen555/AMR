import { GoogleLoginButton } from '@/components/GoogleLoginButton'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-indigo-600 mb-2">AutoMyReply</h1>
            <p className="text-gray-600">Sign in to manage your reviews</p>
          </div>

          {/* Google Login Button */}
          <GoogleLoginButton />

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">
              By signing in, you agree to connect your Google Business Profile account.
            </p>
            <p className="text-xs text-gray-400">
              Logging in indicates agreement to our <a href="/terms" className="text-indigo-600 hover:text-indigo-700 hover:underline">Terms of Service</a> and <a href="/privacy" className="text-indigo-600 hover:text-indigo-700 hover:underline">Privacy Policy</a>.
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

