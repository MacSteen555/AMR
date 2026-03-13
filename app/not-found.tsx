import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <Image
        src="/images/amber_teal-logo.png"
        alt="AutoMyReply"
        width={48}
        height={48}
        className="h-12 w-auto mb-8"
      />
      <h1 className="text-7xl font-extrabold text-gray-200 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h2>
      <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 text-sm font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition shadow-sm"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
