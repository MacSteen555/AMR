import Link from 'next/link'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left Panel: Branding & Feature Highlights ── */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-sm" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3 blur-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <img src="/images/white-logo.png" alt="AutoMyReply" className="h-9 w-auto" />
              <span className="text-xl font-bold text-white">AutoMyReply</span>
            </Link>
          </div>

          {/* Center content */}
          <div className="max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Turn every review into a
              <span className="block text-indigo-200">growth opportunity</span>
            </h2>
            <p className="text-indigo-200/80 text-lg leading-relaxed mb-10">
              AI-powered replies that sound like you, delivered in seconds. Join hundreds of businesses that never miss a review.
            </p>

            {/* Feature list */}
            <div className="space-y-5">
              {[
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                  title: 'AI replies in under 5 seconds',
                  desc: 'Context-aware, on-brand responses generated instantly',
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
                  title: 'Secure Google integration',
                  desc: 'OAuth 2.0 with encrypted tokens — your data stays safe',
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
                  title: 'Built for teams',
                  desc: 'Multi-location, multi-member collaboration from day one',
                },
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">{feature.icon}</svg>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{feature.title}</div>
                    <div className="text-indigo-300/70 text-sm mt-0.5">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="max-w-lg">
            <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-white/90 text-sm leading-relaxed mb-4">
                &ldquo;AutoMyReply cut our review response time from hours to seconds. The AI replies are so natural that customers can't tell the difference.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-300 to-violet-300 flex items-center justify-center text-indigo-900 text-xs font-bold">
                  RT
                </div>
                <div>
                  <div className="text-white text-sm font-medium">Rachel Torres</div>
                  <div className="text-indigo-300/60 text-xs">Operations Manager, Peak Fitness</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="w-full lg:w-[45%] flex flex-col min-h-screen bg-white">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-6 border-b border-gray-100">
          <Link href="/" className="inline-flex items-center gap-2">
            <img src="/images/purple-logo.png" alt="AutoMyReply" className="h-7 w-auto" />
            <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Back to home
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-10">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
              <p className="text-gray-500">Sign in to your account to continue managing your reviews.</p>
            </div>

            {/* Error from URL params */}
            {searchParams?.error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{searchParams.error}</p>
              </div>
            )}

            {/* Google Login Button */}
            <GoogleLoginButton />

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-gray-400 uppercase tracking-wider font-medium">secure sign-in</span>
              </div>
            </div>

            {/* Trust signals */}
            <div className="space-y-4 mb-8">
              {[
                { text: 'No password needed — Google handles authentication', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
                { text: 'Your data is encrypted and never shared', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
                { text: 'Free plan available — no credit card required', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                  </div>
                  <span className="text-sm text-gray-500">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Legal */}
            <p className="text-xs text-gray-400 leading-relaxed">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-indigo-600 hover:text-indigo-700 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-indigo-600 hover:text-indigo-700 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        {/* Desktop back link */}
        <div className="hidden lg:flex items-center justify-center pb-8">
          <Link href="/" className="group inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
